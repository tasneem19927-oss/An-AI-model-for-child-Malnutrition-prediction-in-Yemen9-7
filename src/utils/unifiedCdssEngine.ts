import { UnifiedCdssDecision } from "../types";
import { calibrateProbability } from "./calibration";
import { predictStackingEnsemble } from "./stackingModel";

/**
 * Unified Clinical Decision Engine (CDSS)
 * Combines WHO Guidelines (Hard Constraints) with AI Machine Learning Predictions (Soft Priors).
 * Ensures safety, consistency, and conflict resolution before outputting finalized clinical recommendations.
 */

export function evaluateUnifiedCdss(
  patientId: string,
  rawWastingProbability: number,
  rawStuntingProbability: number,
  rawUnderweightProbability: number,
  weightKg: number,
  heightCm: number,
  muacMm: number | undefined,
  oedema: boolean,
  features: Record<string, number>,
  reMeasurementVerified: boolean = false
): UnifiedCdssDecision {
  // 1. Evaluate Hard Constraints based on WHO Child Growth Protocols
  const hardConstraints = [
    {
      ruleName: "WHO Bilateral Pitting Oedema Rule",
      conditionMet: oedema === true,
      mandatoryAction: "Immediate Inpatient SAM Stabilization Referral required due to high fluid retention risk.",
      overridePriority: "Critical" as const
    },
    {
      ruleName: "WHO MUAC Acute Wasting Threshold (< 115 mm)",
      conditionMet: muacMm !== undefined && muacMm < 115,
      mandatoryAction: "Severe Acute Malnutrition (SAM) confirmed by MUAC. Mandatory second nurse re-measurement required.",
      overridePriority: "Critical" as const
    },
    {
      ruleName: "WHO Weight-for-Height Z-Score Threshold (WHZ < -3.0)",
      conditionMet: (features.whz ?? 0) <= -3.0,
      mandatoryAction: "Severe Acute Malnutrition (SAM) confirmed by anthropometric Z-score.",
      overridePriority: "High" as const
    },
    {
      ruleName: "WHO MUAC Moderate Wasting Threshold (115 - 124 mm)",
      conditionMet: muacMm !== undefined && muacMm >= 115 && muacMm <= 124,
      mandatoryAction: "Moderate Acute Malnutrition (MAM) confirmed by MUAC. Enroll in Outpatient Supplementary Feeding Program (TSFP).",
      overridePriority: "Standard" as const
    }
  ];

  // 2. Evaluate Soft Priors (ML Predictions with Stacking & Calibration)
  const stackedWasting = predictStackingEnsemble(rawWastingProbability, features);
  const calibratedWasting = calibrateProbability(stackedWasting.metaStackingProbability);

  let softPriorSeverity: "Normal" | "Mild" | "Moderate" | "Severe" = "Normal";
  const p = calibratedWasting.selectedProbability;
  if (p >= 0.70) softPriorSeverity = "Severe";
  else if (p >= 0.40) softPriorSeverity = "Moderate";
  else if (p >= 0.20) softPriorSeverity = "Mild";

  // 3. Check Consistency & Resolve Conflicts
  const samHardConstraintTriggered = hardConstraints.some(c => c.conditionMet && c.overridePriority === "Critical");
  const mamHardConstraintTriggered = hardConstraints.some(c => c.conditionMet && c.overridePriority === "Standard");

  let isConsistent = true;
  let conflictExplanation: string | undefined = undefined;
  let finalSeverity: "Normal" | "Mild" | "Moderate" | "Severe" = softPriorSeverity;

  if (samHardConstraintTriggered) {
    finalSeverity = "Severe";
    if (softPriorSeverity !== "Severe") {
      isConsistent = false;
      conflictExplanation = `CRITICAL OVERRIDE: Machine learning soft prior predicted ${softPriorSeverity} wasting (${(p * 100).toFixed(1)}%), but WHO Hard Constraint rule (Oedema or MUAC < 115mm) strictly mandates SAM classification to prevent clinical risk.`;
    }
  } else if (mamHardConstraintTriggered && (softPriorSeverity === "Normal" || softPriorSeverity === "Mild")) {
    finalSeverity = "Moderate";
    isConsistent = false;
    conflictExplanation = `OVERRIDE: WHO Hard Constraint rule (MUAC 115-124mm) classifies child as Moderate Acute Malnutrition (MAM), overriding lower ML soft prior score.`;
  }

  // 4. Require SAM double-check verification if SAM is flagged
  let verifiedStatus = reMeasurementVerified;
  if (finalSeverity === "Severe" && muacMm !== undefined && muacMm < 115 && !reMeasurementVerified) {
    verifiedStatus = false;
  }

  // 5. Generate Evidence-Based Clinical Interventions
  const recommendedInterventions: string[] = [];
  const recommendedInterventionsAr: string[] = [];

  if (finalSeverity === "Severe") {
    if (oedema) {
      recommendedInterventions.push("Admit to Inpatient Stabilization Center (TFC). Administer F-75 therapeutic milk strictly (130 mL/kg/day). Avoid RUTF during initial phase.");
      recommendedInterventionsAr.push("التنويم في مركز التغذية العلاجية للمستشفيات (TFC). التغذية بحليب F-75 حصرياً (130 مل/كجم/يوم). تجنب RUTF في المرحلة الأولى.");
    } else {
      recommendedInterventions.push("Enroll in Outpatient Therapeutic Program (OTP). Provide weight-scaled Ready-to-Use Therapeutic Food (RUTF) (150-200 kcal/kg/day) and Amoxicillin course.");
      recommendedInterventionsAr.push("الالتزام ببرنامج العلاج الخارجي (OTP). صرف وجبات RUTF حسب الوزن (150-200 سعرة/كجم/يوم) مع كورس أموكسيسيلين.");
    }
  } else if (finalSeverity === "Moderate") {
    recommendedInterventions.push("Enroll in Targeted Supplementary Feeding Program (TSFP). Provide Super Cereal Plus / RUSF and Deworming medication.");
    recommendedInterventionsAr.push("التسجيل في برنامج التغذية التكملية (TSFP). صرف الأغذية التكميلية وجرعة طارد الديدان.");
  } else {
    recommendedInterventions.push("Normal growth trajectory. Provide standard maternal infant and young child feeding (IYCF) counseling and routine vitamin A.");
    recommendedInterventionsAr.push("نمو طبيعي. تقديم مشورة التغذية التكميلية القياسية للأم وإعطاء فيتامين أ الدوري.");
  }

  let referralStatus: UnifiedCdssDecision["referralStatus"] = "None";
  if (finalSeverity === "Severe") {
    referralStatus = oedema ? "Inpatient SAM Stabilization" : "Outpatient Care";
  } else if (finalSeverity === "Moderate") {
    referralStatus = "Outpatient Care";
  }

  // Final Diagnosis Strings
  let finalDiagnosis = "Normal child growth parameters";
  let finalDiagnosisAr = "مؤشرات نمو الطفل طبيعية";
  if (finalSeverity === "Severe") {
    finalDiagnosis = "Severe Acute Malnutrition (SAM)";
    finalDiagnosisAr = "سوء التغذية الحاد الشديد (SAM)";
  } else if (finalSeverity === "Moderate") {
    finalDiagnosis = "Moderate Acute Malnutrition (MAM)";
    finalDiagnosisAr = "سوء التغذية الحاد المتوسط (MAM)";
  } else if (finalSeverity === "Mild") {
    finalDiagnosis = "Mild Acute Malnutrition / Growth Faltering";
    finalDiagnosisAr = "سوء تغذية خفيف / تباطؤ النمو";
  }

  return {
    patientId,
    hardConstraints,
    softPriorProbability: p,
    softPriorSeverity,
    isConsistent,
    conflictExplanation,
    finalDiagnosis,
    finalDiagnosisAr,
    finalSeverity,
    recommendedInterventions,
    recommendedInterventionsAr,
    referralStatus,
    reMeasurementVerified: verifiedStatus
  };
}
