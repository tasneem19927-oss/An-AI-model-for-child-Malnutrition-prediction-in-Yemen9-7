import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Language } from "../utils/translation";
import { indexedDbService, OfflineRecord } from "../utils/indexedDbService";
import { syncManager, SyncStatus } from "../utils/syncManager";
import { 
  Search, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  AlertCircle, 
  Clock, 
  UserCheck,
  Calendar, 
  Database,
  ChevronDown,
  ChevronUp,
  Activity,
  PlusCircle,
  Layers
} from "lucide-react";

interface RecordsSyncDashboardProps {
  lang: Language;
  onNavigateToNurse?: () => void;
}

export function RecordsSyncDashboard({ lang, onNavigateToNurse }: RecordsSyncDashboardProps) {
  const isAr = lang === "ar";
  
  // States
  const [syncState, setSyncState] = useState<SyncStatus>({
    online: navigator.onLine,
    pendingRecordsCount: 0,
    lastSyncTime: null,
    syncInProgress: false,
    deviceName: "Yemen-Mobile-Unit-8192",
    deviceId: "DEV-F81A"
  });

  const [patients, setPatients] = useState<any[]>([]);
  const [measurements, setMeasurements] = useState<any[]>([]);
  const [pendingRecords, setPendingRecords] = useState<OfflineRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "synced" | "pending">("all");
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Sync Log Audits
  const [syncLogs, setSyncLogs] = useState<any[]>([]);

  // Load all records (Local IndexedDB + Central Server)
  const fetchAllRecords = async () => {
    try {
      // 1. Get local patients from IndexedDB
      const localPatients = await indexedDbService.getPatients();
      
      // 2. Get local measurements from IndexedDB
      const localMeasurements = await indexedDbService.getMeasurements();
      
      // 3. Get offline pending records queue
      const pending = await indexedDbService.getOfflineRecords();
      setPendingRecords(pending);

      // 4. Load local sync logs
      const logs = await indexedDbService.getSyncLogs();
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setSyncLogs(logs);

      // 5. If online, fetch remote patients and remote measurements from central API
      let remotePatients: any[] = [];
      let remoteMeasurements: any[] = [];
      if (navigator.onLine) {
        try {
          const res = await fetch("/api/patients");
          if (res.ok) {
            remotePatients = await res.json();
            // Securely cache them in local IndexedDB for offline persistence
            for (const p of remotePatients) {
              await indexedDbService.savePatient(p);
            }
          }
        } catch (e) {
          console.warn("Could not fetch central patients database:", e);
        }

        try {
          const res = await fetch("/api/measurements");
          if (res.ok) {
            remoteMeasurements = await res.json();
            // Securely cache them in local IndexedDB for offline persistence
            for (const m of remoteMeasurements) {
              await indexedDbService.saveMeasurement(m);
            }
          }
        } catch (e) {
          console.warn("Could not fetch central measurements database:", e);
        }
      }

      // Merge patients (deduplicate by ID or name+parent)
      const mergedPatientsMap = new Map<string, any>();
      
      // Insert remote patients first
      remotePatients.forEach(p => {
        mergedPatientsMap.set(p.id, { ...p, isCloudRecord: true });
      });

      // Insert local patients (overwrite or add)
      localPatients.forEach(p => {
        const existing = mergedPatientsMap.get(p.id);
        mergedPatientsMap.set(p.id, {
          ...p,
          isCloudRecord: existing ? true : false,
          isLocalCached: true
        });
      });

      const combinedPatients = Array.from(mergedPatientsMap.values());
      
      // Sort: newest first
      combinedPatients.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.dateOfBirth || 0).getTime();
        const dateB = new Date(b.createdAt || b.dateOfBirth || 0).getTime();
        return dateB - dateA;
      });

      // Merge measurements (deduplicate by ID)
      const mergedMeasurementsMap = new Map<string, any>();
      remoteMeasurements.forEach(m => {
        mergedMeasurementsMap.set(m.id, m);
      });
      localMeasurements.forEach(m => {
        mergedMeasurementsMap.set(m.id, m);
      });
      const combinedMeasurements = Array.from(mergedMeasurementsMap.values());

      setPatients(combinedPatients);
      setMeasurements(combinedMeasurements);

    } catch (e) {
      console.error("Failed to load records database:", e);
    }
  };

  useEffect(() => {
    // Subscribe to SyncManager reactive changes
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
      fetchAllRecords();
    });

    fetchAllRecords();

    // Listen for custom sync events from SyncManager
    const handleSyncComplete = (e: any) => {
      const count = e.detail?.recordsCount || 0;
      if (count > 0) {
        setMessage({
          type: "success",
          text: isAr 
            ? `🟢 تمت المزامنة تلقائياً! تم رفع ${count} سجلات وتحديث قاعدة البيانات المركزية.`
            : `🟢 Auto-sync successful! Synchronized ${count} pending clinical records with central database.`
        });
        setTimeout(() => setMessage(null), 6000);
      }
      fetchAllRecords();
    };

    window.addEventListener("synchronization-completed", handleSyncComplete);

    // Dynamic browser network connection indicators
    const handleOnline = () => {
      setMessage({
        type: "info",
        text: isAr ? "⚡ تم استعادة شبكة الإنترنت. جاري بدء المزامنة الخلفية..." : "⚡ Internet connection restored. Initiating auto background synchronization..."
      });
      setTimeout(() => setMessage(null), 4000);
      fetchAllRecords();
    };

    window.addEventListener("online", handleOnline);

    return () => {
      unsubscribe();
      window.removeEventListener("synchronization-completed", handleSyncComplete);
      window.removeEventListener("online", handleOnline);
    };
  }, [lang]);

  // Handle Manual Synchronize Now
  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setMessage({
      type: "info",
      text: isAr ? "جاري تشغيل خط مزامنة PostgreSQL السحابي..." : "Running secure PostgreSQL cloud synchronization pipeline..."
    });

    try {
      const outcome = await syncManager.synchronize();
      if (outcome.success) {
        if (outcome.syncedCount > 0) {
          setMessage({
            type: "success",
            text: isAr 
              ? `🎉 تمت المزامنة السحابية بنجاح! تم رفع ${outcome.syncedCount} سجلات طبية مع منع التكرار.`
              : `🎉 Cloud synchronization completed! Uploaded ${outcome.syncedCount} medical record(s). Bypassed duplicates.`
          });
        } else {
          setMessage({
            type: "success",
            text: isAr ? "✓ السجلات متزامنة بالكامل مع السيرفر السحابي المركزي." : "✓ All records are already fully synchronized with the central cloud server."
          });
        }
      } else {
        setMessage({
          type: "error",
          text: isAr ? `🔴 فشلت المزامنة: ${outcome.message}` : `🔴 Sync failed: ${outcome.message}`
        });
      }
    } catch (e: any) {
      setMessage({
        type: "error",
        text: isAr ? "🔴 انقطع الاتصال بالخادم الرئيسي." : "🔴 Failed to reach central PostgreSQL database server."
      });
    } finally {
      setSyncing(false);
      fetchAllRecords();
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Check Sync Status for a specific Patient
  const getPatientSyncStatus = (patient: any) => {
    // A patient is pending sync if:
    // 1. Their ID starts with TEMP-PAT-
    // 2. OR they are present in the offline_records queue as a patient or measurement
    const isTemp = patient.id.startsWith("TEMP-PAT-");
    
    const isPendingInQueue = pendingRecords.some(
      rec => (rec.type === "patient" && rec.data?.id === patient.id) || 
             (rec.type === "measurement" && rec.data?.patientId === patient.id)
    );

    return !(isTemp || isPendingInQueue);
  };

  // Filter and Search Patient Records
  const processedRecords = patients.map(p => {
    const isSynced = getPatientSyncStatus(p);
    const patientMeasurements = measurements.filter(m => m.patientId === p.id);
    
    // Sort measurements: newest first
    patientMeasurements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const lastMeasurement = patientMeasurements[0];

    return {
      ...p,
      isSynced,
      measurements: patientMeasurements,
      lastMeasurement,
      recordedBy: lastMeasurement?.recordedBy || "Nurse Reem Al-Asiri"
    };
  }).filter(record => {
    // 1. Apply Filter status
    if (filterStatus === "synced" && !record.isSynced) return false;
    if (filterStatus === "pending" && record.isSynced) return false;

    // 2. Apply Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const dateStr = record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "";
    
    return (
      record.name.toLowerCase().includes(q) ||
      record.id.toLowerCase().includes(q) ||
      record.recordedBy.toLowerCase().includes(q) ||
      dateStr.includes(q) ||
      record.parentName.toLowerCase().includes(q)
    );
  });

  // Calculation Metrics
  const totalCount = patients.length;
  const syncedCount = patients.filter(p => getPatientSyncStatus(p)).length;
  const pendingCount = totalCount - syncedCount;

  // Local storage date of last sync
  const lastSyncLabel = syncState.lastSyncTime 
    ? new Date(syncState.lastSyncTime).toLocaleString(isAr ? "ar-YE" : "en-US") 
    : (isAr ? "لم تتم المزامنة بعد" : "No sync history found");

  return (
    <div className="space-y-6" id="records-sync-portal" dir={isAr ? "rtl" : "ltr"}>
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 rounded-xl text-[#008DC9] block">
              <Database className="w-5 h-5 animate-pulse" />
            </span>
            <h1 className="text-xl font-black text-slate-800">
              {isAr ? "سجلات الماك والعيادة والمزامنة" : "Clinical Records & Cloud Sync Hub"}
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-semibold">
            {isAr 
              ? "متابعة سجلات الأطفال المقاسين، تصفية البيانات غير المرفوعة، ومزامنة البيانات السحابية مع منع التكرار."
              : "Track child anthropometric records, filter pending uploads, and run resilient cloud synchronization with duplicate-checks."}
          </p>
        </div>

        {/* Sync Now Trigger button */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className={`flex-1 md:flex-none font-bold text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
              syncing
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? (isAr ? "جاري المزامنة السحابية..." : "Syncing to Cloud...") : (isAr ? "مزامنة الآن" : "Sync Now")}
          </button>
        </div>
      </div>

      {/* Connectivity Banner & Feedback Alert */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-4 rounded-xl border flex items-start gap-3 text-xs font-semibold ${
              message.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
              message.type === "error" ? "bg-rose-50 text-rose-800 border-rose-200" :
              "bg-blue-50 text-blue-800 border-blue-200"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p>{message.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Summary Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {isAr ? "إجمالي السجلات" : "Total Patient Records"}
            </span>
            <Layers className="w-4 h-4 text-[#008DC9]" />
          </div>
          <span className="text-3xl font-black text-slate-800 block">{totalCount}</span>
          <p className="text-[10px] text-slate-400 font-semibold block">
            {isAr ? "سجلات مسجلة في هذا الجهاز" : "Unique clinical patients tracked"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {isAr ? "سجلات متزامنة" : "Synchronized Records"}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse block" />
          </div>
          <span className="text-3xl font-black text-emerald-600 block">{syncedCount}</span>
          <p className="text-[10px] text-emerald-600 font-bold block">
            ✓ {isAr ? "مؤمنة في السحابة" : "Encrypted & secured on PostgreSQL Cloud"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {isAr ? "بانتظار المزامنة" : "Pending Sync Queue"}
            </span>
            <span className={`w-2.5 h-2.5 rounded-full block ${pendingCount > 0 ? "bg-amber-500 animate-ping" : "bg-slate-300"}`} />
          </div>
          <span className={`text-3xl font-black block ${pendingCount > 0 ? "text-amber-600" : "text-slate-400"}`}>
            {pendingCount}
          </span>
          <p className="text-[10px] text-slate-400 font-semibold block">
            {pendingCount > 0 
              ? (isAr ? "سجلات تنتظر رفعها للسحابة" : "Pending secure database upload")
              : (isAr ? "لا توجد سجلات معلقة" : "All local data fully flushed")}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-2 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              {isAr ? "شبكة الإنترنت" : "Network Integration"}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              {syncState.online ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-black text-emerald-600 uppercase">
                    {isAr ? "متصل - متاح" : "CONNECTED"}
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-black text-rose-500 uppercase animate-pulse">
                    {isAr ? "غير متصل" : "OFFLINE CACHING"}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-semibold">
            <span>{isAr ? "آخر مزامنة:" : "Last sync:"} </span>
            <span className="font-bold text-slate-700 block mt-0.5">{lastSyncLabel}</span>
          </div>
        </div>
      </div>

      {/* Main Table Content Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Controls Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Search bar */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isAr ? "ابحث باسم الطفل، المعرّف، الممرض..." : "Search by child name, ID, nurse, or date..."}
              className={`w-full bg-white border border-slate-200 rounded-xl py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all ${isAr ? "pr-3 pl-10 text-right" : "pl-10 pr-4"}`}
            />
          </div>

          {/* Filter Status Selector */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setFilterStatus("all")}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
                filterStatus === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {isAr ? "الكل" : "All"} ({totalCount})
            </button>
            <button
              onClick={() => setFilterStatus("synced")}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
                filterStatus === "synced"
                  ? "bg-white text-emerald-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {isAr ? "متزامن" : "Synced"} ({syncedCount})
            </button>
            <button
              onClick={() => setFilterStatus("pending")}
              className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg uppercase transition-all cursor-pointer ${
                filterStatus === "pending"
                  ? "bg-white text-amber-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {isAr ? "معلق" : "Pending"} ({pendingCount})
            </button>
          </div>
        </div>

        {/* Database Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-slate-700 border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider border-b border-slate-150 text-center">
                <th className="py-4.5 px-6 text-slate-500 text-left w-1/12">{isAr ? "تاريخ السجل" : "Record Date"}</th>
                <th className="py-4.5 px-6 text-slate-500 text-left w-3/12">{isAr ? "الاسم ومعلومات الطفل" : "Child Demographics"}</th>
                <th className="py-4.5 px-6 text-slate-500 text-left w-2/12">{isAr ? "اسم الممرض" : "Assessing Nurse"}</th>
                <th className="py-4.5 px-6 text-slate-500 text-center w-2/12">{isAr ? "حالة المزامنة" : "Sync Status"}</th>
                <th className="py-4.5 px-6 text-slate-500 text-center w-2/12">{isAr ? "تاريخ آخر مزامنة" : "Last Sync Timestamp"}</th>
                <th className="py-4.5 px-6 w-1/12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {processedRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    <div className="space-y-2">
                      <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-sm">{isAr ? "لم يتم العثور على أي سجلات مطابقة" : "No clinical patient records matched your filter."}</p>
                      {onNavigateToNurse && (
                        <button 
                          onClick={onNavigateToNurse}
                          className="text-xs text-[#008DC9] font-bold hover:underline flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          {isAr ? "إدخال قياس طبي جديد" : "Log a new measurement now"}
                          <PlusCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                processedRecords.map((record) => {
                  const isExpanded = expandedPatientId === record.id;
                  
                  return (
                    <React.Fragment key={record.id}>
                      <tr className="hover:bg-slate-50/50 transition-colors text-xs font-medium">
                        {/* Record Date */}
                        <td className="py-4 px-6 text-slate-500 font-semibold text-center md:text-left whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span>
                              {record.createdAt 
                                ? new Date(record.createdAt).toLocaleDateString(isAr ? "ar-YE" : "en-US")
                                : (isAr ? "غير محدد" : "N/A")}
                            </span>
                          </div>
                        </td>

                        {/* Child Demographics */}
                        <td className="py-4 px-6 text-left">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 text-sm block">
                              {record.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                              <span>ID: <strong className="font-mono text-slate-600">{record.id}</strong></span>
                              <span>•</span>
                              <span>{record.ageMonths} {isAr ? "شهراً" : "months"}</span>
                              <span>•</span>
                              <span>{isAr ? (record.sex === "Male" ? "ذكر" : "أنثى") : record.sex}</span>
                            </div>
                          </div>
                        </td>

                        {/* Assessing Nurse */}
                        <td className="py-4 px-6 text-left text-slate-600">
                          <div className="flex items-center gap-1.5 font-bold">
                            <UserCheck className="w-4 h-4 text-slate-400" />
                            <span>{record.recordedBy}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {isAr ? "العيادة / الوحدة المتنقلة" : "Rural Mobile Clinic"}
                          </span>
                        </td>

                        {/* Sync status */}
                        <td className="py-4 px-6 text-center">
                          <div className="flex justify-center">
                            {record.isSynced ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-extrabold uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" />
                                {isAr ? "متزامن سحابياً" : "Synced"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-800 border border-rose-200 rounded-full text-[10px] font-extrabold uppercase animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 block" />
                                {isAr ? "بانتظار الرفع" : "Pending"}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Last sync timestamp */}
                        <td className="py-4 px-6 text-center text-slate-500 font-mono text-[11px]">
                          {record.isSynced ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-slate-700">
                                {syncState.lastSyncTime 
                                  ? new Date(syncState.lastSyncTime).toLocaleDateString() 
                                  : new Date().toLocaleDateString()}
                              </span>
                              <span className="text-[9px] text-slate-400 block">
                                {syncState.lastSyncTime 
                                  ? new Date(syncState.lastSyncTime).toLocaleTimeString() 
                                  : new Date().toLocaleTimeString()}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">
                              {isAr ? "مخزن محلياً" : "Local Encrypted"}
                            </span>
                          )}
                        </td>

                        {/* Accordion toggle */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => setExpandedPatientId(isExpanded ? null : record.id)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-all text-slate-400 hover:text-slate-800 cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Measurements Row details */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70">
                          <td colSpan={6} className="p-6">
                            <div className="border border-slate-200 bg-white rounded-2xl p-5 space-y-4 shadow-sm">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                  <Activity className="w-4 h-4 text-[#008DC9]" />
                                  {isAr ? "القياسات والتشخيصات المسجلة للطفل" : "Logged Measurements & Clinical Diagnostics"}
                                </h3>
                                <span className="text-[10px] text-slate-400 font-extrabold font-mono">
                                  {record.measurements.length} {isAr ? "زيارات مسجلة" : "Assessments"}
                                </span>
                              </div>

                              {record.measurements.length === 0 ? (
                                <p className="text-xs text-slate-500 italic">
                                  {isAr 
                                    ? "لا توجد قياسات مسجلة لهذا الطفل بعد. يرجى إدخال قياس طبي في لوحة الممرض."
                                    : "No measurements logged for this child yet. Please log one under the Nurse entry panel."}
                                </p>
                              ) : (
                                <div className="space-y-4">
                                  {record.measurements.map((m: any, idx: number) => (
                                    <div key={m.id || idx} className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100 text-xs">
                                      
                                      {/* Anthropometric variables */}
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">{isAr ? "القياسات الجسدية" : "Physical Stats"}</span>
                                        <p className="font-bold text-slate-800">
                                          {isAr ? "الوزن" : "Weight"}: <span className="font-black font-mono">{m.weightKg}</span> {isAr ? "كجم" : "kg"}
                                        </p>
                                        <p className="font-bold text-slate-800">
                                          {isAr ? "الطول" : "Height"}: <span className="font-black font-mono">{m.heightCm}</span> {isAr ? "سم" : "cm"}
                                        </p>
                                        {m.muacMm && (
                                          <p className="font-bold text-slate-800">
                                            MUAC: <span className="font-black font-mono">{m.muacMm}</span> {isAr ? "ملم" : "mm"}
                                          </p>
                                        )}
                                      </div>

                                      {/* Symptomatic checklist */}
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">{isAr ? "الأعراض السريرية" : "Clinical Checklist"}</span>
                                        <p className="font-semibold text-slate-700">
                                          {isAr ? "الوذمة ثنائية القدمين:" : "Pitting Oedema:"}{" "}
                                          <span className={`font-bold px-1.5 py-0.5 rounded ${m.oedema ? "bg-red-50 text-red-700 font-black" : "bg-slate-100 text-slate-600"}`}>
                                            {m.oedema ? (isAr ? "موجودة" : "OEDEMA POSITIVE") : (isAr ? "سليم" : "None")}
                                          </span>
                                        </p>
                                        <p className="font-semibold text-slate-600">
                                          {isAr ? "يرضع طبيعياً:" : "Breastfeeding:"}{" "}
                                          <span className="font-bold text-slate-800">{m.breastfeeding ? (isAr ? "نعم" : "Yes") : (isAr ? "لا" : "No")}</span>
                                        </p>
                                        <p className="font-semibold text-slate-600">
                                          {isAr ? "إسهال حديث:" : "Recent Diarrhea:"}{" "}
                                          <span className="font-bold text-slate-800">{m.diarrheaRecent ? (isAr ? "نعم" : "Yes") : (isAr ? "لا" : "No")}</span>
                                        </p>
                                      </div>

                                      {/* Log metadata info */}
                                      <div className="space-y-1">
                                        <span className="text-[9px] font-black uppercase text-slate-400 block">{isAr ? "معلومات الفحص" : "Assessment Info"}</span>
                                        <p className="font-semibold text-slate-600">
                                          {isAr ? "الجهة المسجلة:" : "Filer Profile:"} <span className="font-bold text-slate-800">{m.recordedBy || "Nurse Reem"}</span>
                                        </p>
                                        <p className="font-semibold text-slate-600">
                                          {isAr ? "تاريخ الزيارة:" : "Timestamp:"} <span className="font-bold text-slate-800">{new Date(m.createdAt || m.date).toLocaleString()}</span>
                                        </p>
                                      </div>

                                      {/* Conflict/Sync Prevention rule display */}
                                      <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100/50 flex flex-col justify-between">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide block">{isAr ? "منع تكرار السجل" : "Duplicate Prevention"}</span>
                                        <p className="text-[10px] text-blue-900 leading-relaxed font-semibold mt-1">
                                          {isAr 
                                            ? "خوارزمية الفرز تفحص الاسم والسن والوالد لمنع تكرار الرفع والحد من استهلاك الذاكرة."
                                            : "Sync ledger cross-checks name, age, and parent parameters to safeguard database integrity."}
                                        </p>
                                      </div>

                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Sync Operation Logs History Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden" id="sync-operations-audits">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#008DC9]" />
              {isAr ? "سجل عمليات المزامنة والتدقيق السحابي" : "Sync Operations & Security Audit Ledger"}
            </h2>
            <p className="text-xs text-slate-500 font-semibold">
              {isAr 
                ? "سجل المراقبة والتدقيق الفني لعمليات رفع البيانات الطبية لقاعدة PostgreSQL المركزية."
                : "Continuous cryptographic audit trace of bulk synchronization packets sent to cloud server."}
            </p>
          </div>
        </div>

        <div className="p-6">
          {syncLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs italic font-medium">
              {isAr ? "لا توجد عمليات مزامنة مسجلة بعد" : "No synchronization events logged in device audit cache."}
            </div>
          ) : (
            <div className="space-y-3 max-h-56 overflow-y-auto">
              {syncLogs.slice(0, 10).map((log: any) => (
                <div key={log.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-start justify-between gap-4 text-xs font-semibold">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${log.status === "Success" ? "bg-emerald-500" : "bg-rose-500"}`} />
                      <span className="font-bold text-slate-800 uppercase text-[11px]">{log.type} Synchronization ({log.id})</span>
                      <span className="text-[10px] text-slate-400 font-medium">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed font-medium pl-4">{log.details}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wide ${log.status === "Success" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                    {log.status === "Success" ? (isAr ? "نجح" : "Success") : (isAr ? "فشل" : "Failed")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
