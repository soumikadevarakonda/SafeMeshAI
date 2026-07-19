import os,json,csv
from datetime import datetime
from statistics import median

def compute_metrics(y,p):
 n=len(y); tp=sum(a==1 and b==1 for a,b in zip(y,p)); tn=sum(a==0 and b==0 for a,b in zip(y,p)); fp=sum(a==0 and b==1 for a,b in zip(y,p)); fn=sum(a==1 and b==0 for a,b in zip(y,p)); pr=tp/(tp+fp) if tp+fp else 0; rc=tp/(tp+fn) if tp+fn else 0
 return {'accuracy':(tp+tn)/n if n else 0,'precision':pr,'recall':rc,'f1':2*pr*rc/(pr+rc) if pr+rc else 0,'specificity':tn/(tn+fp) if tn+fp else 0,'confusion_matrix':[[tn,fp],[fn,tp]]}
def run_evaluation_pipeline(test_path,models_dir,output_dir):
 from app.models import SafetyModels
 os.makedirs(output_dir,exist_ok=True); m=SafetyModels()
 if not m.load(models_dir): raise RuntimeError('Could not load trained models')
 strings={'timestamp','zone_id','scenario_id','scenario_type','incident_event_time'}; rows=[]
 with open(test_path,encoding='utf-8') as f:
  for r in csv.DictReader(f): rows.append({k:(v if k in strings else float(v or 0)) for k,v in r.items()})
 yt=[]; bp=[]; cp=[]
 for r in rows:
  prob,_,base=m.predict(r); yt.append(int(r['is_incident_imminent'])); bp.append(base); cp.append(int(prob>=m.decision_threshold))
 scenarios={}
 for r in rows:
  if r.get('incident_event_time'): scenarios.setdefault(r['scenario_id'],[]).append(r)
 results=[]; bl=[]; cl=[]
 for sid,sr in scenarios.items():
  event=datetime.fromisoformat(sr[0]['incident_event_time']); pre=sorted([r for r in sr if datetime.fromisoformat(r['timestamp'])<event and r.get('minutes_to_incident',0)>0],key=lambda r:r['timestamp'])
  btime=ctime=None
  for r in pre:
   prob,_,base=m.predict(r); t=datetime.fromisoformat(r['timestamp'])
   if base and btime is None:btime=t
   if prob>=m.decision_threshold and ctime is None:ctime=t
  bv=(event-btime).total_seconds()/60 if btime else None; cv=(event-ctime).total_seconds()/60 if ctime else None
  if bv is not None: bl.append(bv)
  if cv is not None: cl.append(cv)
  results.append({'scenario_id':sid,'scenario_type':sr[0]['scenario_type'],'incident_event_time':event.isoformat(),'baseline_detected':btime is not None,'compound_detected':ctime is not None,'baseline_first_alert_time':btime.isoformat() if btime else None,'compound_first_alert_time':ctime.isoformat() if ctime else None,'baseline_lead_time_min':bv,'compound_lead_time_min':cv})
 def summary(vals,total): return {'avg_lead_time_min':sum(vals)/len(vals) if vals else None,'median_lead_time_min':median(vals) if vals else None,'incidents_detected':len(vals),'incidents_missed':total-len(vals),'incident_detection_rate':len(vals)/total if total else 0,'lead_times_min':vals}
 paired=[r['compound_lead_time_min']-r['baseline_lead_time_min'] for r in results if r['compound_lead_time_min'] is not None and r['baseline_lead_time_min'] is not None]
 report={'metadata':{'evaluated_at':datetime.now().isoformat(),'test_set_size':len(rows),'decision_threshold':m.decision_threshold,'split_type':'scenario_group_holdout','total_incident_scenarios':len(scenarios),'model_version':'v2.1.0'},'baseline':{**compute_metrics(yt,bp),**summary(bl,len(scenarios))},'compound':{**compute_metrics(yt,cp),**summary(cl,len(scenarios))},'paired_lead_time_comparison':{'scenarios_detected_by_both':len(paired),'avg_improvement_min':sum(paired)/len(paired) if paired else None,'median_improvement_min':median(paired) if paired else None,'individual_improvements_min':paired},'scenario_results':results}
 with open(os.path.join(output_dir,'evaluation_metrics.json'),'w') as f: json.dump(report,f,indent=2)
 return report
