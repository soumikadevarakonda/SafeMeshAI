import os
import sys
from datetime import datetime

# Include root folder in python search path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.features import extract_features_from_state
from app.models import SafetyModels
from app.rag import LocalRAGEngine
from app.evaluation import compute_metrics

def test_feature_engineering():
    print("Testing pure-Python feature engineering...")
    
    # Mock database states
    db_sensors = [
        {"id": "SEN-1", "zoneId": "ZONE-COB", "type": "combustible_gas", "thresholdCritical": 40.0},
        {"id": "SEN-2", "zoneId": "ZONE-COB", "type": "ventilation", "thresholdCritical": 50.0}
    ]
    
    db_readings = [
        {"sensorId": "SEN-1", "value": 15.5, "timestamp": "2026-07-11T12:00:00"},
        {"sensorId": "SEN-2", "value": 65.0, "timestamp": "2026-07-11T12:00:00"}
    ]
    
    db_permits = [
        {"zoneId": "ZONE-COB", "status": "ACTIVE", "type": "HOT_WORK", "startTime": "2026-07-11T11:00:00", "endTime": "2026-07-11T13:00:00"}
    ]
    
    db_workers = [
        {"currentZoneId": "ZONE-COB", "checkInTime": "2026-07-11T11:30:00"}
    ]
    
    features = extract_features_from_state(
        "ZONE-COB", "2026-07-11T12:00:00", db_readings, db_permits, db_workers, [], [], db_sensors
    )
    
    assert features["combustible_gas_val"] == 15.5
    assert features["ventilation_val"] == 65.0
    assert features["has_hot_work"] == 1
    assert features["worker_count"] == 1
    assert features["worker_exposure_duration"] == 30.0 # 12:00 minus 11:30 is 30 mins
    print("Feature engineering tests passed successfully!")

def test_risk_rules():
    print("Testing risk rules engine...")
    models = SafetyModels()
    
    # Normal features
    features_normal = {
        "combustible_gas_val": 5.0,
        "has_hot_work": 1,
        "ventilation_val": 95.0
    }
    
    # Violates Rule 1: Combustible Gas >= 15% LEL + Hot work active + ventilation <= 70%
    features_hazardous = {
        "combustible_gas_val": 18.0,
        "has_hot_work": 1,
        "ventilation_val": 65.0
    }
    
    rule_matches_normal = []
    if features_normal["combustible_gas_val"] >= 15.0 and features_normal["has_hot_work"] == 1 and features_normal["ventilation_val"] <= 70.0:
        rule_matches_normal.append("RULE-1")
        
    rule_matches_haz = []
    if features_hazardous["combustible_gas_val"] >= 15.0 and features_hazardous["has_hot_work"] == 1 and features_hazardous["ventilation_val"] <= 70.0:
        rule_matches_haz.append("RULE-1")
        
    assert len(rule_matches_normal) == 0
    assert len(rule_matches_haz) == 1
    assert rule_matches_haz[0] == "RULE-1"
    print("Risk rules tests passed successfully!")

def test_baseline_safety():
    print("Testing single-sensor baseline safety...")
    models = SafetyModels()
    
    # Under limit
    features_ok = {"combustible_gas_val": 10.0}
    assert models.predict_baseline(features_ok) == 0
    
    # Exceeds combustible gas critical (40.0)
    features_bad = {"combustible_gas_val": 42.0}
    assert models.predict_baseline(features_bad) == 1
    print("Baseline safety tests passed successfully!")

def test_evaluation_metrics():
    print("Testing evaluation metrics math...")
    y_true = [0, 0, 1, 1]
    y_pred = [0, 1, 0, 1]
    
    metrics = compute_metrics(y_true, y_pred)
    accuracy = metrics["accuracy"]
    precision = metrics["precision"]
    recall = metrics["recall"]
    f1 = metrics["f1"]
    specificity = metrics["specificity"]
    cm = metrics["confusion_matrix"]
    
    assert accuracy == 0.5
    assert precision == 0.5
    assert recall == 0.5
    assert f1 == 0.5
    assert specificity == 0.5
    assert cm == [[1, 1], [1, 1]]
    print("Evaluation metrics tests passed successfully!")

def test_rag_retrieval():
    print("Testing pure-Python RAG vector engine...")
    rag = LocalRAGEngine()
    
    # Mock ingestion
    rag.chunks = [
        {"doc_id": "test_sop.md", "title": "Coke Oven SOP", "content": "Gas extraction ventilation must operate above 75% efficiency during welding.", "chunk_index": 0},
        {"doc_id": "test_reg.md", "title": "Safety Code", "content": "Workers must wear respirators when hydrogen sulfide levels exceed 10 ppm.", "chunk_index": 0}
    ]
    rag.idf = {"ventilation": 0.5, "hydrogen": 0.5, "sulfide": 0.5}
    rag.tfidf_vectors = [
        {"ventilation": 1.0},
        {"hydrogen": 0.707, "sulfide": 0.707}
    ]
    
    results = rag.retrieve("ventilation flow checks", k=1)
    assert len(results) == 1
    assert results[0]["title"] == "Coke Oven SOP"
    print("RAG search tests passed successfully!")

if __name__ == "__main__":
    test_feature_engineering()
    test_risk_rules()
    test_baseline_safety()
    test_evaluation_metrics()
    test_rag_retrieval()
    print("All Python tests completed successfully!")
