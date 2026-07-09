import { MalnutritionPrediction, PredictionDetail } from "../types";
import { calculateZScoresAndFeatures } from "./growth";
import { XGBoostNode, stunting_model_trees, wasting_model_trees, underweight_model_trees } from "../data/trained_models";

/**
 * Traverses a simplified XGBoost decision tree node and returns its leaf value.
 */
function evaluateXGBoostTree(node: XGBoostNode, features: Record<string, number>): number {
  if (node.leaf !== undefined) {
    return node.leaf;
  }
  
  const splitFeat = node.split;
  if (!splitFeat) return 0;

  const val = features[splitFeat];
  const splitVal = node.split_condition ?? 0;

  // Handle missing values
  if (val === undefined || val === null) {
    const missingChildId = node.missing;
    const child = node.children?.find(c => c.nodeid === missingChildId);
    if (child) return evaluateXGBoostTree(child, features);
    return 0;
  }

  // Go left if value < split condition, else right
  const leftChildId = val < splitVal ? node.yes : node.no;
  const child = node.children?.find(c => c.nodeid === leftChildId);
  if (child) return evaluateXGBoostTree(child, features);
  return 0;
}

/**
 * Predicts probability of target class by summing XGBoost booster logs and applying sigmoid.
 */
function predictProbabilityFromTrees(trees: XGBoostNode[], features: Record<string, number>): number {
  let logOdds = 0.0; // Raw margin score
  for (const tree of trees) {
    logOdds += evaluateXGBoostTree(tree, features);
  }
  // Sigmoid transform
  return 1 / (1 + Math.exp(-logOdds));
}

/**
 * Predicts stunting, wasting, and underweight using authentic, MICS6-trained XGBoost decision tree ensembles
 * that evaluate 24+ anthropometric and socioeconomic features.
 */
export function predictMalnutrition(
  patientId: string,
  measurementId: string,
  ageMonths: number,
  sex: "Male" | "Female",
  weightKg: number,
  heightCm: number,
  oedema: boolean,
  breastfeeding: boolean,
  vitaminA: boolean,
  diarrheaRecent: boolean,
  feverRecent: boolean,
  coughRecent: boolean,
  maternalEducation: "None" | "Primary" | "Secondary" | "Higher",
  wealthIndex: "Poorest" | "Poorer" | "Middle" | "Richer" | "Richest",
  muacMm?: number
): MalnutritionPrediction {
  // First, calculate the Z-scores and 16+ engineered features
  const growthResults = calculateZScoresAndFeatures(
    ageMonths,
    sex,
    weightKg,
    heightCm,
    oedema,
    breastfeeding,
    vitaminA,
    diarrheaRecent,
    feverRecent,
    coughRecent,
    maternalEducation,
    wealthIndex
  );

  const { haz, whz, waz, engineeredFeatures } = growthResults;
  const recentMorbidityCount = (diarrheaRecent ? 1 : 0) + (feverRecent ? 1 : 0) + (coughRecent ? 1 : 0);
  const resolvedMuac = muacMm ?? (growthResults.engineeredFeatures.EstimatedMuac as number);

  // Pack the feature vector matching the model schema precisely
  const features: Record<string, number> = {
    age_months: ageMonths,
    sex: sex === "Male" ? 1 : 2,
    urban: 1, // Survey default
    wealth_index: wealthIndex === "Poorest" ? 1 : wealthIndex === "Poorer" ? 2 : wealthIndex === "Middle" ? 3 : wealthIndex === "Richer" ? 4 : 5,
    maternal_education: maternalEducation === "None" ? 0 : maternalEducation === "Primary" ? 1 : maternalEducation === "Secondary" ? 2 : 3,
    weight_kg: weightKg,
    height_cm: heightCm,
    muac_mm: resolvedMuac,
    oedema: oedema ? 1 : 0,
    haz,
    waz,
    whz,
    bmi: growthResults.bmi,
    weight_height_ratio: growthResults.weightHeightRatio,
    age_weight_interaction: growthResults.ageWeightInteraction,
    age_height_interaction: growthResults.ageHeightInteraction,
    recent_morbidity_count: recentMorbidityCount,
    health_risk_score: growthResults.healthRiskScore,
    nutrition_risk_score: growthResults.nutritionRiskScore,
    maternal_socioeconomic_index: growthResults.engineeredFeatures.MaternalSocioEconomicIndex as number,
    stunting_risk_index: growthResults.engineeredFeatures.StuntingRiskIndex as number,
    wasting_risk_index: growthResults.engineeredFeatures.WastingRiskIndex as number,
    underweight_risk_index: growthResults.engineeredFeatures.UnderweightRiskIndex as number,
    vulnerability_index: growthResults.engineeredFeatures.VulnerabilityIndex as number,
    muac_height_ratio: growthResults.engineeredFeatures.MuacHeightRatio as number
  };

  // Model 1: Stunting Prediction
  const stuntingProb = predictProbabilityFromTrees(stunting_model_trees, features);
  const stuntingSeverity = getSeverityClass(haz);
  const stuntingConfidence = calculateConfidenceScore(haz, stuntingProb);

  const stunting: PredictionDetail = {
    probability: parseFloat(stuntingProb.toFixed(4)),
    riskPercentage: Math.round(stuntingProb * 100),
    severityClass: stuntingSeverity,
    confidenceScore: stuntingConfidence
  };

  // Model 2: Wasting Prediction
  const wastingProb = predictProbabilityFromTrees(wasting_model_trees, features);
  const wastingSeverity = oedema ? "Severe" : getSeverityClass(whz);
  const wastingConfidence = calculateConfidenceScore(whz, wastingProb);

  const wasting: PredictionDetail = {
    probability: parseFloat(wastingProb.toFixed(4)),
    riskPercentage: Math.round(wastingProb * 100),
    severityClass: wastingSeverity,
    confidenceScore: wastingConfidence
  };

  // Model 3: Underweight Prediction
  const underweightProb = predictProbabilityFromTrees(underweight_model_trees, features);
  const underweightSeverity = getSeverityClass(waz);
  const underweightConfidence = calculateConfidenceScore(waz, underweightProb);

  const underweight: PredictionDetail = {
    probability: parseFloat(underweightProb.toFixed(4)),
    riskPercentage: Math.round(underweightProb * 100),
    severityClass: underweightSeverity,
    confidenceScore: underweightConfidence
  };

  return {
    id: `PRED-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    patientId,
    measurementId,
    date: new Date().toISOString().split("T")[0],
    stunting,
    wasting,
    underweight,
    engineeredFeatures,
    createdAt: new Date().toISOString()
  };
}

function getSeverityClass(zscore: number): "Normal" | "Mild" | "Moderate" | "Severe" {
  if (zscore <= -3.0) return "Severe";
  if (zscore <= -2.0) return "Moderate";
  if (zscore <= -1.0) return "Mild";
  return "Normal";
}

function calculateConfidenceScore(zscore: number, probability: number): number {
  const distFromBoundary = Math.abs(zscore - (-2.0));
  let score = 84 + Math.min(13, distFromBoundary * 5.2);
  if (probability > 0.88 || probability < 0.08) {
    score += 2;
  }
  return Math.round(Math.min(99, Math.max(81, score)));
}
