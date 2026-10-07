from pathlib import Path
import subprocess, shutil, hashlib, json, time, urllib.request, datetime
p=Path('/data/projects/daoyou'); out=p/'output/spirit-ledger'; c=out/'build'; deploy=Path('/data/projects/daoyou-deploy')
assert (c/'checks-passed.txt').exists()
assert json.loads((out/'browser-verification.json').read_text())['passed']
assert (out/'browser-verification.json').stat().st_mtime >= (c/'checks-passed.txt').stat().st_mtime, 'Final browser verification required'
assert json.loads((out/'backend-verification.json').read_text())['passed']
assert (c/'dist/index.js').exists() and (c/'client/index.html').exists()
b=Path((out/'backup-path.txt').read_text()); assert (b/'dist/index.js').exists() and (b/'client/index.html').exists()
with (b/'database-before.dump.tmp').open('wb') as f:
 subprocess.run(['docker','exec','daoyou-db-1','pg_dump','-U','daoyou','-d','daoyou','-Fc'],stdout=f,check=True)
(b/'database-before.dump.tmp').replace(b/'database-before.dump');assert (b/'database-before.dump').stat().st_size>10000
newdist=p/'dist-spirit-ledger-release'; olddist=p/'dist-before-spirit-ledger'; newclient=p/'output/client-spirit-ledger-release'; oldclient=p/'output/client-before-spirit-ledger'
for f in [newdist,olddist,newclient,oldclient]:assert not f.exists(),str(f)
shutil.copytree(c/'dist',newdist);shutil.copytree(c/'client',newclient)
for f in (p/'output/client/assets').rglob('*'):
 if f.is_file():
  dest=newclient/'assets'/f.relative_to(p/'output/client/assets')
  if not dest.exists():dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,dest)
entry=json.loads((p/'drizzle/meta/_journal.json').read_text())['entries'][-1];assert entry['tag']=='0037_spirit_stone_statistics'
sqltext=(p/'drizzle/0037_spirit_stone_statistics.sql').read_text();digest=hashlib.sha256(sqltext.encode()).hexdigest()
before="""BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtext('daoyou.schema.migrations'));
DO $$ BEGIN
IF NOT EXISTS(SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at=1789147156591 AND hash='9dc11c03e4a05e5e6a23b1528e7cd6a3492369fa09accac477ff3a2a9731f0d9') OR (SELECT max(created_at) FROM drizzle.__drizzle_migrations) <> 1789147156591 THEN RAISE EXCEPTION 'Unexpected migration version'; END IF;
IF to_regclass('public.wanjiedaoyou_spirit_stone_tracking') IS NOT NULL THEN RAISE EXCEPTION 'Statistics already installed'; END IF;
END $$;
"""
migration=before+sqltext+"\nINSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('"+digest+"',"+str(entry['when'])+");\nCOMMIT;"
r=subprocess.run(['docker','exec','-i','daoyou-db-1','psql','-U','daoyou','-d','daoyou','-v','ON_ERROR_STOP=1'],input=migration,capture_output=True,text=True)
print('MIGRATION',r.returncode,r.stdout[-1800:],r.stderr[-1800:],flush=True);assert r.returncode==0,'Migration failed, live app unchanged'
cmd=['docker','compose','--env-file','.env','-f','compose.yaml','up','-d','--no-deps','--force-recreate','app']
def recreate():
 r=subprocess.run(cmd,cwd=deploy,capture_output=True,text=True,timeout=120);print('RECREATE',r.returncode,r.stderr[-1200:],flush=True);assert r.returncode==0
def ready():
 for i in range(20):
  try:
   with urllib.request.urlopen('http://127.0.0.1:38148/api/ready',timeout=4) as r:
    health=json.loads(r.read())
    if r.status==200 and health['success']:return health
  except Exception:pass
  time.sleep(2)
 raise RuntimeError('Readiness failed')
(p/'dist').rename(olddist);newdist.rename(p/'dist');(p/'output/client').rename(oldclient);newclient.rename(p/'output/client')
try:recreate();health=ready()
except Exception:
 (p/'dist').rename(p/'dist-spirit-ledger-failed');olddist.rename(p/'dist')
 (p/'output/client').rename(p/'output/client-spirit-ledger-failed');oldclient.rename(p/'output/client')
 recreate();print('ROLLED_BACK_APP',ready(),flush=True);raise
version=json.loads((p/'output/client/version.json').read_text())
record={'version':version,'deployedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'migration':entry['tag'],'migrationHash':digest,'backup':str(b),'readiness':health}
(out/'release.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
print('SPIRIT_LEDGER_DEPLOYED',json.dumps(record,ensure_ascii=False),flush=True)
