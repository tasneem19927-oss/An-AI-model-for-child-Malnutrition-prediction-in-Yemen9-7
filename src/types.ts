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
  patientId?: string;
  modelVersion?: string;
  evidenceIds?: string[];
  ruleTriggered?: string;
  decisionOutcome?: string;
  previousHash?: string;
  hash?: string;
}

export interface CalibrationResult {
  rawProbability: number;
  plattProbability: number;
  isotonicProbability: number;
  selectedProbability: number;
  selectedMethod: "Platt" | "Isotonic";
  brierScorePlatt: number;
  brierScoreIsotonic: number;
  expectedCalibrationError: number;
}

export interface StackingPredictionResult {
  xgboostProbability: number;
  randomForestProxyProbability: number;
  logisticRegressionProxyProbability: number;
  metaStackingProbability: number;
  statisticallySignificantGain: boolean;
  aucImprovement: number;
}

export interface MuacVisionAnalysis {
  detectedMuacMm: number;
  colorBand: "Red" | "Yellow" | "Green";
  category: "SAM" | "MAM" | "Normal";
  confidence: number;
  tapeBoundingBox: { x: number; y: number; width: number; height: number };
  markerReadingsMm: number[];
  reMeasurementRequired: boolean;
  notes: string;
}

export interface EdgeBenchmarkMetrics {
  inferenceLatencyMs: number;
  memoryUsageMb: number;
  cpuUsagePct: number;
  batteryDrainPer1kPct: number;
  modelStorageKb: number;
  deviceProfile: "Low-End Android (2GB RAM)" | "Mid-Range Android (4GB RAM)" | "Edge Workstation";
  fps: number;
}

export interface RagBenchmarkMetrics {
  retrievalAccuracy: number;
  recallAtK: number;
  precisionAtK: number;
  meanReciprocalRank: number; // MRR
  ndcgScore: number; // nDCG
  answerFaithfulness: number;
  groundednessScore: number;
  evaluatedQueriesCount: number;
}

export interface ConfusionMatrixMetrics {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1Score: number;
  sensitivity: number;
  specificity: number;
  mcc: number;
}

export interface UnifiedCdssDecision {
  patientId: string;
  hardConstraints: {
    ruleName: string;
    conditionMet: boolean;
    mandatoryAction?: string;
    overridePriority: "Critical" | "High" | "Standard";
  }[];
  softPriorProbability: number;
  softPriorSeverity: "Normal" | "Mild" | "Moderate" | "Severe";
  isConsistent: boolean;
  conflictExplanation?: string;
  finalDiagnosis: string;
  finalDiagnosisAr: string;
  finalSeverity: "Normal" | "Mild" | "Moderate" | "Severe";
  recommendedInterventions: string[];
  recommendedInterventionsAr: string[];
  referralStatus: "None" | "Outpatient Care" | "Inpatient SAM Stabilization" | "Immediate Emergency Referral";
  reMeasurementVerified?: boolean;
}

export interface FollowupVisitSchedule {
  id: string;
  patientId: string;
  patientName: string;
  initialDiagnosisDate: string;
  severity: "Normal" | "Mild" | "Moderate" | "Severe";
  recommendedIntervalDays: number;
  nextFollowupDate: string;
  status: "Scheduled" | "Completed" | "Overdue";
  recommendedExaminations: string[];
  additionalInvestigations: string[];
  progressTrend: "Improving" | "Stable" | "Deteriorating";
  reminderNote: string;
}

export type AlertType =
  | "Critical Clinical"
  | "Decision Support"
  | "AI Confidence"
  | "Knowledge-Based"
  | "Follow-up"
  | "System";

export type AlertSeverity = "Critical" | "High" | "Medium" | "Low";

export type AlertResolutionStatus = "Active" | "Acknowledged" | "Dismissed" | "Resolved";

export interface ClinicalAlert {
  id: string;
  patientId?: string;
  patientName?: string;
  timestamp: string;
  alertType: AlertType;
  severity: AlertSeverity;
  triggerReason: string;
  triggerReasonAr?: string;
  clinicalExplanation: string;
  clinicalExplanationAr?: string;
  recommendedAction: string;
  recommendedActionAr?: string;
  supportingEvidence?: string;
  whoGuidelineRef?: string;
  aiConfidenceScore?: number;
  status: AlertResolutionStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  persistent: boolean;
  categoryTag: string;
}

