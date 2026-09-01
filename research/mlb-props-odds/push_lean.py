import json, sys, time
from pathlib import Path
import pandas as pd, requests
ROOT=Path(".").resolve()
def key():
    for l in (Path("../../.env.local")).read_text().splitlines():
        if l.startswith("SUPABASE_SERVICE_KEY="): return l.split("=",1)[1].strip()
k=key()
URL="https://jpxnjuwglavsjbgbasnl.supabase.co/rest/v1/mlb_props_hist"
H={"apikey":k,"Authorization":f"Bearer {k}","Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"}
df=pd.read_parquet("data/parquet/primary.parquet")
only=sys.argv[1] if len(sys.argv)>1 else None
if only=="pitcher": df=df[df.is_pitcher]
elif only=="batter": df=df[~df.is_pitcher]
df=df.astype(object).where(pd.notnull(df),None)
recs=df.to_dict("records"); sess=requests.Session(); done=0
for i in range(0,len(recs),3000):
    ch=recs[i:i+3000]
    for a in range(5):
        try:
            r=sess.post(URL,headers=H,data=json.dumps(ch,default=str),timeout=60)
            if r.status_code in (200,201,204): break
            print("status",r.status_code,r.text[:150],flush=True)
        except Exception as e: print("exc",e,flush=True)
        time.sleep(3*(a+1))
    else: sys.exit(f"fail {i}")
    done+=len(ch)
print(f"pushed {only or 'all'}: {done} rows",flush=True)
