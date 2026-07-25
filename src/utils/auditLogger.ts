import { AuditLog } from "../types";
import { indexedDbService } from "./indexedDbService";

/**
 * Clinical Governance Audit Logging Service
 * Persists immutable trace records for every AI prediction, CDSS rule trigger, clinical decision,
 * evidence citation, and user action for compliance, transparency, and regulatory auditing.
 */

export class ClinicalAuditLogger {
  private memoryLogs: AuditLog[] = [];

  public async logEvent(
    userEmail: string,
    role: string,
    action: string,
    details: string,
    meta?: {
      patientId?: string;
      modelVersion?: string;
      evidenceIds?: string[];
      ruleTriggered?: string;
      decisionOutcome?: string;
    }
  ): Promise<AuditLog> {
    const entry: AuditLog = {
      id: `AUDIT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      userId: userEmail || "system",
      userEmail: userEmail || "system@mophp.gov.ye",
      role: role || "Nurse",
      action,
      timestamp: new Date().toISOString(),
      details,
      patientId: meta?.patientId,
      modelVersion: meta?.modelVersion || "XGBoost-TFLite-v2.4.0",
      evidenceIds: meta?.evidenceIds,
      ruleTriggered: meta?.ruleTriggered,
      decisionOutcome: meta?.decisionOutcome
    };

    this.memoryLogs.unshift(entry);

    try {
      await indexedDbService.saveAuditLog(entry);
    } catch (err) {
      console.warn("IndexedDB audit log save fallback:", err);
    }

    return entry;
  }

  public getMemoryLogs(): AuditLog[] {
    return this.memoryLogs;
  }
}

export const clinicalAuditLogger = new ClinicalAuditLogger();
