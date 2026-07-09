-- Yemen Child Malnutrition Prediction Platform
-- Enterprise PostgreSQL Offline Synchronization Database Schema
-- Optimizations for Low-Resource, High-Latency Remote Synchronization

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLINICIAN / USER REGISTRY
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('Administrator', 'Doctor', 'Nurse')),
    facility VARCHAR(150) NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. DEVICE REGISTRY
CREATE TABLE IF NOT EXISTS device_registry (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    device_model VARCHAR(100),
    os_version VARCHAR(50),
    app_version VARCHAR(20) DEFAULT 'v2.4.0',
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Suspended', 'Decommissioned'))
);

-- 3. PATIENTS TABLE
CREATE TABLE IF NOT EXISTS patients (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- Stored encrypted at rest in high-sensitivity environments
    parent_name VARCHAR(255) NOT NULL,
    age_months INT NOT NULL CHECK (age_months BETWEEN 0 AND 120),
    sex VARCHAR(10) NOT NULL CHECK (sex IN ('Male', 'Female')),
    date_of_birth DATE,
    residence_type VARCHAR(20) CHECK (residence_type IN ('Urban', 'Rural')),
    maternal_education VARCHAR(30) CHECK (maternal_education IN ('None', 'Primary', 'Secondary', 'Higher')),
    wealth_index VARCHAR(20) CHECK (wealth_index IN ('Poorest', 'Poorer', 'Middle', 'Richer', 'Richest')),
    contact_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(50) REFERENCES device_registry(id) ON DELETE SET NULL,
    server_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for speedy searching
CREATE INDEX idx_patients_sex ON patients(sex);
CREATE INDEX idx_patients_created ON patients(created_at);

-- 4. MEASUREMENTS TABLE
CREATE TABLE IF NOT EXISTS measurements (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    weight_kg NUMERIC(5,2) NOT NULL CHECK (weight_kg > 0),
    height_cm NUMERIC(5,2) NOT NULL CHECK (height_cm > 0),
    oedema BOOLEAN NOT NULL DEFAULT FALSE,
    breastfeeding BOOLEAN NOT NULL DEFAULT TRUE,
    vitamin_a BOOLEAN NOT NULL DEFAULT FALSE,
    diarrhea_recent BOOLEAN NOT NULL DEFAULT FALSE,
    fever_recent BOOLEAN NOT NULL DEFAULT FALSE,
    cough_recent BOOLEAN NOT NULL DEFAULT FALSE,
    muac_mm INT CHECK (muac_mm BETWEEN 50 AND 300),
    recorded_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(50) REFERENCES device_registry(id) ON DELETE SET NULL,
    server_synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_measurements_patient ON measurements(patient_id);
CREATE INDEX idx_measurements_date ON measurements(date);

-- 5. MALNUTRITION PREDICTIONS TABLE (XGBoost Outputs)
CREATE TABLE IF NOT EXISTS predictions (
    id VARCHAR(50) PRIMARY KEY,
    patient_id VARCHAR(50) REFERENCES patients(id) ON DELETE CASCADE,
    measurement_id VARCHAR(50) REFERENCES measurements(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    stunting_probability NUMERIC(5,4) NOT NULL,
    stunting_risk_percentage NUMERIC(5,2) NOT NULL,
    stunting_severity VARCHAR(20) NOT NULL CHECK (stunting_severity IN ('Normal', 'Mild', 'Moderate', 'Severe')),
    
    wasting_probability NUMERIC(5,4) NOT NULL,
    wasting_risk_percentage NUMERIC(5,2) NOT NULL,
    wasting_severity VARCHAR(20) NOT NULL CHECK (wasting_severity IN ('Normal', 'Mild', 'Moderate', 'Severe')),
    
    underweight_probability NUMERIC(5,4) NOT NULL,
    underweight_risk_percentage NUMERIC(5,2) NOT NULL,
    underweight_severity VARCHAR(20) NOT NULL CHECK (underweight_severity IN ('Normal', 'Mild', 'Moderate', 'Severe')),
    
    engineered_features JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(50) REFERENCES device_registry(id) ON DELETE SET NULL
);

-- 6. CLINICAL RECOMMENDATIONS TABLE (WHO RAG Outputs)
CREATE TABLE IF NOT EXISTS recommendations (
    id VARCHAR(50) PRIMARY KEY,
    prediction_id VARCHAR(50) REFERENCES predictions(id) ON DELETE CASCADE,
    diagnosis TEXT NOT NULL,
    diagnosis_ar TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('Normal', 'Mild', 'Moderate', 'Severe')),
    recommended_intervention TEXT NOT NULL,
    recommended_intervention_ar TEXT NOT NULL,
    referral_need VARCHAR(50) NOT NULL CHECK (referral_need IN ('None', 'Outpatient Care', 'Inpatient SAM Stabilization', 'Immediate Emergency Referral')),
    referral_need_ar VARCHAR(100) NOT NULL,
    evidence_source TEXT,
    who_reference VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR(50) REFERENCES device_registry(id) ON DELETE SET NULL
);

-- 7. SYNCHRONIZATION AUDIT LOGS (sync_logs)
CREATE TABLE IF NOT EXISTS sync_logs (
    id VARCHAR(50) PRIMARY KEY,
    device_id VARCHAR(50) REFERENCES device_registry(id) ON DELETE SET NULL,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sync_type VARCHAR(20) NOT NULL CHECK (sync_type IN ('Upload', 'Download', 'KnowledgeBase')),
    records_synced INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Success', 'Failed')),
    details TEXT
);

CREATE INDEX idx_sync_logs_device ON sync_logs(device_id);
CREATE INDEX idx_sync_logs_timestamp ON sync_logs(timestamp);

-- 8. OFFLINE RECORDS PERSISTENCE (For central audit of devices with pending queues)
CREATE TABLE IF NOT EXISTS offline_records (
    id VARCHAR(50) PRIMARY KEY,
    device_id VARCHAR(50) REFERENCES device_registry(id) ON DELETE CASCADE,
    record_type VARCHAR(30) NOT NULL CHECK (record_type IN ('patient', 'measurement', 'prediction', 'recommendation')),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    retry_count INT DEFAULT 0,
    last_error TEXT,
    server_received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. UPLOAD HISTORY FOR DUPLICATE PREVENTION (upload_history)
CREATE TABLE IF NOT EXISTS upload_history (
    id VARCHAR(50) PRIMARY KEY,
    device_id VARCHAR(50) REFERENCES device_registry(id) ON DELETE CASCADE,
    record_id VARCHAR(50) NOT NULL,
    record_type VARCHAR(30) NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'Success' CHECK (status IN ('Success', 'Failed')),
    CONSTRAINT unique_device_record UNIQUE (device_id, record_id)
);

CREATE INDEX idx_upload_history_lookup ON upload_history(device_id, record_id);

-- 10. CRITICAL CLINICAL AUDIT TRAIL (audit_logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    details TEXT NOT NULL,
    client_ip VARCHAR(50),
    device_id VARCHAR(50) REFERENCES device_registry(id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
