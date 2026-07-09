import { AnthropometricZScores } from "../types";

/**
 * Calculates a realistic approximation of WHO Child Growth Z-scores (HAZ, WHZ, WAZ)
 * along with 16+ engineered features as requested by the clinical protocol.
 */
export function calculateZScoresAndFeatures(
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
  wealthIndex: "Poorest" | "Poorer" | "Middle" | "Richer" | "Richest"
): AnthropometricZScores & { engineeredFeatures: { [key: string]: number | string } } {
  // Height-for-Age Z-score (HAZ) Reference
  // Average height: birth ~50cm, 12m ~75cm, 24m ~86cm, 36m ~95cm, 48m ~102cm, 59m ~110cm
  let medianHeight = 50.0;
  if (ageMonths <= 12) {
    medianHeight = 50.0 + 2.08 * ageMonths;
  } else if (ageMonths <= 24) {
    medianHeight = 75.0 + 0.92 * (ageMonths - 12);
  } else {
    medianHeight = 86.0 + 0.685 * (ageMonths - 24);
  }
  if (sex === "Female") medianHeight -= 1.2; // Girls are slightly shorter on average
  
  const heightSD = 3.5 + 0.03 * ageMonths; // Standard deviation grows with age
  const haz = (heightCm - medianHeight) / heightSD;

  // Weight-for-Age Z-score (WAZ) Reference
  // Average weight: birth ~3.3kg, 12m ~9.5kg, 24m ~12.2kg, 36m ~14.3kg, 48m ~16.3kg, 59m ~18.2kg
  let medianWeight = 3.3;
  if (ageMonths <= 12) {
    medianWeight = 3.3 + 0.52 * ageMonths;
  } else if (ageMonths <= 24) {
    medianWeight = 9.5 + 0.225 * (ageMonths - 12);
  } else {
    medianWeight = 12.2 + 0.17 * (ageMonths - 24);
  }
  if (sex === "Female") medianWeight -= 0.5;
  
  const weightSD = 1.0 + 0.08 * ageMonths;
  const waz = (weightKg - medianWeight) / weightSD;

  // Weight-for-Height Z-score (WHZ) Reference
  // Standard WHZ calculation based on expected weight for height
  let expectedWeightForHeight = 3.0 + 0.2 * (heightCm - 48.0);
  if (heightCm > 85) {
    expectedWeightForHeight = 11.5 + 0.25 * (heightCm - 85.0);
  }
  if (sex === "Female") expectedWeightForHeight -= 0.4;
  const whzSD = 0.8 + 0.02 * (heightCm - 45);
  const whz = (weightKg - expectedWeightForHeight) / whzSD;

  // BMI Calculation
  const heightM = heightCm / 100;
  const bmi = heightM > 0 ? weightKg / (heightM * heightM) : 0;

  // 1. WeightHeightRatio
  const weightHeightRatio = heightCm > 0 ? weightKg / heightCm : 0;

  // 2. AgeWeightInteraction
  const ageWeightInteraction = ageMonths * weightKg;

  // 3. AgeHeightInteraction
  const ageHeightInteraction = ageMonths * heightCm;

  // 4. RecentMorbidityCount (diarrhea, fever, cough recent)
  const recentMorbidityCount = (diarrheaRecent ? 1 : 0) + (feverRecent ? 1 : 0) + (coughRecent ? 1 : 0);

  // 5. HealthRiskScore
  let healthRiskScore = recentMorbidityCount * 1.5;
  if (oedema) healthRiskScore += 4.0; // Oedema is extreme emergency
  if (whz < -3) healthRiskScore += 3.0;
  if (haz < -3) healthRiskScore += 1.5;

  // 6. NutritionRiskScore
  let nutritionRiskScore = 0;
  if (!breastfeeding && ageMonths < 24) nutritionRiskScore += 2.0;
  if (!vitaminA) nutritionRiskScore += 1.0;
  if (maternalEducation === "None") nutritionRiskScore += 1.5;
  if (maternalEducation === "Primary") nutritionRiskScore += 0.8;
  if (wealthIndex === "Poorest") nutritionRiskScore += 2.0;
  if (wealthIndex === "Poorer") nutritionRiskScore += 1.2;

  // 7. HeightAgeRatio
  const heightAgeRatio = ageMonths > 0 ? heightCm / ageMonths : heightCm;

  // 8. WeightAgeRatio
  const weightAgeRatio = ageMonths > 0 ? weightKg / ageMonths : weightKg;

  // 9. BMIAgeRatio
  const bmiAgeRatio = ageMonths > 0 ? bmi / ageMonths : bmi;

  // 10. MaternalSocioEconomicIndex
  const eduWeight = { None: 0, Primary: 1, Secondary: 2, Higher: 3 };
  const wealthWeight = { Poorest: 0, Poorer: 1, Middle: 2, Richer: 3, Richest: 4 };
  const maternalSocioEconomicIndex = eduWeight[maternalEducation] + wealthWeight[wealthIndex];

  // 11. OedemaWeightImpact
  const oedemaWeightImpact = (oedema ? 1 : 0) * weightKg;

  // 12. StuntingRiskIndex
  const stuntingRiskIndex = Math.max(0, -haz * 2.5 + (nutritionRiskScore * 0.5));

  // 13. WastingRiskIndex
  const wastingRiskIndex = Math.max(0, -whz * 3.0 + (healthRiskScore * 0.7));

  // 14. UnderweightRiskIndex
  const underweightRiskIndex = Math.max(0, -waz * 2.8 + (nutritionRiskScore * 0.4 + healthRiskScore * 0.4));

  // 15. VulnerabilityIndex
  const vulnerabilityIndex = (stuntingRiskIndex + wastingRiskIndex + underweightRiskIndex) / 3.0;

  // 16. MuacHeightRatio (estimated MUAC as 110 + 1.2*age + weight_factor if muac not provided)
  const estimatedMuac = 115 + 0.8 * ageMonths + (whz * 5.0);
  const muacHeightRatio = estimatedMuac / heightCm;

  const engineeredFeatures = {
    WeightHeightRatio: parseFloat(weightHeightRatio.toFixed(4)),
    AgeWeightInteraction: parseFloat(ageWeightInteraction.toFixed(2)),
    AgeHeightInteraction: parseFloat(ageHeightInteraction.toFixed(2)),
    RecentMorbidityCount: recentMorbidityCount,
    HealthRiskScore: parseFloat(healthRiskScore.toFixed(2)),
    NutritionRiskScore: parseFloat(nutritionRiskScore.toFixed(2)),
    HeightAgeRatio: parseFloat(heightAgeRatio.toFixed(4)),
    WeightAgeRatio: parseFloat(weightAgeRatio.toFixed(4)),
    BMIAgeRatio: parseFloat(bmiAgeRatio.toFixed(4)),
    MaternalSocioEconomicIndex: maternalSocioEconomicIndex,
    OedemaWeightImpact: parseFloat(oedemaWeightImpact.toFixed(2)),
    StuntingRiskIndex: parseFloat(stuntingRiskIndex.toFixed(2)),
    WastingRiskIndex: parseFloat(wastingRiskIndex.toFixed(2)),
    UnderweightRiskIndex: parseFloat(underweightRiskIndex.toFixed(2)),
    VulnerabilityIndex: parseFloat(vulnerabilityIndex.toFixed(2)),
    MuacHeightRatio: parseFloat(muacHeightRatio.toFixed(4)),
    EstimatedMuac: parseFloat(estimatedMuac.toFixed(1))
  };

  return {
    haz: parseFloat(haz.toFixed(2)),
    whz: parseFloat(whz.toFixed(2)),
    waz: parseFloat(waz.toFixed(2)),
    bmi: parseFloat(bmi.toFixed(2)),
    weightHeightRatio: parseFloat(weightHeightRatio.toFixed(4)),
    ageWeightInteraction: parseFloat(ageWeightInteraction.toFixed(2)),
    ageHeightInteraction: parseFloat(ageHeightInteraction.toFixed(2)),
    healthRiskScore: parseFloat(healthRiskScore.toFixed(2)),
    nutritionRiskScore: parseFloat(nutritionRiskScore.toFixed(2)),
    engineeredFeatures
  };
}
