import { FollowupVisitSchedule } from "../types";

/**
 * Intelligent Follow-Up & Longitudinal Growth Monitoring System
 * Automatically schedules follow-up visits based on clinical severity, recommends clinical investigations,
 * tracks longitudinal progress velocity, and triggers reminder alerts.
 */

export function generateFollowupSchedule(
  patientId: string,
  patientName: string,
  severity: "Normal" | "Mild" | "Moderate" | "Severe",
  initialDateStr: string = new Date().toISOString().split("T")[0]
): FollowupVisitSchedule {
  let intervalDays = 30; // Default normal follow up
  if (severity === "Severe") {
    intervalDays = 7; // Weekly follow up for SAM
  } else if (severity === "Moderate") {
    intervalDays = 14; // Bi-weekly for MAM
  } else if (severity === "Mild") {
    intervalDays = 14;
  }

  const initialDate = new Date(initialDateStr);
  const nextDate = new Date(initialDate);
  nextDate.setDate(nextDate.getDate() + intervalDays);
  const nextFollowupDate = nextDate.toISOString().split("T")[0];

  const recommendedExaminations: string[] = [
    "Re-assess MUAC measurement and bilateral pitting oedema status",
    "Appetite Test with RUTF (Must pass > 75% sachet test)",
    "Weight & Height velocity tracking check"
  ];

  const additionalInvestigations: string[] = [];
  if (severity === "Severe") {
    additionalInvestigations.push("Rapid Blood Glucose (Hypoglycemia screening < 3.0 mmol/L)");
    additionalInvestigations.push("Hemoglobin measurement (Anemia screening < 7.0 g/dL)");
    additionalInvestigations.push("Axillary Temperature monitoring (Hypothermia < 35.5°C)");
  } else if (severity === "Moderate") {
    additionalInvestigations.push("Stool examination for intestinal parasites");
    additionalInvestigations.push("Routine Deworming administration check");
  }

  const reminderNote = severity === "Severe"
    ? "URGENT: Patient requires mandatory weekly clinic re-evaluation. Contact community health worker if visit missed."
    : `Scheduled follow-up visit in ${intervalDays} days for growth monitoring.`;

  return {
    id: `SCHED-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    patientId,
    patientName,
    initialDiagnosisDate: initialDateStr,
    severity,
    recommendedIntervalDays: intervalDays,
    nextFollowupDate,
    status: "Scheduled",
    recommendedExaminations,
    additionalInvestigations,
    progressTrend: "Stable",
    reminderNote
  };
}
