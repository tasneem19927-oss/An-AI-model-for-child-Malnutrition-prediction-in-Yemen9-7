import { ClinicalAlert, AlertType, AlertSeverity, AlertResolutionStatus, Patient, Measurement, MalnutritionPrediction, UnifiedCdssDecision, FollowupVisitSchedule } from "../types";
import { indexedDbService } from "./indexedDbService";
import { clinicalAuditLogger } from "./auditLogger";

export type AlertSubscriber = (alerts: ClinicalAlert[]) => void;

/**
 * Centralized Clinical Alert Engine
 * Evaluates patient records, anthropometric measurements, machine learning predictions,
 * unified CDSS guidelines, follow-up schedules, and system synchronization status in real-time.
 */
export class ClinicalAlertEngine {
  private alerts: Map<string, ClinicalAlert> = new Map();
  private subscribers: Set<AlertSubscriber> = new Set();
  private audioEnabled: boolean = true;
  private vibrationEnabled: boolean = true;
  private initialized: boolean = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (typeof window === "undefined") return;
    try {
      // Load saved alerts from IndexedDB
      const savedAlerts = await indexedDbService.getAlerts();
      if (savedAlerts && savedAlerts.length > 0) {
        for (const alert of savedAlerts) {
          this.alerts.set(alert.id, alert);
        }
      } else {
        // Seed default representative clinical alerts for immediate demonstration
        this.seedInitialAlerts();
      }
      this.initialized = true;
      this.notifySubscribers();
    } catch (err) {
      console.warn("Failed to load alerts from IndexedDB, seeding fallback alerts:", err);
      this.seedInitialAlerts();
      this.notifySubscribers();
    }
  }

  /**
   * Seed initial realistic clinical & system alerts for immediate UI visibility
   */
  private seedInitialAlerts() {
    const defaultAlerts: ClinicalAlert[] = [
      {
        id: "ALT-CRIT-001",
        patientId: "PAT-YEM-8902",
        patientName: "Tariq Mansoor",
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        alertType: "Critical Clinical",
        severity: "Critical",
        triggerReason: "Bilateral Pitting Edema & MUAC < 110mm Detected",
        triggerReasonAr: "وجود وذمة انطباعية وقياس محيط الذراع أقل من 110 مم",
        clinicalExplanation: "Child presents +++ bilateral pitting edema (Kwashiorkor) with extreme muscle wasting. High risk of cardiac overload and electrolyte imbalance.",
        clinicalExplanationAr: "الطفل يعاني من وذمة انطباعية شديدة (+3) مع ضمور عضلي حاد. خطر مرتفع للإصابة باضطراب الشوارد وفشل القلب.",
        recommendedAction: "IMMEDIATE INPATIENT REFERRAL to Stabilization Center (TFC). Administer F-75 therapeutic milk (130 mL/kg/day). DO NOT give RUTF in Phase 1.",
        recommendedActionAr: "الإحالة الفورية للتنويم في مركز التغذية العلاجية (TFC). إعطاء حليب F-75 المخصص (130 مل/كجم/يوم). يمنع استخدام RUTF في المرحلة الأولى.",
        supportingEvidence: "WHO Child Malnutrition Guidelines Section 4.2 (Inpatient Management of SAM with Complications)",
        whoGuidelineRef: "WHO/NMH/NHD/13.2",
        aiConfidenceScore: 0.98,
        status: "Active",
        persistent: true,
        categoryTag: "Kwashiorkor & SAM"
      },
      {
        id: "ALT-DEC-002",
        patientId: "PAT-YEM-4410",
        patientName: "Fatima Al-Houthi",
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        alertType: "Decision Support",
        severity: "High",
        triggerReason: "Mandatory Re-Measurement Required for MUAC < 115mm",
        triggerReasonAr: "يتطلب إعادة قياس محيط الذراع إجبارياً للقيم أقل من 115 مم",
        clinicalExplanation: "Initial MUAC tape reading was 112mm. National WHO protocol mandates a second independent verification by a lead nurse before SAM enrollment.",
        clinicalExplanationAr: "القراءة الأولية لشريط قياس الذراع كانت 112 مم. البروتوكول الوطني يفرض التحقق إجبارياً بواسطة ممرض رئيسي قبل تسجيل الحالة.",
        recommendedAction: "Perform second MUAC measurement using validated color-coded WHO tape and record verifier staff ID.",
        recommendedActionAr: "إجراء قياس ثاني لشريط محيط الذراع باستخدام الشريط المعتمد وتسجيل رقم الممرض الموثق.",
        supportingEvidence: "Yemen Ministry of Public Health & Population Protocol for SAM Quality Control",
        whoGuidelineRef: "Yem-MoPHP-IMAM-2024",
        aiConfidenceScore: 0.94,
        status: "Active",
        persistent: true,
        categoryTag: "Verification Protocol"
      },
      {
        id: "ALT-CONF-003",
        patientId: "PAT-YEM-1129",
        patientName: "Zaid Omar",
        timestamp: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        alertType: "AI Confidence",
        severity: "Medium",
        triggerReason: "High Prediction Uncertainty & Model Disagreement",
        triggerReasonAr: "عدم يقين مرتفع في التنبؤ واختلاف بين النماذج",
        clinicalExplanation: "XGBoost predicts 52% wasting risk while Random Forest Proxy predicts 28% risk (Model Delta > 20%). Anthropometric WHZ (-2.1) is near decision threshold.",
        clinicalExplanationAr: "يتوقع نموذج XGBoost خطورة 52% بينما يتوقع نموذج الغابة العشوائية 28% (فارق يتجاوز 20%). مؤشر الوزن بالنسبة للطول (-2.1) قريب من حد القرار.",
        recommendedAction: "Re-evaluate physical clinical signs (appetite test, skin lesions, hair changes) and request senior medical officer review.",
        recommendedActionAr: "إعادة تقييم العلامات السريرية (اختبار الشهية، التغيرات الجلدية والشعر) وطلب مراجعة الطبيب المختص.",
        supportingEvidence: "Uncertainty Quantification in Ensemble Clinical AI Systems",
        aiConfidenceScore: 0.52,
        status: "Active",
        persistent: false,
        categoryTag: "Model Uncertainty"
      },
      {
        id: "ALT-FOL-004",
        patientId: "PAT-YEM-3301",
        patientName: "Youssef Ibrahim",
        timestamp: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        alertType: "Follow-up",
        severity: "High",
        triggerReason: "Follow-Up Visit Overdue by 4 Days (SAM Patient)",
        triggerReasonAr: "تأخر زيارة المتابعة لمدة 4 أيام (مريض سوء تغذية حاد شديد)",
        clinicalExplanation: "SAM patient enrolled in Outpatient Therapeutic Program (OTP) missed weekly weight & RUTF ration check-in scheduled for 4 days ago.",
        clinicalExplanationAr: "مريض سوء التغذية الشديد المسجل في برنامج العلاج الخارجي لم يحضر للزيارة الأسبوعية لمتابعة الوزن وصرف الوجبة قبل 4 أيام.",
        recommendedAction: "Dispatch Community Health Worker (CHW) for urgent home visit and conduct household food security & appetite check.",
        recommendedActionAr: "توجيه عامل الصحة المجتمعية للقيام بزيارة منزلية عاجلة وفحص الشهية والأمن الغذائي.",
        supportingEvidence: "WHO OTP Default & Defaulter Tracking Guidelines",
        whoGuidelineRef: "WHO-OTP-DEF-02",
        status: "Active",
        persistent: true,
        categoryTag: "Overdue SAM Visit"
      },
      {
        id: "ALT-SYS-005",
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        alertType: "System",
        severity: "Medium",
        triggerReason: "Offline Synchronization Pending (14 Records)",
        triggerReasonAr: "تعلق عملية المزامنة دون اتصال (14 سجل)",
        clinicalExplanation: "14 clinical measurements and AI diagnostic logs are saved locally in encrypted IndexedDB waiting for internet reconnection.",
        clinicalExplanationAr: "تم حفظ 14 قياساً وسجلاً تشخيصياً محلياً في قاعدة البيانات المشفرة بانتظار استعادة الاتصال بالإنترنت.",
        recommendedAction: "Verify mobile data connection or trigger manual Sync command when reaching regional hub.",
        recommendedActionAr: "التحقق من اتصال بيانات الهاتف أو تشغيل المزامنة اليدوية عند الوصول لمركز التغطية.",
        supportingEvidence: "Yemen National EMR Offline Sync Engine Protocol",
        status: "Active",
        persistent: false,
        categoryTag: "Sync Queue"
      }
    ];

    for (const a of defaultAlerts) {
      this.alerts.set(a.id, a);
      indexedDbService.saveAlert(a);
    }
  }

  public subscribe(subscriber: AlertSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(Array.from(this.alerts.values()));
    return () => this.subscribers.delete(subscriber);
  }

  private notifySubscribers() {
    const list = Array.from(this.alerts.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    this.subscribers.forEach((sub) => sub(list));
  }

  /**
   * Sound & Vibration Dispatchers
   */
  private triggerNotificationFeedback(severity: AlertSeverity) {
    // Vibration feedback on mobile devices
    if (this.vibrationEnabled && typeof navigator !== "undefined" && navigator.vibrate) {
      if (severity === "Critical") {
        navigator.vibrate([300, 100, 300, 100, 400]);
      } else if (severity === "High") {
        navigator.vibrate([200, 100, 200]);
      } else {
        navigator.vibrate([100]);
      }
    }

    // Synthesize audible warning chime using Web Audio API
    if (this.audioEnabled && typeof window !== "undefined") {
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = severity === "Critical" ? "sawtooth" : "sine";
          osc.frequency.setValueAtTime(severity === "Critical" ? 880 : 587.33, ctx.currentTime); // A5 or D5
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch (err) {
        // Audio playback prevented by browser autoplay policy
      }
    }
  }

  /**
   * Universal Alert Generation Entry Point
   */
  public async raiseAlert(alertInput: Omit<ClinicalAlert, "id" | "timestamp" | "status">): Promise<ClinicalAlert> {
    const alertId = `ALT-${alertInput.severity.substring(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const alert: ClinicalAlert = {
      ...alertInput,
      id: alertId,
      timestamp: new Date().toISOString(),
      status: "Active"
    };

    this.alerts.set(alertId, alert);
    await indexedDbService.saveAlert(alert);

    // Audit log entry
    clinicalAuditLogger.logEvent(
      "system@mophp.gov.ye",
      "Alert Engine",
      "Clinical Alert Raised",
      `Raised ${alert.severity} alert (${alert.alertType}): ${alert.triggerReason}`,
      {
        patientId: alert.patientId,
        ruleTriggered: alert.triggerReason,
        decisionOutcome: alert.severity
      }
    );

    this.triggerNotificationFeedback(alert.severity);
    this.notifySubscribers();
    return alert;
  }

  /**
   * Updates Alert Resolution Status (Acknowledge / Dismiss / Resolve)
   */
  public async updateAlertStatus(
    alertId: string,
    status: AlertResolutionStatus,
    userEmail: string,
    resolutionNotes?: string
  ): Promise<void> {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.status = status;
    const now = new Date().toISOString();
    if (status === "Acknowledged") {
      alert.acknowledgedBy = userEmail;
      alert.acknowledgedAt = now;
    } else if (status === "Resolved" || status === "Dismissed") {
      alert.resolvedBy = userEmail;
      alert.resolvedAt = now;
      if (resolutionNotes) alert.resolutionNotes = resolutionNotes;
    }

    this.alerts.set(alertId, alert);
    await indexedDbService.updateAlertStatus(alertId, status, userEmail, resolutionNotes);

    clinicalAuditLogger.logEvent(
      userEmail,
      "Clinical Staff",
      `Alert ${status}`,
      `Alert ${alertId} (${alert.triggerReason}) marked as ${status}. ${resolutionNotes ? "Notes: " + resolutionNotes : ""}`,
      {
        patientId: alert.patientId,
        decisionOutcome: status
      }
    );

    this.notifySubscribers();
  }

  /**
   * 1. Evaluates Anthropometric Measurements & Clinical Signs
   */
  public evaluateMeasurements(
    patientOrData: any,
    mOrData?: any,
    prediction?: MalnutritionPrediction,
    cdss?: UnifiedCdssDecision
  ) {
    let patientId = "";
    let patientName = "";
    let ageMonths = 0;
    let weightKg = 0;
    let heightCm = 0;
    let muac: number | undefined;
    let oedema = false;
    let whz = 0;
    let haz = 0;
    let waz = 0;

    if (patientOrData && typeof patientOrData === 'object') {
      if (patientOrData.id) {
        patientId = patientOrData.id;
        patientName = patientOrData.name || "Unknown Patient";
        ageMonths = patientOrData.ageMonths || 0;
      } else if (patientOrData.patientId) {
        patientId = patientOrData.patientId;
        patientName = patientOrData.patientName || "Unknown Patient";
        ageMonths = patientOrData.ageMonths || 0;
        weightKg = patientOrData.weight || 0;
        heightCm = patientOrData.height || 0;
        muac = patientOrData.muac;
        oedema = !!patientOrData.oedema;
      }
    }

    if (mOrData && typeof mOrData === 'object') {
      weightKg = mOrData.weightKg ?? mOrData.weight ?? weightKg;
      heightCm = mOrData.heightCm ?? mOrData.height ?? heightCm;
      muac = mOrData.muacMm ?? mOrData.muac ?? muac;
      oedema = mOrData.oedema !== undefined ? !!mOrData.oedema : oedema;
      whz = mOrData.whz ?? whz;
      haz = mOrData.haz ?? haz;
      waz = mOrData.waz ?? waz;
      if (mOrData.ageMonths) ageMonths = mOrData.ageMonths;
    }

    // Critical SAM Alert
    if (oedema || (muac !== undefined && muac < 115) || whz <= -3.0) {
      this.raiseAlert({
        patientId,
        patientName,
        alertType: "Critical Clinical",
        severity: "Critical",
        triggerReason: oedema
          ? "Bilateral Pitting Edema Detected (Kwashiorkor Risk)"
          : muac !== undefined && muac < 115
          ? `Extremely Low MUAC (${muac} mm < 115 mm)`
          : `Severe Wasting (WHZ = ${whz.toFixed(2)} SD)`,
        triggerReasonAr: oedema
          ? "تم الكشف عن وذمة انطباعية مزدوجة (خطر الكواشيوركور)"
          : muac !== undefined && muac < 115
          ? `قياس محيط الذراع منخفض جداً (${muac} مم < 115 مم)`
          : `هزال شديد (مؤشر الوزن للطول = ${whz.toFixed(2)})`,
        clinicalExplanation: oedema
          ? "Child presents fluid retention indicative of severe kwashiorkor. Urgent clinical stabilization required."
          : `Child anthropometric readings confirm Severe Acute Malnutrition (SAM). High risk of mortality if untreated.`,
        recommendedAction: oedema
          ? "Immediate referral to Inpatient Stabilization Center (TFC). Start F-75 therapeutic milk."
          : "Enroll in Outpatient Therapeutic Program (OTP). Provide RUTF ration scaled to weight.",
        supportingEvidence: "WHO Child Growth Standards & IMAM National Guidelines 2024",
        whoGuidelineRef: "WHO-SAM-CRIT-01",
        aiConfidenceScore: prediction?.wasting.probability,
        persistent: true,
        categoryTag: "SAM Detection"
      });
    }

    // Decision Support: Missing / Implausible Data
    if (weightKg <= 0 || heightCm <= 0 || ageMonths <= 0) {
      this.raiseAlert({
        patientId,
        patientName,
        alertType: "Decision Support",
        severity: "High",
        triggerReason: "Incomplete or Implausible Anthropometric Measurements",
        clinicalExplanation: "Height, weight, or age value recorded is zero or negative, preventing accurate Z-score calculation.",
        recommendedAction: "Re-weigh and re-measure patient height using calibrated length board / stadiometer.",
        supportingEvidence: "WHO Child Anthropometry Quality Protocol",
        persistent: false,
        categoryTag: "Data Integrity"
      });
    }

    // Implausible Z-Score Alert (Out of distribution)
    if (whz < -6.0 || whz > 6.0 || haz < -6.0 || haz > 6.0) {
      this.raiseAlert({
        patientId,
        patientName,
        alertType: "AI Confidence",
        severity: "Medium",
        triggerReason: "Out-of-Distribution Anthropometric Z-Score Detected",
        clinicalExplanation: `Calculated Z-score (${whz < -6 ? "WHZ " + whz : "HAZ " + haz}) is extreme (<-6.0 or >+6.0 SD), suggesting measurement typo or data recording error.`,
        recommendedAction: "Verify patient age, weight unit (kg vs lbs), and height unit (cm vs in).",
        supportingEvidence: "WHO Anthro Plausibility Check Bounds",
        persistent: false,
        categoryTag: "Out-of-Distribution"
      });
    }

    // MUAC Double-Check Re-Measurement Reminder
    if (muac !== undefined && muac < 115) {
      this.raiseAlert({
        patientId,
        patientName,
        alertType: "Follow-up",
        severity: "High",
        triggerReason: "Mandatory Second Nurse MUAC Re-Measurement Required",
        clinicalExplanation: "National SAM protocol requires a second nurse to independently verify MUAC readings under 115 mm before OTP registration.",
        recommendedAction: "Have second staff nurse verify MUAC tape alignment and record verification in patient chart.",
        supportingEvidence: "MoPHP Yemen Quality Assurance Standard",
        persistent: true,
        categoryTag: "Verification Protocol"
      });
    }
  }

  /**
   * 2. Evaluates AI Model Confidence, Uncertainty, & Stacking Disagreement
   */
  public evaluateAiPredictions(
    patientOrData: any,
    predictionOrData?: any,
    metaStackingResult?: { xgboostProbability: number; randomForestProxyProbability: number }
  ) {
    let patientId = "";
    let patientName = "";
    let wastingProb = 0;
    let wastingConf = 1;

    if (patientOrData && typeof patientOrData === 'object') {
      if (patientOrData.id) {
        patientId = patientOrData.id;
        patientName = patientOrData.name || "Unknown Patient";
      } else if (patientOrData.patientId) {
        patientId = patientOrData.patientId;
        patientName = patientOrData.patientName || "Unknown Patient";
        wastingProb = patientOrData.modelConfidence ?? 0;
        wastingConf = 1 - (patientOrData.uncertaintyScore ?? 0);
      }
    }

    if (predictionOrData && typeof predictionOrData === 'object') {
      if (predictionOrData.wasting) {
        wastingProb = predictionOrData.wasting.probability ?? wastingProb;
        wastingConf = predictionOrData.wasting.confidenceScore ?? wastingConf;
      }
    }

    // Low Prediction Confidence Alert
    if (wastingConf < 0.70) {
      this.raiseAlert({
        patientId,
        patientName,
        alertType: "AI Confidence",
        severity: "Medium",
        triggerReason: `Low AI Prediction Confidence (${(wastingConf * 100).toFixed(1)}%)`,
        clinicalExplanation: "Machine learning confidence score fell below acceptable clinical threshold due to sparse input features or border Z-scores.",
        recommendedAction: "Conduct thorough clinical examination and consult WHO reference manuals rather than relying solely on ML outputs.",
        supportingEvidence: "Clinical Machine Learning Trust & Transparency Guidelines",
        aiConfidenceScore: wastingConf,
        persistent: false,
        categoryTag: "Low Confidence"
      });
    }

    // Model Disagreement Alert (Ensemble Stacking)
    if (metaStackingResult) {
      const delta = Math.abs(metaStackingResult.xgboostProbability - metaStackingResult.randomForestProxyProbability);
      if (delta > 0.25) {
        this.raiseAlert({
          patientId,
          patientName,
          alertType: "AI Confidence",
          severity: "Medium",
          triggerReason: `Ensemble Model Disagreement (Delta = ${(delta * 100).toFixed(1)}%)`,
          clinicalExplanation: `XGBoost model predicted ${(metaStackingResult.xgboostProbability * 100).toFixed(1)}% wasting risk while Random Forest predicted ${(metaStackingResult.randomForestProxyProbability * 100).toFixed(1)}%.`,
          recommendedAction: "Request physician review and re-assess clinical signs of edema and muscle wasting.",
          supportingEvidence: "Multi-Model Ensemble Divergence Metric",
          aiConfidenceScore: wastingProb,
          persistent: false,
          categoryTag: "Model Disagreement"
        });
      }
    }
  }

  /**
   * 3. Evaluates CDSS Recommendations & WHO Protocol Violations
   */
  public evaluateCdssDecision(patientOrData: any, cdssOrData?: any) {
    let patientId = "";
    let patientName = "";
    let cdss: UnifiedCdssDecision | undefined;

    if (patientOrData && typeof patientOrData === 'object') {
      if (patientOrData.id) {
        patientId = patientOrData.id;
        patientName = patientOrData.name || "Unknown Patient";
      } else if (patientOrData.patientId) {
        patientId = patientOrData.patientId;
        patientName = patientOrData.patientName || "Unknown Patient";
        cdss = patientOrData.cdssDecision;
      }
    }

    if (cdssOrData) {
      cdss = cdssOrData;
    }

    if (!cdss) return;

    if (!cdss.isConsistent && cdss.conflictExplanation) {
      this.raiseAlert({
        patientId,
        patientName,
        alertType: "Knowledge-Based",
        severity: "High",
        triggerReason: "WHO Hard Constraint Overrode ML Recommendation",
        clinicalExplanation: cdss.conflictExplanation,
        recommendedAction: "Follow mandatory WHO hard rule intervention strictly.",
        supportingEvidence: "WHO IMCI Hard Constraint Enforcement",
        whoGuidelineRef: "WHO-IMCI-OVERRIDE-01",
        persistent: true,
        categoryTag: "Protocol Conflict"
      });
    }

    if (cdss.finalSeverity === "Severe" && cdss.referralStatus === "None") {
      this.raiseAlert({
        patientId,
        patientName,
        alertType: "Decision Support",
        severity: "Critical",
        triggerReason: "Missing Mandatory Referral for Severe Acute Malnutrition",
        clinicalExplanation: "Patient classified with SAM but no Outpatient (OTP) or Inpatient (TFC) referral destination was specified.",
        recommendedAction: "Select appropriate OTP / TFC healthcare facility for immediate referral.",
        supportingEvidence: "WHO SAM Care Pathway Guidelines",
        persistent: true,
        categoryTag: "Missing Referral"
      });
    }
  }

  /**
   * 4. Evaluates Follow-Up Visit Schedules & Overdue Reminders
   */
  public evaluateFollowup(schedule: FollowupVisitSchedule) {
    if (schedule.status === "Overdue" || new Date(schedule.nextFollowupDate).getTime() < Date.now()) {
      this.raiseAlert({
        patientId: schedule.patientId,
        patientName: schedule.patientName,
        alertType: "Follow-up",
        severity: schedule.severity === "Severe" ? "High" : "Medium",
        triggerReason: `Overdue Follow-up Visit (Due: ${schedule.nextFollowupDate})`,
        clinicalExplanation: `Patient diagnosed with ${schedule.severity} malnutrition missed scheduled follow-up re-evaluation on ${schedule.nextFollowupDate}.`,
        recommendedAction: "Contact patient family or notify Community Health Worker for home tracking.",
        supportingEvidence: "WHO Child Growth Continuity of Care Standard",
        persistent: true,
        categoryTag: "Overdue Followup"
      });
    }
  }

  /**
   * 5. Evaluates System Synchronization & Integrity Status
   */
  public evaluateSystemSyncStatus(pendingSyncCount: number) {
    if (pendingSyncCount > 10) {
      this.raiseAlert({
        alertType: "System",
        severity: "Medium",
        triggerReason: `High Volume Offline Sync Pending (${pendingSyncCount} Records)`,
        clinicalExplanation: `${pendingSyncCount} clinical diagnostic records are accumulated locally in IndexedDB awaiting connectivity.`,
        recommendedAction: "Connect mobile unit to network to initiate auto-synchronization.",
        supportingEvidence: "EMR Offline Buffer Policy",
        persistent: false,
        categoryTag: "Sync Pending"
      });
    }
  }

  /**
   * Get filtered alerts
   */
  public getAlerts(): ClinicalAlert[] {
    return Array.from(this.alerts.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Statistics Summary
   */
  public getStats() {
    const list = Array.from(this.alerts.values());
    const total = list.length;
    const active = list.filter((a) => a.status === "Active").length;
    const critical = list.filter((a) => a.severity === "Critical" && a.status === "Active").length;
    const high = list.filter((a) => a.severity === "High" && a.status === "Active").length;
    const acknowledged = list.filter((a) => a.status === "Acknowledged").length;
    const resolved = list.filter((a) => a.status === "Resolved").length;

    return {
      total,
      active,
      critical,
      high,
      acknowledged,
      resolved,
      resolutionRatePct: total > 0 ? Math.round(((resolved + acknowledged) / total) * 100) : 100
    };
  }

  public setAudioEnabled(enabled: boolean) {
    this.audioEnabled = enabled;
  }

  public setVibrationEnabled(enabled: boolean) {
    this.vibrationEnabled = enabled;
  }
}

export const clinicalAlertEngine = new ClinicalAlertEngine();
