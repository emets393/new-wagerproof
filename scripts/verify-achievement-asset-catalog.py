"""Check the 24 approved review deliveries using their existing audit reports.

Read-only; emits JSON to stdout and exits nonzero for any incomplete delivery.
Does not reopen USDZ geometry or alter assets. Run after all family builds finish.
"""
import json
import math
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1] / 'artifacts/achievements'
FAMILIES = {
    'Getting Started': [('first-agent','First Agent'),('first-follow','First Follow'),('first-picks','First Picks')],
    'Agent Experience': [('experience/experience-'+str(n),str(n)+' Graded Picks') for n in (10,50,100,500)],
    'Winning Streaks': [('streaks/streak-'+str(n),str(n)+' Win Streak') for n in (3,5,10,15)],
    'Performance': [('performance/'+slug,title) for slug,title in [('first-win','First Win'),('plus-10-units','+10 Units'),('plus-25-units','+25 Units'),('consistent','Consistent')]],
    'Leaderboard': [('leaderboard/'+slug,title) for slug,title in [('top-100','Top 100'),('top-10','Top 10'),('number-one','Number One')]],
    'Exploration': [('exploration/'+slug,title) for slug,title in [('game-analyst','Game Analyst'),('props-scout','Props Scout'),('trend-explorer','Trend Explorer'),('system-builder','System Builder'),('wagerbot-partner','WagerBot Partner'),('connected-researcher','Connected Researcher')]],
}


def verify():
    assets=[]
    for family, entries in FAMILIES.items():
        for index,(relative,title) in enumerate(entries):
            folder=ROOT/relative
            errors=[]
            def check(value,message):
                if not value: errors.append(message)
            def nonempty(path):
                check(path.is_file() and path.stat().st_size>0,'Missing/empty '+str(path.relative_to(ROOT)))
            def read(name):
                path=folder/name
                nonempty(path)
                try:return json.loads(path.read_text())
                except (OSError,ValueError):return {}
            manifest=read('manifest.json')
            for field,extension in [('asset','.usdz'),('editable_master','.blend')]:
                name=manifest.get(field)
                if not isinstance(name,str) or Path(name).name!=name or not name.endswith(extension):
                    errors.append('Invalid/missing '+field)
                else: nonempty(folder/name)
            views=['front','angle']+(['top','back'] if index==0 else [])
            for view in views:nonempty(folder/'renders'/('usdz-'+view+'.png'))
            parts=manifest.get('parts',{})
            check(bool(parts),'No source mesh results')
            for name,part in parts.items():
                check(part.get('nonmanifold_edges')==0 and part.get('volume',0)>0,'Unclosed/inward source part '+name)
                check(all(not isinstance(v,(float,int)) or math.isfinite(v) for v in part.values()),'Nonfinite source result '+name)
            validation=manifest.get('validation',{})
            if family=='Getting Started':
                check(validation.get('source_meshes_closed_outward') is True,'Source audit not passed')
                check(validation.get('usdz_reimport')=='passed','Reimport audit not passed')
                check(manifest.get('engraving',{}).get('preview_text_in_export') is False,'Preview inscription export policy missing')
                independent=read('usdz-independent-verification.json')
                check(independent.get('status')=='passed','Independent USD audit not passed')
                check(independent.get('no_preview_geometry') is True,'USD sample/studio exclusion not passed')
                audited=independent.get('parts',{})
                check(set(audited)==set(parts),'USD audit/source part set mismatch')
                check(all(p.get('closed_outward') is True and bool(p.get('shader')) for p in audited.values()),'USD geometry/material audit incomplete')
                reimport=read('usd-reimport-verification.json')
                check(reimport.get('sample_text_in_export') is False,'Reimport sample text exclusion failed')
                check(reimport.get('anchors_present') is True,'Reimport anchors missing')
            else:
                check(validation.get('source_closed_outward') is True,'Source audit not passed')
                check(validation.get('reimport_closed_outward') is True,'Reimport audit not passed')
                check(manifest.get('all_front_details_curved') is True,'Curved detail contract missing')
                check(manifest.get('preview_text_in_export') is False,'Sample text exclusion missing')
                audit=manifest.get('export_checks',{})
                for flag in ('usd_y_up','finite_vertices_normals','materials_bound','no_studio_or_sample_text'):
                    check(audit.get(flag) is True,'Export check not passed: '+flag)
                check(audit.get('mesh_roles_count')==len(parts),'Export/source part count mismatch')
                check(set(views).issubset(validation.get('actual_usdz_views',[])),'Actual view audit incomplete')
            assets.append({'family':family,'title':title,'directory':relative,'status':'failed' if errors else 'passed','errors':errors})
    assert len(assets)==24
    report={'status':'passed' if all(a['status']=='passed' for a in assets) else 'failed','expected_assets':24,
            'passed_assets':sum(a['status']=='passed' for a in assets),'validation':'Delivery inventory and existing export/reimport audit reports; USDZ geometry not reopened.',
            'delivery_status':'Review-master inventory only; native runtime validation is tracked separately in docs/achievements-ios.md.','assets':assets}
    print(json.dumps(report,indent=2))
    return 0 if report['status']=='passed' else 1

if __name__=='__main__':sys.exit(verify())
