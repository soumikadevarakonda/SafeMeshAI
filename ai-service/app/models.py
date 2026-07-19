import os, json, math, csv
from datetime import datetime

class SafetyModels:
    def __init__(self):
        self.features_list = [
            "active_permits", "permit_overlap_count", "has_hot_work", "has_confined_space",
            "has_electrical_isolation", "simops_conflict", "worker_count", "worker_exposure_duration",
            "maintenance_overdue", "equipment_health_avg", "recent_near_miss_count", "shift_change",
            "combustible_gas_val", "combustible_gas_avg_30m", "combustible_gas_std_30m", "combustible_gas_slope_30m",
            "toxic_gas_val", "toxic_gas_avg_30m", "toxic_gas_std_30m", "toxic_gas_slope_30m",
            "oxygen_val", "oxygen_avg_30m", "oxygen_std_30m", "oxygen_slope_30m",
            "ventilation_val", "ventilation_avg_30m", "ventilation_std_30m", "ventilation_slope_30m",
            "pressure_val", "pressure_avg_30m", "pressure_std_30m", "pressure_slope_30m",
            "vibration_val", "vibration_avg_30m", "vibration_std_30m", "vibration_slope_30m",
            "temperature_val", "temperature_avg_30m", "temperature_std_30m", "temperature_slope_30m"
        ]
        self.baselines = {
            "combustible_gas": 40.0,      # LEL% critical threshold
            "toxic_gas": 100.0,            # ppm critical
            "oxygen": 18.0,                # Oxygen deficiency critical (trigger if <= 18)
            "ventilation": 50.0,           # Ventilation efficiency critical (trigger if <= 50)
            "pressure": 90.0,              # bar critical
            "vibration": 10.0,             # mm/s critical
            "temperature": 950.0           # °C critical
        }
        self.weights = {f:0.0 for f in self.features_list}
        self.bias = 0.0
        self.means = [0.0]*len(self.features_list)
        self.stds = [1.0]*len(self.features_list)
        self.anomaly_means = {f:0.0 for f in self.features_list}
        self.anomaly_stds = {f:1.0 for f in self.features_list}
        self.decision_threshold = 0.5

    def predict_baseline(self, x):
        return int(x.get("combustible_gas_val",0)>=40 or x.get("toxic_gas_val",0)>=100 or
                   x.get("oxygen_val",20.9)<=18 or x.get("ventilation_val",100)<=50 or
                   x.get("pressure_val",0)>=90 or x.get("vibration_val",0)>=10 or x.get("temperature_val",0)>=950)

    def load_csv_data(self,path):
        rows=[]
        with open(path,encoding="utf-8") as f:
            for r in csv.DictReader(f):
                rows.append({k:(v if k in ("zone_id","timestamp","scenario_id","scenario_type","incident_event_time") else float(v or 0)) for k,v in r.items()})
        return rows

    @staticmethod
    def _sigmoid(z): return 1/(1+math.exp(-max(-20,min(20,z))))
    @staticmethod
    def _metrics(y,p):
        tp=sum(a==1 and b==1 for a,b in zip(y,p)); tn=sum(a==0 and b==0 for a,b in zip(y,p))
        fp=sum(a==0 and b==1 for a,b in zip(y,p)); fn=sum(a==1 and b==0 for a,b in zip(y,p))
        precision=tp/(tp+fp) if tp+fp else 0; recall=tp/(tp+fn) if tp+fn else 0
        return {"tp":tp,"tn":tn,"fp":fp,"fn":fn,"accuracy":(tp+tn)/len(y) if y else 0,
                "precision":precision,"recall":recall,"specificity":tn/(tn+fp) if tn+fp else 0,
                "f1":2*precision*recall/(precision+recall) if precision+recall else 0}

    def train(self,train_path,val_path,save_dir):
        os.makedirs(save_dir,exist_ok=True)
        tr=self.load_csv_data(train_path); va=self.load_csv_data(val_path)
        normal=[r for r in tr if int(r["is_incident_imminent"])==0] or tr
        for f in self.features_list:
            vals=[r.get(f,0) for r in normal]; m=sum(vals)/len(vals); sd=math.sqrt(sum((v-m)**2 for v in vals)/len(vals))
            self.anomaly_means[f]=m; self.anomaly_stds[f]=sd if sd>1e-4 else 1.0
        X=[[r.get(f,0) for f in self.features_list] for r in tr]; y=[int(r["is_incident_imminent"]) for r in tr]
        for j in range(len(self.features_list)):
            col=[x[j] for x in X]; self.means[j]=sum(col)/len(col); v=sum((q-self.means[j])**2 for q in col)/len(col); self.stds[j]=math.sqrt(v) if v>1e-4 else 1.0
        X=[[ (x[j]-self.means[j])/self.stds[j] for j in range(len(x))] for x in X]
        pos=sum(y); neg=len(y)-pos; pos_w=len(y)/(2*pos) if pos else 1; neg_w=len(y)/(2*neg) if neg else 1
        w=[0.0]*len(self.features_list); b=0.0; lr=.03
        for epoch in range(160):
            gw=[0.0]*len(w); gb=0.0
            for x,yi in zip(X,y):
                pr=self._sigmoid(sum(a*c for a,c in zip(x,w))+b); sw=pos_w if yi else neg_w; e=(pr-yi)*sw
                for j in range(len(w)): gw[j]+=e*x[j]
                gb+=e
            n=len(X)
            for j in range(len(w)): w[j]-=lr*(gw[j]/n + 0.001*w[j])
            b-=lr*gb/n
        self.weights={f:w[i] for i,f in enumerate(self.features_list)}; self.bias=b
        def probs(rows):
            return [self._sigmoid(sum(((r.get(f,0)-self.means[j])/self.stds[j])*w[j] for j,f in enumerate(self.features_list))+b) for r in rows]
        vp=probs(va); vy=[int(r["is_incident_imminent"]) for r in va]
        best=(0.5,-1,None)
        for t in [i/100 for i in range(20,81,2)]:
            m=self._metrics(vy,[int(q>=t) for q in vp])
            if m["f1"]>best[1]: best=(t,m["f1"],m)
        self.decision_threshold=best[0]
        train_m=self._metrics(y,[int(q>=self.decision_threshold) for q in probs(tr)])
        val_m=best[2]
        with open(os.path.join(save_dir,"model_params.json"),"w") as f:
            json.dump({"weights":self.weights,"bias":b,"means":self.means,"stds":self.stds,"anomaly_means":self.anomaly_means,"anomaly_stds":self.anomaly_stds,"decision_threshold":self.decision_threshold},f,indent=2)
        with open(os.path.join(save_dir,"model_metrics.json"),"w") as f:
            json.dump({"train":train_m,"validation":val_m,"decision_threshold":self.decision_threshold,"train_class_distribution":{"positive":pos,"negative":neg},"validation_class_distribution":{"positive":sum(vy),"negative":len(vy)-sum(vy)},"trained_at":datetime.now().isoformat(),"num_features":len(self.features_list)},f,indent=2)
        print(f"Models trained. Validation F1={val_m['f1']:.4f}, threshold={self.decision_threshold:.2f}")

    def load(self,save_dir):
        path=os.path.join(save_dir,"model_params.json")
        if not os.path.exists(path): return False
        with open(path) as f: d=json.load(f)
        self.weights=d["weights"]; self.bias=d["bias"]; self.means=d["means"]; self.stds=d["stds"]
        self.anomaly_means=d["anomaly_means"]; self.anomaly_stds=d["anomaly_stds"]; self.decision_threshold=d.get("decision_threshold",.5)
        return True

    def predict(self,features_dict):
        scaled=[(float(features_dict.get(f,0))-self.means[j])/self.stds[j] for j,f in enumerate(self.features_list)]
        prob=self._sigmoid(sum(scaled[j]*self.weights[f] for j,f in enumerate(self.features_list))+self.bias)
        zs=[abs((float(features_dict.get(f,0))-self.anomaly_means[f])/self.anomaly_stds[f]) for f in self.features_list]
        avg_z=sum(zs)/len(zs)
        anomaly_score=1.0-(1.0/(1.0+math.exp(-max(-20,min(20,avg_z-3.0)))))
        return prob, anomaly_score, self.predict_baseline(features_dict)
