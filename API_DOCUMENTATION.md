# API Gateway & Interface Specifications

This document defines the REST API endpoints, transactional structures, and data contracts for the Child Malnutrition CDSS backend. All network traffic is exchanged as standard JSON over HTTPS.

---

## 1. Authentication & Identity Management

### `POST /api/auth/login`
Validates clinician credentials against the authorized health database registry.

*   **Request Payload:**
    ```json
    {
      "email": "nurse.reem@gmail.com",
      "password": "password"
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "success": true,
      "user": {
        "id": "USR-003",
        "name": "Nurse Reem Alyousufi",
        "email": "nurse.reem@gmail.com",
        "role": "Nurse",
        "facility": "Al-Sabeen Maternal & Child Hospital, Sana'a",
        "active": true
      }
    }
    ```
*   **Error Response (`401 Unauthorized`):**
    ```json
    {
      "success": false,
      "message": "Authorized email not found in Yemen health database registry."
    }
    ```

### `POST /api/users/register`
Saves or updates a newly registered clinician profile (such as users authenticated via Google OAuth).

*   **Request Payload:**
    ```json
    {
      "id": "USR-GOOGLE9812",
      "name": "Dr. Ahmed Mansour",
      "email": "ahmed.mansour.ye@gmail.com",
      "role": "Doctor",
      "facility": "Google Authenticated Clinic Unit",
      "active": true
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "success": true,
      "user": {
        "id": "USR-GOOGLE9812",
        "name": "Dr. Ahmed Mansour",
        "email": "ahmed.mansour.ye@gmail.com",
        "role": "Doctor",
        "facility": "Google Authenticated Clinic Unit",
        "active": true
      }
    }
    ```

---

## 2. Patient Registration and Lifecycle

### `POST /api/patients`
Registers a new infant patient in the demographic registry.

*   **Headers:**
    *   `x-user-id`: Auditable identifier of the logged-in clinician.
    *   `x-user-email`: Clinician email for audit verification.
*   **Request Payload:**
    ```json
    {
      "name": "Youssef Al-Haddad",
      "ageMonths": 18,
      "sex": "Male",
      "governorate": "Sana'a City",
      "district": "Al-Wahdah",
      "village": "Haddah",
      "caregiverName": "Fatima Al-Haddad",
      "caregiverPhone": "+967771234567",
      "maternalEducation": "Secondary",
      "wealthIndex": "Poorest"
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "success": true,
      "patient": {
        "id": "PAT-H3Y7K1P",
        "name": "Youssef Al-Haddad",
        "ageMonths": 18,
        "sex": "Male",
        "governorate": "Sana'a City",
        "district": "Al-Wahdah",
        "village": "Haddah",
        "caregiverName": "Fatima Al-Haddad",
        "caregiverPhone": "+967771234567",
        "maternalEducation": "Secondary",
        "wealthIndex": "Poorest",
        "createdAt": "2026-07-01T12:00:00.000Z"
      }
    }
    ```

---

## 3. Diagnostic Anthropometrics & Prediction

### `POST /api/measurements`
Submits a set of anthropometric measurements. This endpoint calculates WHO growth Z-scores, runs the 3-model XGBoost ensemble predictor, and executes the clinical RAG pipeline to generate localized intervention steps.

*   **Request Payload:**
    ```json
    {
      "patientId": "PAT-H3Y7K1P",
      "weightKg": 7.8,
      "heightCm": 74.5,
      "muacMm": 112,
      "oedema": false,
      "breastfeeding": true,
      "vitaminA": true,
      "diarrheaRecent": true,
      "feverRecent": false,
      "coughRecent": true
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "success": true,
      "measurement": {
        "id": "MEA-9P2D7J",
        "patientId": "PAT-H3Y7K1P",
        "date": "2026-07-01",
        "weightKg": 7.8,
        "heightCm": 74.5,
        "muacMm": 112,
        "oedema": false,
        "breastfeeding": true,
        "vitaminA": true,
        "diarrheaRecent": true,
        "feverRecent": false,
        "coughRecent": true,
        "haz": -2.4,
        "whz": -1.8,
        "waz": -2.1,
        "bmi": 14.0,
        "weightHeightRatio": 0.105,
        "createdAt": "2026-07-01T12:05:00.000Z"
      },
      "prediction": {
        "id": "PRED-2K4N5V",
        "stunting": {
          "probability": 0.824,
          "riskPercentage": 82,
          "severityClass": "Moderate",
          "confidenceScore": 88
        },
        "wasting": {
          "probability": 0.589,
          "riskPercentage": 59,
          "severityClass": "Normal",
          "confidenceScore": 84
        },
        "underweight": {
          "probability": 0.742,
          "riskPercentage": 74,
          "severityClass": "Moderate",
          "confidenceScore": 86
        }
      },
      "recommendation": {
        "id": "REC-7T3Y9M",
        "interventionTier": "MAM-Outpatient",
        "evidenceText": "According to the Yemen MoPHP 2021 Integrated Management of Childhood Illness (IMCI) guidelines, the child has Moderate Acute Malnutrition (MAM) with concurrent stunting risk...",
        "procedures": [
          "Administer supplementary therapeutic food rations (Supplementary Feeding Programme - SFP).",
          "Conduct family counseling on hygiene, sanitation, and dietary diversification.",
          "Schedule follow-up appointment in 14 days."
        ]
      }
    }
    ```

---

## 4. NLP Extraction & RAG Search

### `POST /api/ner/extract`
Parses raw clinical narrative text to extract structured demographic, morbidity, and anthropometric metrics.

*   **Request Payload:**
    ```json
    {
      "notes": "Infant is 14 months old. Weight is logged at 8.2kg. Arm circumference is 114mm. Shows signs of acute diarrhea and fever. Mother states primary school completed."
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "success": true,
      "extracted": {
        "ageMonths": 14,
        "weightKg": 8.2,
        "heightCm": null,
        "muacMm": 114,
        "diarrhea": true,
        "fever": true,
        "cough": false,
        "oedema": false,
        "maternalEducation": "Primary"
      }
    }
    ```

---

## 5. Bidirectional Sync Protocols

### `POST /api/sync/bulk`
Processes and registers a queued list of offline-registered clinical entities. It runs last-write-wins (LWW) conflict resolution logic and triggers XGBoost calculations to keep metrics in sync.

*   **Request Payload:**
    ```json
    {
      "deviceId": "DEV-FIELD-01",
      "deviceName": "Samsung Galaxy Tab Active 3",
      "patients": [
        {
          "id": "PAT-OFF123",
          "name": "Omar Al-Qubati",
          "ageMonths": 24,
          "sex": "Male",
          "governorate": "Taiz",
          "district": "Al-Qahirah",
          "maternalEducation": "Primary",
          "wealthIndex": "Poorer"
        }
      ],
      "measurements": [
        {
          "id": "MEA-OFF456",
          "patientId": "PAT-OFF123",
          "weightKg": 9.1,
          "heightCm": 82.0,
          "muacMm": 120,
          "oedema": false,
          "breastfeeding": false,
          "vitaminA": true,
          "diarrheaRecent": false,
          "feverRecent": true,
          "coughRecent": false
        }
      ]
    }
    ```
*   **Success Response (`200 OK`):**
    ```json
    {
      "success": true,
      "results": {
        "patientsUploaded": 1,
        "measurementsUploaded": 1,
        "predictionsSynchronized": 1,
        "recommendationsSynchronized": 1
      }
    }
    ```
