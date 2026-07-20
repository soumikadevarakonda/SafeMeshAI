import sys
import os
import json
import sqlite3
import argparse
from datetime import datetime

# Include app directory in path for helper imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.features import extract_features_from_state
from app.models import SafetyModels
from app.safety_officer import AISafetyOfficer

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zone", required=True)
    parser.add_argument("--timestamp", required=True)
    parser.add_argument("--cctv_image", required=False, default=None)
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(base_dir, "backend", "dev.db")
    models_dir = os.path.join(base_dir, "ai-service", "models")

    # Connect to SQLite
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    # Fetch states
    cursor = conn.execute(
    "SELECT * FROM Sensor WHERE zoneId = ?",
    (args.zone,)
)
    db_sensors = [dict(row) for row in cursor.fetchall()]

    sensor_ids = [s["id"] for s in db_sensors]
    placeholders = ",".join("?" for _ in sensor_ids) if sensor_ids else "''"
    
    db_readings = []
    if sensor_ids:
        cursor = conn.execute(
            f"SELECT * FROM SensorReading WHERE sensorId IN ({placeholders}) ORDER BY timestamp DESC LIMIT 200",
            sensor_ids
        )
        db_readings = [dict(row) for row in cursor.fetchall()]

    cursor = conn.execute("SELECT * FROM Permit")
    db_permits = [dict(row) for row in cursor.fetchall()]

    cursor = conn.execute("SELECT * FROM Worker")
    db_workers = [dict(row) for row in cursor.fetchall()]

    cursor = conn.execute(
    "SELECT * FROM Equipment WHERE zoneId = ?",
    (args.zone,)
)
    db_equip = [dict(row) for row in cursor.fetchall()]
    
    db_maintenance = []
    for eq in db_equip:
        cursor = conn.execute("SELECT status FROM MaintenanceRecord WHERE equipmentId = ? ORDER BY scheduledDate DESC LIMIT 1", (eq["id"],))
        m_row = cursor.fetchone()
        db_maintenance.append({
            "id": eq["id"],
            "zone_id": args.zone,
            "status": eq["status"],
            "maintenance_status": m_row["status"] if m_row else "NORMAL",
            "health_score": eq["healthScore"]
        })

    cursor = conn.execute(
    "SELECT * FROM NearMiss WHERE zoneId = ?",
    (args.zone,)
)
    db_near_misses = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Extract features
    features = extract_features_from_state(
        args.zone, args.timestamp, db_readings, db_permits, db_workers, db_maintenance, db_near_misses, db_sensors
    )

    # Initialize and load model
    models = SafetyModels()
    models.load(models_dir)
    
    # Predict
    incident_prob, anomaly_score, baseline_triggered = models.predict(features)

    # Rules Engine
    rule_matches = []
    if features["combustible_gas_val"] >= 15.0 and features["has_hot_work"] == 1 and features["ventilation_val"] <= 70.0:
        rule_matches.append({
            "rule_id": "RULE-1",
            "name": "Combustible Gas + Hot Work + Low Ventilation",
            "description": f"Triggered: Gas level {features['combustible_gas_val']:.1f}% LEL >= 15.0% LEL, Hot work active, and ventilation efficiency {features['ventilation_val']:.1f}% <= 70.0%."
        })
        
    if features["has_confined_space"] == 1 and features["worker_count"] > 0 and features["oxygen_val"] <= 19.5:
        rule_matches.append({
            "rule_id": "RULE-2",
            "name": "Confined Space Entry + Oxygen Deficiency",
            "description": f"Triggered: Confined space active, {features['worker_count']} workers present, and oxygen level {features['oxygen_val']:.1f}% <= 19.5%."
        })

    if features["vibration_val"] >= 4.0 and features["pressure_val"] >= 150.0 and features["maintenance_overdue"] > 0:
        rule_matches.append({
            "rule_id": "RULE-3",
            "name": "High Vibration + High Pressure + Overdue Maintenance",
            "description": f"Triggered: Vibration {features['vibration_val']:.1f} mm/s >= 4.0 mm/s, pressure {features['pressure_val']:.1f} psi >= 150.0 psi, and {features['maintenance_overdue']} overdue maintenance."
        })

    # Risk Fusion
    base_score = incident_prob * 60 + anomaly_score * 20
    if rule_matches:
        base_score = max(base_score, 65.0 + len(rule_matches) * 10)
        
    exposure_penalty = min(20.0, features["worker_exposure_duration"] * 0.15)
    risk_score = min(100.0, base_score + exposure_penalty)
    
    if baseline_triggered:
        risk_score = max(risk_score, 50.0)

    if risk_score >= 80.0:
        severity = "CRITICAL"
    elif risk_score >= 60.0:
        severity = "HIGH"
    elif risk_score >= 35.0:
        severity = "MEDIUM"
    else:
        severity = "LOW"

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

    lead_time = 0.0
    if severity in ["HIGH", "CRITICAL"]:
        lead_time = round(max(5.0, 90.0 - risk_score), 1)

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

    output = {
        "zone_id": args.zone,
        "timestamp": args.timestamp,
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

    # Run AI Safety Officer Decision Layer with Vision Intelligence
    officer = AISafetyOfficer(models_dir)
    enriched_output = officer.observe_and_decide(args.zone, features, output, image_input=args.cctv_image)

    print(json.dumps(enriched_output))

if __name__ == "__main__":
    main()
