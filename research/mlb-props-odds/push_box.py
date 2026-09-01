import json, sys, time
from pathlib import Path
import pandas as pd, requests
ROOT=Path("/Users/chrishabib/Documents/new-wagerproof/research/mlb-props-odds")
key=[l.split("=",1)[1].strip() for l in open(ROOT.parent.parent/".env.local") if l.startswith("SUPABASE_SERVICE_KEY=")][0]
URL="https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/mlb_batter_box_hist"
H={"apikey":key,"Authorization":f"Bearer {key}","Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"}
df=pd.read_parquet(ROOT/"data/parquet/batter_box_hist.parquet")
df=df.drop_duplicates(subset=["game_pk","player_id"]).astype(object).where(pd.notnull(df),None)
recs=df.to_dict("records"); s=requests.Session(); done=0
for i in range(0,len(recs),5000):
    ch=recs[i:i+5000]
    for a in range(5):
        r=s.post(URL,headers=H,data=json.dumps(ch,default=str),timeout=60)
        if r.status_code in (200,201,204): break
        print("st",r.status_code,r.text[:150]); time.sleep(3*(a+1))
    else: sys.exit("fail "+str(i))
    done+=len(ch)
print("pushed",done)
