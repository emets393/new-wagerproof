"""
Parse weebly Madden launch-roster xlsx (2018-2023) into a unified table and crosswalk name+pos -> gsis_id.
Reports: per-year Madden->gsis match rate, ambiguity, and (the use-case metric) % of injury-report
players that get a Madden OVR. NO model wiring yet — this is the data-quality gate the user asked for.
"""
import os, sys, re, glob, unicodedata, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
DATA=os.path.join(os.path.dirname(os.path.abspath(__file__)),"data"); MD=os.path.join(DATA,"madden"); L=print

SUFFIX=re.compile(r"\b(jr|sr|ii|iii|iv|v)\b")
def norm(s):
    if not isinstance(s,str): return ""
    s=unicodedata.normalize("NFKD",s).encode("ascii","ignore").decode().lower()
    s=SUFFIX.sub("",s); s=re.sub(r"[^a-z ]"," ",s); return re.sub(r"\s+"," ",s).strip()

def find(cols,*subs):
    for c in cols:
        cl=c.lower().strip()
        if any(cl==s or s in cl for s in subs): return c
    return None

def parse_file(f,season,sheet=0):
    df=pd.read_excel(f, sheet_name=sheet); cols=list(df.columns)
    ovr=find(cols,"overall rating","overallrating","overall")
    pos=find(cols,"position"); team=find(cols,"team")
    fn_c=find(cols,"firstname"); ln_c=find(cols,"lastname"); nm=find(cols,"full name","name")
    if fn_c and ln_c:                                    # first/last split (case-insensitive)
        df["_name"]=df[fn_c].astype(str)+" "+df[ln_c].astype(str)
    elif nm: df["_name"]=df[nm].astype(str)
    else: raise ValueError(f"no name col in {f}: {cols}")
    out=pd.DataFrame({"season":season,"mname":df["_name"],"team":df[team] if team else None,
                      "pos":df[pos] if pos else None,"ovr":pd.to_numeric(df[ovr],errors="coerce")})
    out["nname"]=out.mname.map(norm)
    return out[out.nname!=""].dropna(subset=["ovr"])

# Madden game-year -> NFL season.  2025 uses the leak-safe "Launch Ratings" sheet (default is Week 1).
files={2018:("madden_2018.xlsx",0),2019:("madden_2019.xlsx",0),2020:("madden_2020.xlsx",0),
       2021:("madden_2021.xlsx",0),2022:("madden_2022.xlsx",0),2023:("madden_2023.xlsx",0),
       2024:("madden_2024.xlsx",0),2025:("madden_2025.xlsx","Launch Ratings")}
mad=pd.concat([parse_file(os.path.join(MD,fn),yr,sh) for yr,(fn,sh) in files.items()],ignore_index=True)
L(f"[parse] total Madden rows 2018-2023: {len(mad)}  (per yr: {mad.groupby('season').size().to_dict()})")
L(f"[parse] OVR range {mad.ovr.min():.0f}-{mad.ovr.max():.0f}, median {mad.ovr.median():.0f}")

# crosswalk target: players_xwalk (gsis + name variants + era)
px=pd.read_parquet(os.path.join(DATA,"players_xwalk.parquet"))
px["n_disp"]=px.display_name.map(norm)
px["n_fl"]=(px.first_name.astype(str)+" "+px.last_name.astype(str)).map(norm)
px["n_fb"]=(px.football_name.astype(str)+" "+px.last_name.astype(str)).map(norm)
px["rk"]=pd.to_numeric(px.rookie_season,errors="coerce").fillna(1990)
px["ls"]=pd.to_numeric(px.last_season,errors="coerce").fillna(2030)
# long lookup: normalized-name -> rows
look={}
for _,r in px.iterrows():
    for key in {r.n_disp,r.n_fl,r.n_fb}:
        if key: look.setdefault(key,[]).append((r.gsis_id,r.rk,r.ls,r.position))

def match_row(nname,season):
    cands=look.get(nname)
    if not cands: return ("none",None)
    active=[c for c in cands if c[1]-1<=season<=c[2]+1]
    pool=active if active else cands
    gids={c[0] for c in pool}
    if len(gids)==1: return ("matched",pool[0][0])
    return ("ambiguous",None)

res=mad.apply(lambda r: match_row(r.nname,r.season),axis=1,result_type="expand")
mad["status"]=res[0]; mad["gsis_id"]=res[1]
L("\n[crosswalk] Madden -> gsis_id match status by year:")
tab=mad.groupby(["season","status"]).size().unstack(fill_value=0)
for c in ["matched","ambiguous","none"]:
    if c not in tab: tab[c]=0
tab["match%"]=(tab["matched"]/tab.sum(axis=1)*100).round(1)
L(tab[["matched","ambiguous","none","match%"]].to_string())

# weighted: matches among players who MATTER (OVR>=75 = rotation/starter caliber)
hi=mad[mad.ovr>=75]
L(f"\n[crosswalk] starter-caliber (OVR>=75): {len(hi)} rows, matched {((hi.status=='matched').mean()*100):.1f}%, ambiguous {((hi.status=='ambiguous').mean()*100):.1f}%")

# USE-CASE metric: do our injury-report players get a Madden OVR?
inj=pd.read_parquet(os.path.join(DATA,"injuries_raw.parquet"))
inj=inj[inj.season.between(2018,2025)].copy()
mm=mad[mad.status=="matched"][["season","gsis_id","ovr"]].drop_duplicates(["season","gsis_id"])
ij=inj[["season","player_id"]].drop_duplicates().rename(columns={"player_id":"gsis_id"})
cov=ij.merge(mm,on=["season","gsis_id"],how="left")
L(f"\n[USE-CASE] injury-report players w/ a Madden OVR (by gsis): {cov.ovr.notna().mean()*100:.1f}%  (n={len(cov)})")
L(f"           Out/Doubtful only: ", end="")
od=inj[inj.report_status.isin(['Out','Doubtful'])][["season","player_id"]].drop_duplicates().rename(columns={"player_id":"gsis_id"}).merge(mm,on=["season","gsis_id"],how="left")
L(f"{od.ovr.notna().mean()*100:.1f}% (n={len(od)})")

# save the matched crosswalk for later wiring
mad.to_parquet(os.path.join(DATA,"madden_ratings.parquet"))
L(f"\n[save] data/madden_ratings.parquet ({len(mad)} rows, {(mad.status=='matched').sum()} with gsis_id)")
