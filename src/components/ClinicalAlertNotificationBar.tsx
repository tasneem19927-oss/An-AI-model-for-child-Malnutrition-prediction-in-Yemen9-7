import React, { useState, useEffect } from "react";
import { ShieldAlert, Bell, ChevronRight, X, AlertTriangle } from "lucide-react";
import { ClinicalAlert } from "../types";
import { Language } from "../utils/translation";
import { clinicalAlertEngine } from "../utils/alertEngine";

interface ClinicalAlertNotificationBarProps {
  lang: Language;
  onOpenAlertsDashboard: () => void;
}

export const ClinicalAlertNotificationBar: React.FC<ClinicalAlertNotificationBarProps> = ({
  lang,
  onOpenAlertsDashboard
}) => {
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [dismissedBar, setDismissedBar] = useState<boolean>(false);

  const isAr = lang === "ar";

  useEffect(() => {
    const unsubscribe = clinicalAlertEngine.subscribe((updated) => {
      setAlerts(updated);
    });
    return () => unsubscribe();
  }, []);

  const activeCriticalAlerts = alerts.filter(
    (a) => a.status === "Active" && (a.severity === "Critical" || a.severity === "High")
  );

  if (activeCriticalAlerts.length === 0 || dismissedBar) {
    return null;
  }

  const topAlert = activeCriticalAlerts[0];

  return (
    <div className={`mb-4 overflow-hidden rounded-xl border shadow-lg transition-all animate-in slide-in-from-top-2 ${
      topAlert.severity === "Critical"
        ? "bg-rose-600 text-white border-rose-700 shadow-rose-900/20"
        : "bg-amber-500 text-slate-900 border-amber-600 shadow-amber-900/20"
    }`}>
      <div className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-semibold">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="p-1.5 rounded-lg bg-white/20 shrink-0">
            {topAlert.severity === "Critical" ? (
              <ShieldAlert className="w-4 h-4 text-white animate-bounce" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-slate-900" />
            )}
          </span>

          <div className="truncate">
            <span className="font-extrabold uppercase tracking-wide mr-2 opacity-90">
              [{topAlert.severity}]
            </span>
            <span>
              {isAr && topAlert.triggerReasonAr ? topAlert.triggerReasonAr : topAlert.triggerReason}
            </span>
            {topAlert.patientName && (
              <span className="ml-1 opacity-80 font-bold">
                — {topAlert.patientName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenAlertsDashboard}
            className="px-3 py-1 rounded-lg bg-white/25 hover:bg-white/35 transition-all text-[11px] font-bold flex items-center gap-1"
          >
            <span>{isAr ? "عرض التنبيهات" : "View All Alerts"} ({activeCriticalAlerts.length})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setDismissedBar(true)}
            className="p-1 rounded-lg hover:bg-white/20 transition-all opacity-80 hover:opacity-100"
            title={isAr ? "إغلاق الشريط" : "Dismiss Bar"}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
