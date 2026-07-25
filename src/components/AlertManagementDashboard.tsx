import React, { useState, useEffect } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  Bell,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Volume2,
  VolumeX,
  Vibrate,
  Clock,
  UserCheck,
  FileText,
  Activity,
  ArrowRight,
  RefreshCw,
  Zap,
  Info,
  Check,
  AlertCircle
} from "lucide-react";
import { ClinicalAlert, AlertSeverity, AlertType, AlertResolutionStatus } from "../types";
import { Language } from "../utils/translation";
import { clinicalAlertEngine } from "../utils/alertEngine";

interface AlertManagementDashboardProps {
  lang: Language;
  userEmail?: string;
  userRole?: string;
}

export const AlertManagementDashboard: React.FC<AlertManagementDashboardProps> = ({
  lang,
  userEmail = "nurse@mophp.gov.ye",
  userRole = "Nurse"
}) => {
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("Active");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(true);

  // Resolution Modal State
  const [resolvingAlert, setResolvingAlert] = useState<ClinicalAlert | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<string>("");

  const isAr = lang === "ar";

  useEffect(() => {
    const unsubscribe = clinicalAlertEngine.subscribe((updatedAlerts) => {
      setAlerts(updatedAlerts);
    });
    return () => unsubscribe();
  }, []);

  const stats = clinicalAlertEngine.getStats();

  // Filtered Alert List
  const filteredAlerts = alerts.filter((alert) => {
    const matchesSeverity = selectedSeverity === "All" || alert.severity === selectedSeverity;
    const matchesType = selectedType === "All" || alert.alertType === selectedType;
    const matchesStatus = selectedStatus === "All" || alert.status === selectedStatus;

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      (alert.patientName && alert.patientName.toLowerCase().includes(term)) ||
      (alert.patientId && alert.patientId.toLowerCase().includes(term)) ||
      alert.triggerReason.toLowerCase().includes(term) ||
      (alert.triggerReasonAr && alert.triggerReasonAr.includes(term)) ||
      alert.clinicalExplanation.toLowerCase().includes(term) ||
      alert.categoryTag.toLowerCase().includes(term) ||
      (alert.whoGuidelineRef && alert.whoGuidelineRef.toLowerCase().includes(term));

    return matchesSeverity && matchesType && matchesStatus && matchesSearch;
  });

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    clinicalAlertEngine.setAudioEnabled(next);
  };

  const toggleVibration = () => {
    const next = !vibrationEnabled;
    setVibrationEnabled(next);
    clinicalAlertEngine.setVibrationEnabled(next);
  };

  const handleAcknowledge = async (alertId: string) => {
    await clinicalAlertEngine.updateAlertStatus(alertId, "Acknowledged", userEmail);
  };

  const handleOpenResolve = (alert: ClinicalAlert) => {
    setResolvingAlert(alert);
    setResolutionNotes("");
  };

  const handleConfirmResolve = async () => {
    if (!resolvingAlert) return;
    await clinicalAlertEngine.updateAlertStatus(
      resolvingAlert.id,
      "Resolved",
      userEmail,
      resolutionNotes || "Resolved after clinical verification."
    );
    setResolvingAlert(null);
  };

  const handleDismiss = async (alertId: string) => {
    await clinicalAlertEngine.updateAlertStatus(alertId, "Dismissed", userEmail);
  };

  const getSeverityBadgeClass = (severity: AlertSeverity) => {
    switch (severity) {
      case "Critical":
        return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
      case "High":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
      case "Medium":
        return "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800";
      case "Low":
        return "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const getSeverityCardBorder = (severity: AlertSeverity) => {
    switch (severity) {
      case "Critical":
        return "border-l-4 border-l-rose-600 bg-rose-50/30 dark:bg-rose-950/20";
      case "High":
        return "border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/10";
      case "Medium":
        return "border-l-4 border-l-sky-500 bg-sky-50/20 dark:bg-sky-950/10";
      case "Low":
        return "border-l-4 border-l-slate-400 bg-slate-50/30 dark:bg-slate-900/40";
      default:
        return "border-l-4 border-l-slate-300";
    }
  };

  const getTypeIcon = (alertType: AlertType) => {
    switch (alertType) {
      case "Critical Clinical":
        return <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case "Decision Support":
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      case "AI Confidence":
        return <Zap className="w-5 h-5 text-sky-600 dark:text-sky-400" />;
      case "Knowledge-Based":
        return <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
      case "Follow-up":
        return <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />;
      case "System":
        return <Activity className="w-5 h-5 text-slate-600 dark:text-slate-400" />;
      default:
        return <Bell className="w-5 h-5 text-sky-600" />;
    }
  };

  return (
    <div className={`space-y-6 ${isAr ? "rtl font-arabic" : "ltr"}`}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-sky-900/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {isAr ? "نظام التنبيهات السريرية الذكي" : "Clinical Alert & Decision Engine"}
                </h1>
                <p className="text-xs text-sky-200/80">
                  {isAr
                    ? "تقييم لحظي شامل لمؤشرات سوء التغذية، ثقة الذكاء الاصطناعي، وبروتوكولات منظمة الصحة العالمية"
                    : "Real-time evaluation of malnutrition triage, AI uncertainty, WHO hard rules, and follow-up alerts"}
                </p>
              </div>
            </div>
          </div>

          {/* Sound & Vibration Toggles */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAudio}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                audioEnabled
                  ? "bg-sky-600/30 text-sky-200 border-sky-500/50 hover:bg-sky-600/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
              title={isAr ? "تفعيل/إيقاف التنبيه الصوتي" : "Toggle Audio Chime"}
            >
              {audioEnabled ? <Volume2 className="w-4 h-4 text-sky-300" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
              <span>{isAr ? (audioEnabled ? "الصوت مفعل" : "الصوت مكتوم") : audioEnabled ? "Audio On" : "Audio Muted"}</span>
            </button>

            <button
              onClick={toggleVibration}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                vibrationEnabled
                  ? "bg-purple-600/30 text-purple-200 border-purple-500/50 hover:bg-purple-600/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
              }`}
              title={isAr ? "تفعيل/إيقاف اهتزاز الهاتف" : "Toggle Vibration"}
            >
              <Vibrate className={`w-4 h-4 ${vibrationEnabled ? "text-purple-300" : "text-slate-400"}`} />
              <span>{isAr ? (vibrationEnabled ? "الاهتزاز مفعل" : "الاهتزاز معطل") : vibrationEnabled ? "Vibe On" : "Vibe Off"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alert Statistics Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 rounded-lg">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">{stats.critical}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "حالات حادة حرجية" : "Active Critical"}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{stats.high}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "تنبيهات مرتفعة" : "Active High"}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-sky-100 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 rounded-lg">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-sky-600 dark:text-sky-400">{stats.active}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "إجمالي النشطة" : "Total Active"}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-lg">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">{stats.acknowledged}</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "تم الإقرار بها" : "Acknowledged"}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.resolutionRatePct}%</div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isAr ? "نسبة المعالجة" : "Resolution Rate"}
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search Control Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={
                isAr
                  ? "بحث باسم المريض، رقم الملف، سبب التنبيه، أو دليل الصحة العالمية..."
                  : "Search patient, ID, alert reason, category tag, or WHO guideline..."
              }
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Status Segmented Buttons */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
            {["Active", "Acknowledged", "Resolved", "All"].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  selectedStatus === st
                    ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {st === "Active"
                  ? isAr ? "نشط" : "Active"
                  : st === "Acknowledged"
                  ? isAr ? "تم الإقرار" : "Acknowledged"
                  : st === "Resolved"
                  ? isAr ? "معالج" : "Resolved"
                  : isAr ? "الكل" : "All"}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Severity Filter */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              {isAr ? "مستوى الخطورة:" : "Severity:"}
            </span>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="All">{isAr ? "جميع المستويات" : "All Severities"}</option>
              <option value="Critical">{isAr ? "حرج (Critical)" : "Critical"}</option>
              <option value="High">{isAr ? "مرتفع (High)" : "High"}</option>
              <option value="Medium">{isAr ? "متوسط (Medium)" : "Medium"}</option>
              <option value="Low">{isAr ? "منخفض (Low)" : "Low"}</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              {isAr ? "نوع التنبيه:" : "Alert Category:"}
            </span>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="All">{isAr ? "جميع الأنواع" : "All Types"}</option>
              <option value="Critical Clinical">{isAr ? "تنبيه سريري حرج" : "Critical Clinical"}</option>
              <option value="Decision Support">{isAr ? "دعم القرار السريري" : "Decision Support"}</option>
              <option value="AI Confidence">{isAr ? "ثقة وعدم يقين الذكاء الاصطناعي" : "AI Confidence"}</option>
              <option value="Knowledge-Based">{isAr ? "بروتوكولات ودلائل الإرشاد" : "Knowledge-Based"}</option>
              <option value="Follow-up">{isAr ? "تأخر الزيارات والمتابعة" : "Follow-up"}</option>
              <option value="System">{isAr ? "النظام والمزامنة" : "System"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alert Feed / Cards List */}
      <div className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-80" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {isAr ? "لا توجد تنبيهات تطابق خيارات البحث الحالية" : "No alerts found for current filter criteria"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isAr ? "جميع المؤشرات السريرية وقواعد القرارات مستقرة" : "All clinical parameters and decision rules are clear."}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md ${getSeverityCardBorder(
                alert.severity
              )}`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Left Section: Icon & Content */}
                <div className="flex items-start gap-3.5 flex-1">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 shrink-0">
                    {getTypeIcon(alert.alertType)}
                  </div>

                  <div className="space-y-2 flex-1">
                    {/* Header Badges & Timestamp */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getSeverityBadgeClass(alert.severity)}`}>
                        {alert.severity}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {alert.alertType}
                      </span>

                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        {alert.categoryTag}
                      </span>

                      {alert.patientName && (
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {alert.patientName} {alert.patientId ? `(${alert.patientId})` : ""}
                        </span>
                      )}

                      <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {/* Trigger Reason Title */}
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {isAr && alert.triggerReasonAr ? alert.triggerReasonAr : alert.triggerReason}
                    </h3>

                    {/* Clinical Explanation */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {isAr && alert.clinicalExplanationAr ? alert.clinicalExplanationAr : alert.clinicalExplanation}
                    </p>

                    {/* Recommended Action Box */}
                    <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl space-y-1">
                      <div className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                        {isAr ? "الإجراء السريري الموصى به:" : "Recommended Clinical Action:"}
                      </div>
                      <p className="text-xs font-medium text-amber-900 dark:text-amber-200">
                        {isAr && alert.recommendedActionAr ? alert.recommendedActionAr : alert.recommendedAction}
                      </p>
                    </div>

                    {/* Metadata & WHO Guidelines Reference */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      {alert.whoGuidelineRef && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          <FileText className="w-3 h-3" />
                          {alert.whoGuidelineRef}
                        </span>
                      )}

                      {alert.aiConfidenceScore !== undefined && (
                        <span className="inline-flex items-center gap-1 text-sky-700 dark:text-sky-300 font-medium">
                          <Zap className="w-3 h-3 text-sky-500" />
                          {isAr ? "درجة ثقة AI:" : "AI Confidence:"} {(alert.aiConfidenceScore * 100).toFixed(1)}%
                        </span>
                      )}

                      {alert.acknowledgedBy && (
                        <span className="text-purple-600 dark:text-purple-400 font-medium">
                          {isAr ? "تم الإقرار بواسطة:" : "Acked by:"} {alert.acknowledgedBy}
                        </span>
                      )}

                      {alert.resolvedBy && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {isAr ? "تمت المعالجة بواسطة:" : "Resolved by:"} {alert.resolvedBy}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex md:flex-col items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                  {alert.status === "Active" && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="w-full md:w-auto px-3.5 py-1.5 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 text-xs font-bold hover:bg-purple-200 transition-all flex items-center justify-center gap-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{isAr ? "إقرار بالقراءة" : "Acknowledge"}</span>
                    </button>
                  )}

                  {(alert.status === "Active" || alert.status === "Acknowledged") && (
                    <button
                      onClick={() => handleOpenResolve(alert)}
                      className="w-full md:w-auto px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isAr ? "تسجيل المعالجة" : "Resolve Alert"}</span>
                    </button>
                  )}

                  {!alert.persistent && alert.status !== "Resolved" && (
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="w-full md:w-auto px-3 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{isAr ? "تجاهل" : "Dismiss"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Resolution Notes Modal */}
      {resolvingAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-5 h-5" />
                <h3>{isAr ? "تسجيل معالجة التنبيه السريري" : "Resolve Clinical Alert"}</h3>
              </div>
              <button
                onClick={() => setResolvingAlert(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                {resolvingAlert.triggerReason}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? "يرجى كتابة الملاحظات السريرية أو الإجراءات المتخذة لحل حالة التنبيه قبل الإغلاق:"
                  : "Please record clinical notes or actions taken to address this alert before closing:"}
              </p>
            </div>

            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder={
                isAr
                  ? "مثال: تم إحالة المريض بنجاح إلى مركز TFC وإعطاء جرعة F-75 الأولى بواسطة د. طارق..."
                  : "e.g. Patient referred to TFC, first dose F-75 administered under Dr. Tariq supervision..."
              }
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setResolvingAlert(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {isAr ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={handleConfirmResolve}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md transition-all flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isAr ? "تأكيد المعالجة" : "Confirm Resolution"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
