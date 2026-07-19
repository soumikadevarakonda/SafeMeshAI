import os
import sys

# Include root folder in python search path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.safety_officer import AISafetyOfficer

def test_safety_officer_decision():
    print("Testing AI Safety Officer Decision Layer...")
    
    # Configure safety officer
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    models_dir = os.path.join(base_dir, "models")
    
    officer = AISafetyOfficer(models_dir)
    
    # Mock active hazard features (combustible gas + hot work + low ventilation)
    mock_features = {
        "combustible_gas_val": 19.5,
        "combustible_gas_slope_30m": 0.05, # rising
        "ventilation_val": 58.0,
        "ventilation_slope_30m": -0.02, # deteriorating
        "oxygen_val": 20.9,
        "active_permits": 1,
        "has_hot_work": 1,
        "has_confined_space": 0,
        "worker_count": 2,
        "worker_exposure_duration": 45.0,
        "maintenance_overdue": 1,
        "equipment_health_avg": 68.0,
        "recent_near_miss_count": 0,
        "shift_change": 0
    }
    
    # Mock prediction output
    mock_pred = {
        "riskScore": 88.0,
        "severity": "CRITICAL",
        "predictedIncident": "Combustible Gas Ignition / Flash Fire",
        "confidence": 0.92,
        "leadTime": 15.0,
        "baselineTriggered": False,
        "ruleMatches": [],
        "factors": [],
        "interventions": [],
        "features": mock_features
    }
    
    # Run Safety Officer assessment
    decision_obj = officer.observe_and_decide("ZONE-COB", mock_features, mock_pred)
    
    # Assert Decision Object keys
    assert "incidentSummary" in decision_obj
    assert "observations" in decision_obj
    assert "reasoning" in decision_obj
    assert "recommendations" in decision_obj
    assert "similarIncidents" in decision_obj
    assert "regulatoryReferences" in decision_obj
    
    # Assert specific reasoning details
    assert decision_obj["severity"] == "CRITICAL"
    assert "Visakhapatnam" in decision_obj["observations"] or "Visakhapatnam" in decision_obj["reasoning"] or len(decision_obj["similarIncidents"]) > 0
    assert any(ref["doc_id"] == "SOP-COB-01" and ref["status"] == "VIOLATION" for ref in decision_obj["regulatoryReferences"])
    
    print("AI Safety Officer tests passed successfully!")

if __name__ == "__main__":
    test_safety_officer_decision()
