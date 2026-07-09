import pytest
from fastapi.testclient import TestClient
from backend.main import app, calculate_zscores, predict_malnutrition_xgboost

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert "Yemen" in response.json()["service"]

def test_z_score_calculations():
    # Test child z-scores with severe wasting parameters
    haz, waz, whz = calculate_zscores(18, "Male", 7.5, 78)
    assert haz == (78 - 76.0) / 3.0
    assert waz == (7.5 - 9.5) / 1.1
    assert whz == ((7.5 / 0.78) - 9.8) / 1.0

def test_xgboost_classifier_logic():
    # Test normal child
    pred = predict_malnutrition_xgboost(18, "Male", 10.5, 78, 135, False)
    assert pred["wasting_severity"] == "Normal"
    
    # Test severe wasting via MUAC
    pred_severe = predict_malnutrition_xgboost(18, "Male", 7.5, 78, 110, False)
    assert pred_severe["wasting_severity"] == "Severe"
    assert pred_severe["wasting_risk"] == 92.0

    # Test severe wasting via Oedema
    pred_oedema = predict_malnutrition_xgboost(18, "Male", 10.5, 78, 135, True)
    assert pred_oedema["wasting_severity"] == "Severe"
    assert pred_oedema["wasting_risk"] == 99.5

def test_sync_service():
    payload = {
        "patients": [
            {
                "name": "Ibrahim Al-Alimi",
                "parent_name": "Hamid Al-Alimi",
                "age_months": 22,
                "sex": "Male",
                "residence_type": "Rural",
                "maternal_education": "Primary",
                "wealth_index": "Poorer"
            }
        ],
        "measurements": [
            {
                "patient_id": "PAT-TEMP-001",
                "weight_kg": 9.2,
                "height_cm": 81.0,
                "muac_mm": 125,
                "oedema": False,
                "breastfeeding": False,
                "vitamin_a": True,
                "diarrhea_recent": False,
                "fever_recent": False,
                "cough_recent": False,
                "recorded_by": "Nurse Fatima Al-Asiri"
            }
        ],
        "user_email": "nurse.reem@gmail.com",
        "user_role": "Nurse"
    }
    # Test sync offline queue data injection
    response = client.post("/api/sync", json=payload)
    assert response.status_code == 200
    assert response.json()["success"] is True
