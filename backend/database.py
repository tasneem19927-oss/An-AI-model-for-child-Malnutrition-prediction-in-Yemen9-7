import os
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/malnutrition_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UserModel(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    role = Column(String, nullable=False)  # Admin, Doctor, Nurse
    facility = Column(String, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class PatientModel(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    parent_name = Column(String, nullable=False)
    age_months = Column(Integer, nullable=False)
    sex = Column(String, nullable=False)  # Male, Female
    date_of_birth = Column(String, nullable=True)
    residence_type = Column(String, default="Rural")  # Rural, Urban
    maternal_education = Column(String, default="None")
    wealth_index = Column(String, default="Poorest")
    contact_number = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    measurements = relationship("MeasurementModel", back_populates="patient", cascade="all, delete-orphan")

class MeasurementModel(Base):
    __tablename__ = "measurements"

    id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)
    weight_kg = Column(Float, nullable=False)
    height_cm = Column(Float, nullable=False)
    muac_mm = Column(Float, nullable=True)
    oedema = Column(Boolean, default=False)
    breastfeeding = Column(Boolean, default=True)
    vitamin_a = Column(Boolean, default=True)
    diarrhea_recent = Column(Boolean, default=False)
    fever_recent = Column(Boolean, default=False)
    cough_recent = Column(Boolean, default=False)
    recorded_by = Column(String, nullable=False)
    symptoms = Column(Text, nullable=True)
    clinical_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("PatientModel", back_populates="measurements")
    predictions = relationship("PredictionModel", back_populates="measurement", cascade="all, delete-orphan")

class PredictionModel(Base):
    __tablename__ = "predictions"

    id = Column(String, primary_key=True, index=True)
    patient_id = Column(String, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    measurement_id = Column(String, ForeignKey("measurements.id", ondelete="CASCADE"), nullable=False)
    date = Column(String, nullable=False)
    
    # Severe/Moderate/Normal statuses from XGBoost
    stunting_severity = Column(String, default="Normal")
    stunting_risk = Column(Float, default=0.0)
    wasting_severity = Column(String, default="Normal")
    wasting_risk = Column(Float, default=0.0)
    underweight_severity = Column(String, default="Normal")
    underweight_risk = Column(Float, default=0.0)
    
    # Metadata
    confidence_score = Column(Float, default=90.0)
    health_risk_score = Column(Float, default=0.0)
    nutrition_risk_score = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    measurement = relationship("MeasurementModel", back_populates="predictions")
    recommendations = relationship("RecommendationModel", back_populates="prediction", cascade="all, delete-orphan")

class RecommendationModel(Base):
    __tablename__ = "recommendations"

    id = Column(String, primary_key=True, index=True)
    prediction_id = Column(String, ForeignKey("predictions.id", ondelete="CASCADE"), nullable=False)
    diagnosis = Column(Text, nullable=False)
    diagnosis_ar = Column(Text, nullable=False)
    severity = Column(String, default="Normal")
    recommended_intervention = Column(Text, nullable=False)
    recommended_intervention_ar = Column(Text, nullable=False)
    referral_need = Column(String, default="None")
    referral_need_ar = Column(String, default="None")
    evidence_source = Column(String, nullable=True)
    who_reference = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    prediction = relationship("PredictionModel", back_populates="recommendations")

class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False)
    user_email = Column(String, nullable=False)
    role = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)
