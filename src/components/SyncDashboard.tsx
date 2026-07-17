import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Language } from "../utils/translation";
import { indexedDbService, OfflineRecord } from "../utils/indexedDbService";
import { syncManager, SyncStatus } from "../utils/syncManager";
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  Server, 
  User, 
  Smartphone, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  FileText, 
  Activity, 
  Trash2, 
  BadgeAlert,
  ShieldCheck,
  History
} from "lucide-react";

interface SyncDashboardProps {
  lang: Language;
  currentUser: any;
}

export function SyncDashboard({ lang, currentUser }: SyncDashboardProps) {
  const [syncState, setSyncState] = useState<SyncStatus>({
    online: navigator.onLine,
    pendingRecordsCount: 0,
    lastSyncTime: null,
    syncInProgress: false,
    deviceName: "Yemen-Mobile-Unit-8192",
    deviceId: "DEV-F81A"
  });

  const [pendingRecords, setPendingRecords] = useState<OfflineRecord[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [notif, setNotif] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Load status and data
  const refreshData = async () => {
    try {
      const status = await syncManager.getSyncStatus();
      setSyncState(status);

      const pending = await indexedDbService.getOfflineRecords();
      setPendingRecords(pending);

      const logs = await indexedDbService.getSyncLogs();
      // Sort logs by timestamp desc
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSyncLogs(logs);
    } catch (e) {
      console.error("Failed to load sync dashboard data:", e);
    }
  };

  useEffect(() => {
    // Subscribe to real-time status updates from SyncManager
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
      refreshData();
    });

    // Refresh initially
    refreshData();

    // Setup an interval to refresh tables periodically
    const timer = setInterval(() => {
      refreshData();
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  const handleSyncNow = async () => {
    setLoading(true);
    triggerNotification("info", lang === "en" ? "Initializing secure synchronizer channel..." : "جاري تهيئة قناة الاتصال الآمنة والمزامنة...");
    
    const res = await syncManager.synchronize();
    
    setLoading(false);
    if (res.success) {
      if (res.syncedCount > 0) {
        triggerNotification("success", lang === "en" 
          ? `Synchronization Completed Successfully! Uploaded ${res.syncedCount} queued records.` 
          : `تمت المزامنة بنجاح! تم رفع ${res.syncedCount} سجلات من العيادة.`
        );
      } else {
        triggerNotification("info", lang === "en" ? "Local queue is empty. Database is in sync." : "قاعدة البيانات متزامنة بالكامل بالفعل.");
      }
    } else {
      triggerNotification("error", lang === "en" ? res.message : `فشلت المزامنة: ${res.message}`);
    }
    refreshData();
  };

  const handleToggleSimulator = () => {
    const nextOnline = !syncState.online;
    syncManager.toggleOnlineSimulator(nextOnline);
    triggerNotification("info", nextOnline 
      ? (lang === "en" ? "Simulated Online Network Enabled" : "تم تمكين محاكاة الاتصال بالشبكة") 
      : (lang === "en" ? "Simulated Offline Mode Enabled" : "تم تمكين محاكاة انقطاع الشبكة")
    );
  };

  const handleClearQueue = async () => {
    if (window.confirm(lang === "en" ? "Are you sure you want to clear the offline sync queue? This will delete un-uploaded data!" : "هل أنت متأكد من مسح قائمة الانتظار؟ سيؤدي هذا لحذف البيانات التي لم تُرفع بعد!")) {
      await indexedDbService.clearAll();
      triggerNotification("info", lang === "en" ? "Queue cleared successfully." : "تم تفريغ قائمة المزامنة.");
      refreshData();
    }
  };

  const triggerNotification = (type: "success" | "error" | "info", msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 5000);
  };

  // Filter logs
  const filteredLogs = syncLogs.filter((log) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      log.id.toLowerCase().includes(query) ||
      (log.details || "").toLowerCase().includes(query) ||
      log.status.toLowerCase().includes(query)
    );
  });

  // Arabic vs English translations dictionary
  const t = {
    en: {
      syncHub: "Offline Sync Hub",
      subHeader: "Enterprise Resilience & Connectivity Management",
      activeClinician: "Active Clinician Session",
      deviceName: "Device Hostname",
      deviceId: "Device Security ID",
      onlineStatus: "Connectivity Status",
      online: "ONLINE READY",
      offline: "OFFLINE MODE ACTIVATED",
      pendingQueue: "Pending Offline Sync Queue",
      pendingDesc: "These records are encrypted and saved securely in local IndexedDB. They will automatically sync when internet is restored.",
      syncLogs: "Synchronization Logs History",
      syncLogsDesc: "Central audit trail for upload and diagnostic synchronization packets.",
      syncNow: "Force Manual Sync Now",
      syncing: "Synchronizing Data...",
      simulateOffline: "Simulate Network Loss",
      simulateOnline: "Simulate Network Restore",
      clearQueue: "Wipe Local Sync Queue",
      lastSync: "Last Successful Sync",
      neverSynced: "Never Synced",
      recordsCount: "Queued Records",
      recordType: "Data Model",
      action: "Operation",
      timestamp: "Timestamp",
      status: "Transmission Status",
      details: "Audit Details",
      retries: "Retries",
      lastError: "Last Error Log",
      searchPlaceholder: "Search sync history logs...",
      noPending: "No records pending in offline queue.",
      noLogs: "No synchronization sessions logged.",
      securityVerify: "Authorized JWT Transmission Channel Active",
      mappingNote: "Dynamic ID Conflict Resolution active for remote mobile registers."
    },
    ar: {
      syncHub: "مركز المزامنة والتشغيل دون اتصال",
      subHeader: "إدارة مرونة الاتصال وأمن السجلات الميدانية",
      activeClinician: "الممارس الصحي النشط",
      deviceName: "اسم جهاز العيادة",
      deviceId: "الرقم التعريفي للجهاز",
      onlineStatus: "حالة شبكة الإنترنت",
      online: "متصل بالشبكة (جاهز)",
      offline: "الوضع غير المتصل بالإنترنت نشط",
      pendingQueue: "سجلات قائمة الانتظار للمزامنة",
      pendingDesc: "هذه السجلات مشفرة ومحفوظة بأمان في قاعدة بيانات IndexedDB المحلية. ستتم مزامنتها تلقائياً عند استعادة الاتصال.",
      syncLogs: "سجل عمليات المزامنة والتحديث",
      syncLogsDesc: "التدقيق الأمني والسريري لعمليات رفع ومزامنة البيانات مع السيرفر الرئيسي.",
      syncNow: "مزامنة البيانات يدوياً الآن",
      syncing: "جاري المزامنة الآن...",
      simulateOffline: "محاكاة انقطاع الإنترنت",
      simulateOnline: "محاكاة عودة الإنترنت",
      clearQueue: "مسح قائمة الانتظار المحلية",
      lastSync: "آخر مزامنة ناجحة",
      neverSynced: "لم تتم المزامنة مطلقاً",
      recordsCount: "سجلات الانتظار",
      recordType: "نوع النموذج",
      action: "العملية",
      timestamp: "التاريخ والوقت",
      status: "حالة الإرسال",
      details: "تفاصيل المزامنة",
      retries: "المحاولات",
      lastError: "آخر رمز خطأ",
      searchPlaceholder: "البحث في سجل المزامنة السريري...",
      noPending: "لا توجد سجلات معلقة في قائمة الانتظار المحلية.",
      noLogs: "لا توجد عمليات مزامنة مسجلة حالياً.",
      securityVerify: "قناة النقل المشفرة بنظام JWT فعالة وآمنة",
      mappingNote: "نظام التعيين التلقائي وحل نزاعات المعرفات (Conflict Resolution) نشط."
    }
  };

  const curT = lang === "ar" ? t.ar : t.en;

  return (
    <div className="space-y-6" id="sync-control-hub">
      {/* Toast Notification inside Dashboard */}
      {notif && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl shadow-md border flex items-center gap-3 ${
            notif.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
            notif.type === "error" ? "bg-rose-50 text-rose-800 border-rose-200" :
            "bg-blue-50 text-blue-800 border-blue-200"
          }`}
        >
          {notif.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          {notif.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
          {notif.type === "info" && <RefreshCw className="w-5 h-5 text-blue-600 shrink-0 animate-spin" />}
          <span className="text-xs font-bold leading-none">{notif.msg}</span>
        </motion.div>
      )}

      {/* Header and Sync Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-[#008DC9]" />
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">{curT.syncHub}</h2>
          </div>
          <p className="text-xs text-slate-500 font-semibold mt-1">{curT.subHeader}</p>
        </div>

        {/* Sync Controls buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Simulate Network Switch */}
          <button
            onClick={handleToggleSimulator}
            className={`text-xs font-extrabold px-3 py-2 rounded-xl border flex items-center gap-2 transition-all cursor-pointer ${
              syncState.online 
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200" 
                : "bg-[#008DC9] hover:bg-[#007cb2] text-white border-[#008DC9] shadow-md"
            }`}
          >
            {syncState.online ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            {syncState.online ? curT.simulateOffline : curT.simulateOnline}
          </button>

          {/* Wipe Sync queue */}
          {pendingRecords.length > 0 && (
            <button
              onClick={handleClearQueue}
              className="text-xs font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              {curT.clearQueue}
            </button>
          )}

          {/* Sync Button */}
          <button
            onClick={handleSyncNow}
            disabled={syncState.syncInProgress || loading}
            className={`text-xs font-extrabold bg-[#008DC9] hover:bg-[#007cb2] text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md hover:shadow-lg cursor-pointer disabled:opacity-50`}
          >
            <RefreshCw className={`w-4 h-4 ${syncState.syncInProgress || loading ? "animate-spin" : ""}`} />
            {syncState.syncInProgress || loading ? curT.syncing : curT.syncNow}
          </button>
        </div>
      </div>

      {/* Grid Layout for Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Connection Status Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{curT.onlineStatus}</span>
          <div className="flex items-center gap-2 mt-2">
            <div className={`w-3 h-3 rounded-full ${syncState.online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span className={`text-sm font-black uppercase ${syncState.online ? "text-emerald-700" : "text-rose-700"}`}>
              {syncState.online ? curT.online : curT.offline}
            </span>
          </div>
          <div className="absolute right-4 top-4 opacity-10">
            {syncState.online ? <Wifi className="w-16 h-16 text-emerald-500" /> : <WifiOff className="w-16 h-16 text-rose-500" />}
          </div>
        </div>

        {/* Clinician Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{curT.activeClinician}</span>
          <div className="flex items-center gap-2.5 mt-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 shadow-inner shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 block truncate">{currentUser?.name || "Clinician Reem"}</span>
              <span className="text-[9px] text-slate-400 font-mono block truncate">ID: {currentUser?.id || "USR-003"}</span>
            </div>
          </div>
        </div>

        {/* Device Information Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{curT.deviceName}</span>
          <div className="flex items-center gap-2.5 mt-2 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 shadow-inner shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 block truncate">{syncState.deviceName}</span>
              <span className="text-[9px] text-slate-400 font-mono block truncate">MAC ID: {syncState.deviceId}</span>
            </div>
          </div>
        </div>

        {/* Sync Queue Size Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{curT.recordsCount}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-black ${syncState.pendingRecordsCount > 0 ? "text-orange-600 animate-pulse" : "text-slate-800"}`}>
              {syncState.pendingRecordsCount}
            </span>
            <span className="text-[10px] font-extrabold text-slate-400 uppercase">{lang === "en" ? "Unsynced" : "غير مزامن"}</span>
          </div>
          <span className="text-[9px] text-slate-400 font-bold block mt-1">
            {curT.lastSync}: {syncState.lastSyncTime ? new Date(syncState.lastSyncTime).toLocaleTimeString(lang === "en" ? "en-US" : "ar-YE") : curT.neverSynced}
          </span>
        </div>
      </div>

      {/* Security Check Banner */}
      {currentUser?.role !== "Doctor" && currentUser?.role !== "Nurse" && (
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-xs font-bold block">{curT.securityVerify}</span>
              <span className="text-[10px] text-slate-400 font-semibold block">{curT.mappingNote}</span>
            </div>
          </div>
          <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-widest uppercase shrink-0">
            AES-256 REST + JWT SECURE
          </span>
        </div>
      )}

      {/* Pending Queue Records Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <BadgeAlert className="w-5 h-5 text-orange-500" />
            <h3 className="text-sm font-extrabold text-slate-800">{curT.pendingQueue}</h3>
          </div>
          <p className="text-[11px] text-slate-400 font-semibold mt-1">{curT.pendingDesc}</p>
        </div>

        {pendingRecords.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-500/80 mx-auto mb-2" />
            <span className="text-xs font-bold text-slate-500 block">{curT.noPending}</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[650px]">
              <thead>
                <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200">
                  <th className="px-5 py-3">{curT.recordType}</th>
                  <th className="px-5 py-3">{lang === "en" ? "Record Identifier / Details" : "الرمز التعريفي / التفاصيل"}</th>
                  <th className="px-5 py-3">{curT.timestamp}</th>
                  <th className="px-5 py-3 text-center">{curT.retries}</th>
                  <th className="px-5 py-3">{curT.lastError}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-medium">
                {pendingRecords.map((rec) => {
                  let badge = "";
                  let label = "";
                  let detailText = "";

                  if (rec.type === "patient") {
                    badge = "bg-blue-100 text-blue-800 border-blue-200";
                    label = lang === "en" ? "CHILD REGISTRATION" : "تسجيل طفل";
                    detailText = `${rec.data.name} (${rec.data.sex}, ${rec.data.ageMonths}m)`;
                  } else {
                    badge = "bg-emerald-100 text-emerald-800 border-emerald-200";
                    label = lang === "en" ? "DIAGNOSTIC MEASUREMENT" : "قياس تشخيصي";
                    detailText = `Weight: ${rec.data.weightKg}kg, Height: ${rec.data.heightCm}cm, MUAC: ${rec.data.muacMm || "N/A"}mm`;
                  }

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`text-[9px] font-extrabold border px-2 py-0.5 rounded-full ${badge}`}>
                          {label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-800 min-w-[200px]">
                        <div className="flex flex-col">
                          <span className="font-mono text-[10px] text-slate-400 select-all">Queue ID: {rec.id}</span>
                          <span className="text-slate-800 mt-0.5">{detailText}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(rec.timestamp).toLocaleString(lang === "en" ? "en-US" : "ar-YE")}
                      </td>
                      <td className="px-5 py-3.5 text-center font-mono font-bold text-slate-700">
                        {rec.retryCount || 0}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[10px] text-rose-600 max-w-xs truncate">
                        {rec.lastError || <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Synchronization Audit Logs Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-700" />
              <h3 className="text-sm font-extrabold text-slate-800">{curT.syncLogs}</h3>
            </div>
            <p className="text-[11px] text-slate-400 font-semibold mt-1">{curT.syncLogsDesc}</p>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={curT.searchPlaceholder}
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#008DC9]"
            />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-bold text-xs">
            {curT.noLogs}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[550px]">
              <thead>
                <tr className="bg-slate-100 text-slate-500 font-bold uppercase text-[9px] border-b border-slate-200">
                  <th className="px-5 py-3">Packet ID</th>
                  <th className="px-5 py-3">{curT.timestamp}</th>
                  <th className="px-5 py-3">{curT.status}</th>
                  <th className="px-5 py-3">{curT.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-medium text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3.5 font-mono text-[10px] text-[#008DC9] font-black">
                      {log.id}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString(lang === "en" ? "en-US" : "ar-YE")}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <span className={`text-[9px] font-extrabold border px-2 py-0.5 rounded-full ${
                        log.status === "Success" 
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                          : "bg-rose-100 text-rose-800 border-rose-200"
                      }`}>
                        {log.status === "Success" ? (lang === "en" ? "SUCCESS" : "ناجحة") : (lang === "en" ? "FAILED" : "فاشلة")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 font-semibold">
                      {log.details || "Packets verified and archived successfully."}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
