export type UserRole = "Administrator" | "Doctor" | "Nurse";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  facility: string;
  active: boolean;
}

export interface Patient {
  id: string;
  name: string;
  parentName: string;
  ageMonths: number;
  sex: "Male" | "Female";
  dateOfBirth: string;
  residenceType: "Urban" | "Rural";
  maternalEducation: "None" | "Primary" | "Secondary" | "Higher";
  wealthIndex: "Poorest" | "Poorer" | "Middle" | "Richer" | "Richest";
  contactNumber: string;
  createdAt: string;
}

export interface Measurement {
  id: string;
  patientId: string;
  date: string;
  weightKg: number;
  heightCm: number;
  oedema: boolean;
  breastfeeding: boolean;
  vitaminA: boolean;
  diarrheaRecent: boolean;
  feverRecent: boolean;
  coughRecent: boolean;
  muacMm?: number;
  recordedBy: string;
  createdAt: string;
}

export interface AnthropometricZScores {
  haz: number; // Height-for-Age Z-score
  whz: number; // Weight-for-Height Z-score
  waz: number; // Weight-for-Age Z-score
  bmi: number;
  weightHeightRatio: number;
  ageWeightInteraction: number;
  ageHeightInteraction: number;
  healthRiskScore: number;
  nutritionRiskScore: number;
}

export interface PredictionDetail {
  probability: number;
  riskPercentage: number;
  severityClass: "Normal" | "Mild" | "Moderate" | "Severe";
  confidenceScore: number;
}

export interface MalnutritionPrediction {
  id: string;
  patientId: string;
  measurementId: string;
  date: string;
  stunting: PredictionDetail;
  wasting: PredictionDetail;
  underweight: PredictionDetail;
  engineeredFeatures: { [key: string]: number | string };
  createdAt: string;
}

export interface ScientificReference {
  id: string;
  title: string;
  titleAr?: string;
  authors: string;
  organization: string;
  year: number;
  abstract: string;
  abstractAr?: string;
  clinicalSummary: string;
  clinicalSummaryAr?: string;
  keywords: string[];
  citation: string;
  sourceUrl: string;
  approvedByAdmin: boolean;
  approvedByDoctor: boolean;
  doi?: string;
  category?: string;
  priority?: "Critical" | "High" | "Medium" | "Low" | string;
  language?: "English" | "Arabic" | "Bilingual" | string;
  status?: "Active" | "Draft" | "Archived" | string;
}

export interface NEREntity {
  text: string;
  entityType: "DISEASE" | "SYMPTOM" | "TREATMENT" | "MEASUREMENT" | "NUTRIENT" | "DEMOGRAPHIC";
  confidence: number;
  startPos: number;
  endPos: number;
}

export interface ClinicalRecommendation {
  id: string;
  predictionId: string;
  diagnosis: string;
  diagnosisAr: string;
  severity: "Normal" | "Mild" | "Moderate" | "Severe";
  recommendedIntervention: string;
  recommendedInterventionAr: string;
  referralNeed: "None" | "Outpatient Care" | "Inpatient SAM Stabilization" | "Immediate Emergency Referral";
  referralNeedAr: string;
  evidenceSource: string;
  whoReference: string;
  createdAt: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  type: "Upload" | "Download" | "KnowledgeBase";
  recordsSynced: number;
  status: "Success" | "Failed";
  details?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  role: string;
  action: string;
  timestamp: string;
  details: string;
}
