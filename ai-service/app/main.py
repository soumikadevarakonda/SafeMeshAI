import os
import sqlite3
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from app.models import SafetyModels
from app.rag import LocalRAGEngine
from app.features import extract_features_from_state

app = FastAPI(title="SafeMesh AI Service", version="1.0.0")

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "backend", "dev.db")
MODELS_DIR = os.path.join(BASE_DIR, "ai-service", "models")

# Load models and RAG
models = SafetyModels()
models.load(MODELS_DIR)

rag = LocalRAGEngine()
rag.load_index(MODELS_DIR)

class PredictRequest(BaseModel):
    zone_id: str
    timestamp: str

class QueryRequest(BaseModel):
    query: str
    user_id: Optional[str] = None

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.get("/health")
def health():
    db_ok = False
    try:
        conn = get_db_connection()
        conn.execute("SELECT 1")
        conn.close()
        db_ok = True
    except Exception:
        pass
    
    return {
        "status": "healthy",
        "database": "connected" if db_ok else "disconnected",
        "models_loaded": models.rf_model is not None,
        "rag_indexed": len(rag.chunks) > 0
    }

@app.post("/predict")
def predict(req: PredictRequest):
    """
    Fuses sensors, permits, workers, and maintenance to evaluate compound risk in a zone.
    """
    try:
        conn = get_db_connection()
        
        # 1. Fetch current sensors in this zone
        cursor = conn.execute("SELECT * FROM Sensor WHERE zoneId = ?", (req.zone_id,))
        db_sensors = [dict(row) for row in cursor.fetchall()]
        
        # 2. Fetch recent sensor readings (last 30 mins)
        sensor_ids = [s["id"] for s in db_sensors]
        placeholders = ",".join("?" for _ in sensor_ids) if sensor_ids else "''"
        
        db_readings = []
        if sensor_ids:
            cursor = conn.execute(
                f"SELECT * FROM SensorReading WHERE sensorId IN ({placeholders}) ORDER BY timestamp DESC LIMIT 200",
                sensor_ids
            )
            db_readings = [dict(row) for row in cursor.fetchall()]

        # 3. Fetch active permits
        cursor = conn.execute("SELECT * FROM Permit")
        db_permits = [dict(row) for row in cursor.fetchall()]

        # 4. Fetch workers
        cursor = conn.execute("SELECT * FROM Worker")
        db_workers = [dict(row) for row in cursor.fetchall()]

        # 5. Fetch equipment status for maintenance checks
        cursor = conn.execute(
            "SELECT e.*, (SELECT status FROM MaintenanceRecord WHERE equipmentId = e.id ORDER BY scheduledDate DESC LIMIT 1) as maintenance_status "
            "FROM Equipment e WHERE zoneId = ?", 
            (req.zone_id,)
        )
        db_maintenance = [dict(row) for row in cursor.fetchall()]

        # 6. Fetch recent near misses
        cursor = conn.execute("SELECT * FROM NearMiss WHERE zoneId = ?", (req.zone_id,))
        db_near_misses = [dict(row) for row in cursor.fetchall()]

        conn.close()

        # Generate features
        features = extract_features_from_state(
            req.zone_id, req.timestamp, db_readings, db_permits, db_workers, db_maintenance, db_near_misses, db_sensors
        )

        # Run models
        incident_prob, anomaly_score, baseline_triggered = models.predict(features)

        # Rule Engine check
        rule_matches = []
        
        # Rule 1: Combustible Gas + Hot Work + Low Ventilation
        if features["combustible_gas_val"] >= 15.0 and features["has_hot_work"] == 1 and features["ventilation_val"] <= 70.0:
            rule_matches.append({
                "rule_id": "RULE-1",
                "name": "Combustible Gas + Hot Work + Low Ventilation",
                "description": f"Triggered: Gas level {features['combustible_gas_val']:.1f}% LEL >= 15.0% LEL, Hot work active, and ventilation efficiency {features['ventilation_val']:.1f}% <= 70.0%."
            })
            
        # Rule 2: Confined Space Entry + Oxygen Deficiency
        if features["has_confined_space"] == 1 and features["worker_count"] > 0 and features["oxygen_val"] <= 19.5:
            rule_matches.append({
                "rule_id": "RULE-2",
                "name": "Confined Space Entry + Oxygen Deficiency",
                "description": f"Triggered: Confined space active, {features['worker_count']} workers present, and oxygen level {features['oxygen_val']:.1f}% <= 19.5%."
            })

        # Rule 3: High Vibration + High Pressure + Overdue Maintenance
        if features["vibration_val"] >= 4.0 and features["pressure_val"] >= 150.0 and features["maintenance_overdue"] > 0:
            rule_matches.append({
                "rule_id": "RULE-3",
                "name": "High Vibration + High Pressure + Overdue Maintenance",
                "description": f"Triggered: Vibration {features['vibration_val']:.1f} mm/s >= 4.0 mm/s, pressure {features['pressure_val']:.1f} psi >= 150.0 psi, and {features['maintenance_overdue']} overdue maintenance."
            })

        # Risk Fusion calculation
        # Risk score 0-100
        base_score = incident_prob * 60 + anomaly_score * 20
        if rule_matches:
            # Rule violation forces high base score
            base_score = max(base_score, 65.0 + len(rule_matches) * 10)
            
        # Add factor weights based on worker presence and permits
        exposure_penalty = min(20.0, features["worker_exposure_duration"] * 0.15)
        risk_score = min(100.0, base_score + exposure_penalty)
        
        # If baseline triggered, minimum risk is Medium
        if baseline_triggered:
            risk_score = max(risk_score, 50.0)

        # Severity
        if risk_score >= 80.0:
            severity = "CRITICAL"
        elif risk_score >= 60.0:
            severity = "HIGH"
        elif risk_score >= 35.0:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        # Determine predicted incident
        predicted_incident = "Normal Operations"
        if risk_score >= 35.0:
            if features["combustible_gas_val"] > 10.0:
                predicted_incident = "Combustible Gas Ignition / Flash Fire"
            elif features["toxic_gas_val"] > 15.0 or features["oxygen_val"] < 19.5:
                predicted_incident = "Atmospheric Asphyxiation / Toxic Exposure"
            elif features["vibration_val"] > 4.0 or features["pressure_val"] > 120.0:
                predicted_incident = "Mechanical Line Rupture / Compressor Blowout"
            else:
                predicted_incident = "General Industrial Incident"

        # Warning lead time estimation (time to critical, proportional to slope and current score)
        lead_time = 0.0
        if severity in ["HIGH", "CRITICAL"]:
            lead_time = round(max(5.0, 90.0 - risk_score), 1) # 5 to 30 mins warning

        # Contributing Factors
        factors = []
        if features["combustible_gas_val"] > 5.0:
            factors.append({"factorName": "Gas Accumulation", "weight": round(features["combustible_gas_val"] / 40.0, 2)})
        if features["ventilation_val"] < 90.0:
            factors.append({"factorName": "Ventilation Degradation", "weight": round((100.0 - features["ventilation_val"]) / 100.0, 2)})
        if features["has_hot_work"] == 1:
            factors.append({"factorName": "Active Welding/Hot Work", "weight": 0.25})
        if features["worker_count"] > 0:
            factors.append({"factorName": "Worker Exposure", "weight": round(min(0.2, features["worker_count"] * 0.05), 2)})
        if features["maintenance_overdue"] > 0:
            factors.append({"factorName": "Overdue Maintenance", "weight": 0.15})

        # Recommended Interventions
        interventions = []
        if severity in ["HIGH", "CRITICAL"]:
            if features["has_hot_work"] == 1:
                interventions.append({
                    "title": "Suspend Hot Work Permit",
                    "description": "Immediately suspend active welding/cutting permits to eliminate ignition sources.",
                    "priority": "CRITICAL",
                    "reduction": 25.0
                })
            if features["worker_count"] > 0:
                interventions.append({
                    "title": "Evacuate Zone",
                    "description": "Evacuate all non-essential personnel from the affected zone.",
                    "priority": "CRITICAL",
                    "reduction": 20.0
                })
            if features["ventilation_val"] <= 75.0:
                interventions.append({
                    "title": "Activate Auxiliary Extraction Fans",
                    "description": "Dispatch team or trigger remote override to boost local ventilation systems.",
                    "priority": "HIGH",
                    "reduction": 15.0
                })
            interventions.append({
                "title": "Continuous Atmospheric Monitoring",
                "description": "Deploy safety crew with handheld detectors to cross-reference sensor values.",
                "priority": "MEDIUM",
                "reduction": 10.0
            })

        return {
            "zone_id": req.zone_id,
            "timestamp": req.timestamp,
            "riskScore": round(risk_score, 1),
            "severity": severity,
            "predictedIncident": predicted_incident,
            "confidence": round(0.70 + (incident_prob * 0.25), 2),
            "leadTime": lead_time,
            "baselineTriggered": bool(baseline_triggered),
            "ruleMatches": rule_matches,
            "factors": factors,
            "interventions": interventions,
            "features": features
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/copilot/query")
def copilot_query(req: QueryRequest):
    """
    RAG-grounded Safety Copilot query.
    Retrieves local documents and outputs deterministic summary.
    """
    try:
        # Retrieve relative RAG chunks
        chunks = rag.retrieve(req.query, k=3)
        
        # Fetch current status of plant for live context
        conn = get_db_connection()
        cursor = conn.execute("SELECT name, riskScore, riskSeverity FROM Zone WHERE riskScore > 15.0")
        active_risks = [dict(row) for row in cursor.fetchall()]
        
        cursor = conn.execute("SELECT count(*) as count FROM Worker WHERE status != 'OFF_DUTY'")
        active_workers = cursor.fetchone()["count"]
        
        cursor = conn.execute("SELECT count(*) as count FROM Permit WHERE status = 'ACTIVE'")
        active_permits = cursor.fetchone()["count"]
        conn.close()

        # Build grounded response text
        context_str = ""
        if active_risks:
            context_str += "Active elevated risks: " + ", ".join(f"{r['name']} ({r['riskSeverity']} - Score: {r['riskScore']})" for r in active_risks) + ". "
        else:
            context_str += "All plant zones report NORMAL risk levels. "
            
        context_str += f"Currently, {active_workers} workers are active on shift, and {active_permits} active permits are running."

        # Search retrieved text for references
        retrieved_text = ""
        sources = []
        for c in chunks:
            retrieved_text += f"\n- [{c['title']}]: {c['content']}\n"
            sources.append({
                "title": c["title"],
                "doc_id": c["doc_id"],
                "score": c["score"]
            })

        # Formulate grounded deterministic answer
        answer = f"**Live Context**: {context_str}\n\n"
        
        if "zone" in req.query.lower() or "dangerous" in req.query.lower() or "critical" in req.query.lower():
            if active_risks:
                highest = max(active_risks, key=lambda x: x["riskScore"])
                answer += f"The most dangerous zone right now is the **{highest['name']}** with a risk score of **{highest['riskScore']}** ({highest['riskSeverity']}). "
                if highest["name"] == "Coke Oven Battery":
                    answer += "This is driven by combustible gas accumulation and active hot work permits. "
            else:
                answer += "All plant zones are currently in normal operational states. "
        
        elif "permit" in req.query.lower() or "conflict" in req.query.lower():
            answer += "Our system monitors SIMOPS (Simultaneous Operations). Currently, any overlap between hot work (e.g. welding) and gas extraction areas with ventilation efficiency below 70% triggers a permit conflict safety hold. "
            if active_risks and any(r["name"] == "Coke Oven Battery" for r in active_risks):
                answer += "Specifically, a permit conflict exists in the Coke Oven Battery between the active Hot Work permit and degraded ventilation. "

        elif "intervention" in req.query.lower() or "what should we do" in req.query.lower() or "reduce risk" in req.query.lower():
            answer += "To reduce risk fastest: \n1. **Suspend hot work permits** in the affected high-risk zone (potential 25% risk reduction).\n2. **Evacuate exposed workers** (potential 20% risk reduction).\n3. **Initiate ventilation override** to clear gas pockets.\n"

        else:
            answer += "I am here to assist with safety protocols, SOP retrieval, and live plant risks. Let me know if you would like me to summarize the Coke Oven Battery operations or Confined Space Entry requirements. "

        if chunks:
            answer += f"\n\n**Safety SOP References**:\n{retrieved_text}"
        else:
            answer += "\n\nNo relevant SOP sections were retrieved for this specific query."

        # Add regulatory warning label
        answer += "\n\n*WARNING: SafeMesh AI Copilot is an operational aid retrieving synthetic demonstration data. This advice is NOT a substitute for official, authorized plant safety procedures or regulatory compliance documents.*"

        # Log query to DB
        conn = get_db_connection()
        conn.execute(
            "INSERT INTO CopilotQuery (id, queryText, responseText, sourcesJson, timestamp, userId) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), req.query, answer, json.dumps(sources), datetime.now().isoformat(), req.user_id)
        )
        conn.commit()
        conn.close()

        return {
            "answer": answer,
            "sources": sources,
            "confidence": 0.85 if chunks else 0.50
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train")
def trigger_train():
    try:
        train_path = os.path.join(BASE_DIR, "datasets", "splits", "compound_risk_train.csv")
        val_path = os.path.join(BASE_DIR, "datasets", "splits", "compound_risk_validation.csv")
        models.train(train_path, val_path, MODELS_DIR)
        models.load(MODELS_DIR)
        return {"status": "success", "message": "Models retrained and reloaded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rag/ingest")
def trigger_rag_ingest():
    try:
        docs_dir = os.path.join(BASE_DIR, "datasets", "rag-documents")
        rag.ingest_directory(docs_dir, MODELS_DIR)
        rag.load_index(MODELS_DIR)
        return {"status": "success", "message": "RAG documents re-ingested."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/evaluate")
def trigger_evaluate():
    try:
        from app.evaluation import run_evaluation_pipeline
        test_path = os.path.join(BASE_DIR, "datasets", "splits", "compound_risk_test.csv")
        report = run_evaluation_pipeline(test_path, MODELS_DIR, MODELS_DIR)
        
        # Write to DB
        if report:
            conn = get_db_connection()
            model_id = str(uuid.uuid4())
            # insert model version
            conn.execute(
                "INSERT INTO ModelVersion (id, modelName, version, path, trainedAt, metricsJson) VALUES (?, ?, ?, ?, ?, ?)",
                (model_id, "SafeMesh Hybrid Classifier", "v1.0.0", MODELS_DIR, datetime.now().isoformat(), json.dumps(report["compound"]))
            )
            # insert evaluation run
            eval_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO EvaluationRun (id, modelId, timestamp, metricsJson, confusionMatrixJson) VALUES (?, ?, ?, ?, ?)",
                (eval_id, model_id, datetime.now().isoformat(), json.dumps(report), json.dumps(report["compound"]["confusion_matrix"]))
            )
            # insert metrics
            for k, v in report["compound"].items():
                if isinstance(v, (int, float)):
                    conn.execute(
                        "INSERT INTO EvaluationMetric (id, evalRunId, metricName, metricValue) VALUES (?, ?, ?, ?)",
                        (str(uuid.uuid4()), eval_id, f"compound_{k}", float(v))
                    )
            conn.commit()
            conn.close()

        return {"status": "success", "metrics": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
