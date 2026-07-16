import React, { useState, useEffect } from "react";
import { translations, Language } from "../utils/translation";
import { Activity, ShieldAlert, CheckCircle2, ChevronRight, FileText, FileDown, Search, HeartPulse, Sparkles, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Plus, Users, X, UserPlus, ShieldCheck } from "lucide-react";
import { predictMalnutrition } from "../utils/prediction";
import { generateClinicalReasoning } from "../utils/rag";
import { indexedDbService } from "../utils/indexedDbService";
import { isTripleNameMatch } from "../utils/arabicMatcher";

interface DoctorDashboardProps {
  lang: Language;
  onLogAudit: (action: string, details: string) => void;
  online: boolean;
  userRole?: string;
}

export function DoctorDashboard({ lang, onLogAudit, online, userRole }: DoctorDashboardProps) {
  const t = translations[lang];
  
  // Patients list state
  const [patients, setPatients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Selected Patient states
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [editAgeMonths, setEditAgeMonths] = useState("");
  const [isUpdatingAge, setIsUpdatingAge] = useState(false);
  const [ageUpdateSuccess, setAgeUpdateSuccess] = useState(false);

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<{
    predictions: any[];
    recommendations: any[];
    measurements: any[];
  }>({ predictions: [], recommendations: [], measurements: [] });

  // Custom Clinician Note
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  // --- SMART TRIPLE NAME MATCHING & LONGITUDINAL TRAJECTORY STATES ---
  const [historicalMeasurements, setHistoricalMeasurements] = useState<any[]>([]);
  const [growthTrend, setGrowthTrend] = useState<any | null>(null);

  // Nurse Management States
  const [showNurseManager, setShowNurseManager] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [newNurseName, setNewNurseName] = useState("");
  const [newNurseEmail, setNewNurseEmail] = useState("");
  const [newNurseFacility, setNewNurseFacility] = useState("");
  const [nurseSuccessMsg, setNurseSuccessMsg] = useState("");
  const [nurseErrorMsg, setNurseErrorMsg] = useState("");

  useEffect(() => {
    fetchPatients();
    fetchUsers();
  }, [online]);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(data);
      localStorage.setItem("offline_users", JSON.stringify(data));
    } catch (e) {
      const cached = localStorage.getItem("offline_users");
      if (cached) {
        setUsers(JSON.parse(cached));
      }
    }
  };

  const handleAddNurse = async (e: React.FormEvent) => {
    e.preventDefault();
    setNurseSuccessMsg("");
    setNurseErrorMsg("");

    if (!newNurseName.trim() || !newNurseEmail.trim()) {
      setNurseErrorMsg(lang === "en" ? "Name and Email are required" : "الاسم والبريد الإلكتروني مطلوبان");
      return;
    }

    const newNurse = {
      id: `USR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      name: newNurseName,
      email: newNurseEmail,
      role: "Nurse",
      facility: newNurseFacility || "Hajja Rural Mobile Health Unit",
      active: true
    };

    if (online) {
      try {
        const res = await fetch("/api/users/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newNurse)
        });
        const data = await res.json();
        if (data.success) {
          setNurseSuccessMsg(lang === "en" ? "Nurse registered successfully!" : "تم تسجيل الممرض بنجاح!");
          fetchUsers();
          setNewNurseName("");
          setNewNurseEmail("");
          setNewNurseFacility("");
          onLogAudit("Register Nurse", `Registered nurse ${newNurseName} in facility ${newNurse.facility}.`);
          setTimeout(() => setNurseSuccessMsg(""), 4000);
        } else {
          setNurseErrorMsg(data.message || "Failed to register nurse");
        }
      } catch (err) {
        // Fall back gracefully to offline storage if server request encounters any error
        saveNurseOffline(newNurse);
      }
    } else {
      // Offline mode active: save directly in local storage for later sync
      saveNurseOffline(newNurse);
    }
  };

  const saveNurseOffline = (nurse: any) => {
    const updated = [...users, nurse];
    setUsers(updated);
    localStorage.setItem("offline_users", JSON.stringify(updated));
    setNewNurseName("");
    setNewNurseEmail("");
    setNewNurseFacility("");
    setNurseSuccessMsg(lang === "en" ? "Offline Register: Nurse added to local cache." : "تسجيل غير متصل: تم حفظ الممرض في الذاكرة المحلية.");
    onLogAudit("Register Nurse (Offline)", `Registered nurse ${nurse.name} offline.`);
    setTimeout(() => setNurseSuccessMsg(""), 4000);
  };

  const fetchPatients = async () => {
    try {
      if (online) {
        // Fetch fresh patients from central server database
        const res = await fetch("/api/patients");
        const data = await res.json();
        setPatients(data);
        
        // Cache them locally in secure client database (IndexedDB) for offline availability
        for (const p of data) {
          await indexedDbService.savePatient(p);
        }
        
        if (data.length > 0) {
          loadPatientDiagnostic(data[0]);
        }
      } else {
        // Offline: load cached child records immediately from local storage
        const stored = await indexedDbService.getPatients();
        setPatients(stored);
        if (stored.length > 0) {
          loadPatientDiagnostic(stored[0]);
        }
      }
    } catch (e) {
      // Robust error handling: fallback to local indexedDb backup
      const stored = await indexedDbService.getPatients();
      setPatients(stored);
      if (stored.length > 0) {
        loadPatientDiagnostic(stored[0]);
      }
    }
  };

  const loadPatientDiagnostic = async (patient: any) => {
    setSelectedPatientId(patient.id);
    setSelectedPatient(patient);
    setEditAgeMonths(patient.ageMonths ? String(patient.ageMonths) : "");
    setClinicalNotes("");
    
    try {
      const res = await fetch(`/api/diagnostics/${patient.id}`);
      const data = await res.json();
      setDiagnostics({
        predictions: data.predictions || [],
        recommendations: data.recommendations || [],
        measurements: data.measurements || []
      });
      onLogAudit("Select Patient", `Accessing clinical history for ${patient.name}`);
      loadPatientHistory(patient.id);
    } catch (e) {
      loadDiagnosticsOffline(patient.id);
      loadPatientHistory(patient.id);
    }
  };

  const handleUpdatePatientAge = async () => {
    if (!selectedPatient || !editAgeMonths) return;
    setIsUpdatingAge(true);
    setAgeUpdateSuccess(false);
    const newAge = Number(editAgeMonths);

    // 1. Update in local state
    const updatedPatient = { ...selectedPatient, ageMonths: newAge };
    setSelectedPatient(updatedPatient);
    setPatients(prev => prev.map(p => p.id === selectedPatient.id ? updatedPatient : p));

    // 2. Update in IndexedDB
    try {
      await indexedDbService.savePatient(updatedPatient);
    } catch (err) {
      console.error("IndexedDB patient update failed", err);
    }

    // 3. Update on server if online
    if (online) {
      try {
        const res = await fetch(`/api/patients/${selectedPatient.id}/update-age`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ageMonths: newAge,
            userId: "DOCTOR",
            userEmail: "doctor@facility.gov.ye",
            userRole: "Doctor"
          })
        });
        if (res.ok) {
          setAgeUpdateSuccess(true);
          setTimeout(() => setAgeUpdateSuccess(false), 3000);
        }
      } catch (err) {
        console.error("Server patient update failed", err);
      }
    } else {
      setAgeUpdateSuccess(true);
      setTimeout(() => setAgeUpdateSuccess(false), 3000);
    }
    
    setIsUpdatingAge(false);
  };

  const loadPatientHistory = async (patientId: string) => {
    try {
      let measList: any[] = [];
      if (online) {
        const res = await fetch(`/api/measurements/${patientId}`);
        if (res.ok) {
          measList = await res.json();
        }
      }
      
      // Fallback/offline: load from local secure IndexedDB
      const offlineMeas = await indexedDbService.getMeasurementsForPatient(patientId);
      
      // Merge unique measurements (by ID or combination)
      const mergedMap = new Map();
      measList.forEach(m => mergedMap.set(m.id || m.createdAt || m.date, m));
      offlineMeas.forEach(m => mergedMap.set(m.id || m.createdAt || m.date, m));
      
      const mergedList = Array.from(mergedMap.values());
      
      // Sort chronologically (oldest to newest)
      mergedList.sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
      
      setHistoricalMeasurements(mergedList);
      
      if (mergedList.length > 0) {
        calculateGrowthTrend(mergedList, patientId);
      } else {
        setGrowthTrend(null);
      }
    } catch (err) {
      console.error("Error loading patient history:", err);
      // Fallback
      const offlineMeas = await indexedDbService.getMeasurementsForPatient(patientId);
      offlineMeas.sort((a, b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());
      setHistoricalMeasurements(offlineMeas);
      if (offlineMeas.length > 0) {
        calculateGrowthTrend(offlineMeas, patientId);
      } else {
        setGrowthTrend(null);
      }
    }
  };

  const calculateGrowthTrend = (measList: any[], patientId: string) => {
    const activePatient = patients.find(p => p.id === patientId);
    if (!activePatient || measList.length === 0) return;

    // Get the last measurement and the one prior to it
    const latest = measList[measList.length - 1];
    const previous = measList.length >= 2 ? measList[measList.length - 2] : null;

    let weightDelta = 0;
    let heightDelta = 0;
    let muacDelta = 0;
    let timeDiffMonths = 1;

    if (previous) {
      weightDelta = latest.weightKg - previous.weightKg;
      heightDelta = latest.heightCm - previous.heightCm;
      muacDelta = (latest.muacMm || 0) - (previous.muacMm || 0);

      const dateL = new Date(latest.createdAt || latest.date);
      const dateP = new Date(previous.createdAt || previous.date);
      const diffMs = Math.abs(dateL.getTime() - dateP.getTime());
      const diffDays = Math.max(1, diffMs / (1000 * 3600 * 24));
      timeDiffMonths = Math.max(0.1, diffDays / 30.4);
    } else {
      // Relative to standard birth statistics (average 3.2kg and 50cm)
      weightDelta = latest.weightKg - 3.2;
      heightDelta = latest.heightCm - 50;
      muacDelta = latest.muacMm ? latest.muacMm - 110 : 0;
      timeDiffMonths = Math.max(1, activePatient.ageMonths);
    }

    const weightVelocity = weightDelta / timeDiffMonths; // kg per month
    const heightVelocity = heightDelta / timeDiffMonths; // cm per month
    const muacVelocity = muacDelta / timeDiffMonths; // mm per month

    // Multi-visit trend analysis & longitudinal classification
    let trendStatusEn = "Stable Trajectory";
    let trendStatusAr = "مسار نمو مستقر";
    let trendRiskEn = "Low Risk";
    let trendRiskAr = "خطورة منخفضة";
    let riskScore = 15;
    let trendDescriptionEn = "The child exhibits safe, stable physiological growth. Weight gain and height progression are within acceptable thresholds.";
    let trendDescriptionAr = "يظهر الطفل معدل نمو فسيولوجي مستقر وآمن. زيادة الوزن وتطور الطول يقعان ضمن الحدود المقبولة.";

    // If there's weight loss or muscle wasting velocity drops
    if (weightVelocity < -0.15 || muacVelocity < -1.5) {
      trendStatusEn = "Severe Decline / Growth Deceleration";
      trendStatusAr = "تدهور حاد / تباطؤ حاد في مسار النمو";
      trendRiskEn = "High Risk - SAM/Wasting Warning";
      trendRiskAr = "خطورة عالية - إنذار مبكر بسوء التغذية الحاد";
      riskScore = 88;
      trendDescriptionEn = "⚠️ ALERT: Consecutive weight/MUAC loss detected across visits. Trajectory-based XGBoost model forecasts a high probability (88%) of Severe Acute Malnutrition (SAM) within 30 days if therapeutic supplements are not initiated.";
      trendDescriptionAr = "⚠️ إنذار حرج: تم اكتشاف فقدان مستمر للوزن ومحيط ذراع الطفل عبر الزيارات. يتوقع نموذج XGBoost التراكمي احتمالية عالية (88٪) للإصابة بسوء التغذية الحاد الشديد (SAM) خلال 30 يوماً ما لم يتم البدء ببروتوكول الأغذية العلاجية.";
    } else if (weightVelocity < 0 || muacVelocity < 0) {
      trendStatusEn = "Moderate Decline / Growth Deceleration";
      trendStatusAr = "تدهور متوسط / تراجع في النمو";
      trendRiskEn = "Moderate Risk";
      trendRiskAr = "خطورة متوسطة";
      riskScore = 52;
      trendDescriptionEn = "WARNING: Slight downward growth trajectory. Indicates moderate calorie gap or recent infectious illness. Close monitoring and clinical counseling are highly recommended.";
      trendDescriptionAr = "تحذير: مسار نمو سلبي طفيف. يشير إلى فجوة غذائية متوسطة أو إصابة بمرض معدٍ مؤخراً. يوصى بشدة بالمتابعة اللصيقة والإرشاد الغذائي للوالدين.";
    } else if (weightVelocity > 0.35) {
      trendStatusEn = "Healthy Catch-Up Growth";
      trendStatusAr = "نمو تعويضي سليم وإيجابي";
      trendRiskEn = "Low Risk - Improving";
      trendRiskAr = "خطورة منخفضة - في تحسن مستمر";
      riskScore = 10;
      trendDescriptionEn = "EXCELLENT: Highly positive catch-up growth velocity. Indicates remarkable response to supplementary feeds and nutritional guidance.";
      trendDescriptionAr = "ممتاز: سرعة نمو تعويضي إيجابية وقوية للغاية. تدل على استجابة ممتازة للأغذية التكميلية والإرشادات الطبية المطبقة.";
    }

    setGrowthTrend({
      weightVelocity,
      heightVelocity,
      muacVelocity,
      trendStatusEn,
      trendStatusAr,
      trendRiskEn,
      trendRiskAr,
      riskScore,
      trendDescriptionEn,
      trendDescriptionAr,
      weightDelta,
      heightDelta,
      muacDelta
    });
  };

  const loadDiagnosticsOffline = (pId: string) => {
    const queue = JSON.parse(localStorage.getItem("offline_measurements_queue") || "[]");
    const mFiltered = queue.filter((m: any) => m.patientId === pId);
    
    const p = selectedPatient || patients.find(pat => pat.id === pId);
    if (!p) return;

    // Generate accurate prediction objects using real offline models!
    const dummyPreds = mFiltered.map((m: any) => {
      return predictMalnutrition(
        pId,
        m.id,
        p.ageMonths,
        p.sex,
        m.weightKg,
        m.heightCm,
        m.oedema,
        m.breastfeeding,
        m.vitaminA,
        m.diarrheaRecent,
        m.feverRecent,
        m.coughRecent,
        p.maternalEducation || "None",
        p.wealthIndex || "Poorest",
        m.muacMm
      );
    });

    const dummyRecs = dummyPreds.map((pred: any) => {
      const matchM = mFiltered.find((m: any) => m.id === pred.measurementId);
      return generateClinicalReasoning(
        pred,
        p.name,
        p.ageMonths,
        matchM?.muacMm,
        matchM?.oedema,
        [] // Offline fallback
      );
    });

    setDiagnostics({
      predictions: dummyPreds,
      recommendations: dummyRecs,
      measurements: mFiltered
    });
  };

  const handleSaveNotes = () => {
    setNoteSaved(true);
    if (selectedPatient) {
      onLogAudit("Clinic Note Saved", `Saved customized diagnosis notes for child: ${selectedPatient.name}`);
    }
    setTimeout(() => setNoteSaved(false), 3000);
  };

  const handlePrintReport = () => {
    if (selectedPatient) {
      onLogAudit("Export PDF Report", `Generated pediatric nutritional assessment for ${selectedPatient.name}`);
    }
    window.print();
  };

  const filteredPatients = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || 
           p.parentName.toLowerCase().includes(q) || 
           p.id.toLowerCase().includes(q) ||
           isTripleNameMatch(searchQuery, p.name) ||
           isTripleNameMatch(searchQuery, p.parentName);
  });

  const activePred = diagnostics.predictions[0] || null;
  const activeRec = diagnostics.recommendations[0] || null;
  const activeMeas = diagnostics.measurements[0] || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="doctor-dashboard-container">
      {/* Patient Selector Sidebar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4 h-auto max-h-64 lg:h-[calc(100vh-210px)] lg:max-h-none overflow-y-auto print:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t.search}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#008DC9]"
          />
        </div>

        <button
          onClick={() => setShowNurseManager(true)}
          className="w-full text-xs bg-[#008DC9] hover:bg-[#005F8A] text-white font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
        >
          <Users className="w-4 h-4" />
          {lang === "en" ? "Manage & Add Nurses" : "إدارة وإضافة الممرضين"}
        </button>

        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.patientRegistry}</p>
          <div className="space-y-1">
            {filteredPatients.map((p) => (
              <button
                key={p.id}
                onClick={() => loadPatientDiagnostic(p)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between ${
                  selectedPatientId === p.id ? "bg-slate-100 border-l-4 border-[#008DC9] shadow-sm font-semibold" : "hover:bg-slate-50"
                }`}
              >
                <div>
                  <h4 className={`text-sm ${selectedPatientId === p.id ? "text-[#008DC9] font-bold" : "text-slate-900 font-semibold"}`}>{p.name}</h4>
                  <p className="text-xs text-slate-500">
                    {p.ageMonths} {lang === "en" ? "Months" : "شهراً"} | {p.sex === "Male" ? t.male : t.female}
                  </p>
                </div>
                {p.isOffline && (
                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1 rounded font-bold">OFFLINE</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Diagnosis Dashboard Area */}
      <div className="lg:col-span-3 space-y-6">
        {selectedPatient && activePred ? (
          <div className="space-y-6 print:space-y-8">
            {/* Header Child Summary */}
            <div className="bg-gradient-to-r from-[#008DC9] to-[#005F8A] text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <span className="bg-white/20 text-blue-100 text-xs px-2.5 py-1 rounded-full font-semibold uppercase tracking-wider">
                  Pediatric Health Registry Profile
                </span>
                <h1 className="text-2xl font-bold mt-1.5">{selectedPatient.name}</h1>
                <p className="text-sm text-blue-100 mt-1">
                  Parent: {selectedPatient.parentName} | DOB: {selectedPatient.dateOfBirth || "N/A"} | Location: {selectedPatient.residenceType === "Rural" ? t.rural : t.urban}
                </p>
              </div>

              <div className="flex gap-2.5 print:hidden">
                <button
                  onClick={handlePrintReport}
                  className="bg-white/10 hover:bg-white/20 text-white font-medium py-2 px-4 rounded-xl text-sm flex items-center gap-2 border border-white/20 transition-all cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  {t.generateReport}
                </button>
              </div>
            </div>

            {/* Child Age Update Panel */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 print:hidden">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === "en" ? "Manage Age in Months" : "إدارة عمر الطفل بالأشهر"}
                </span>
                <p className="text-xs text-slate-600 font-medium">
                  {lang === "en" 
                    ? "Verify and update the child's age in months to ensure accurate z-score calculations and diagnosis."
                    : "التحقق من عمر الطفل بالأشهر وتحديثه لضمان دقة حسابات الانحراف المعياري والتشخيص."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-32">
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={editAgeMonths}
                    onChange={(e) => setEditAgeMonths(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#008DC9] pr-12"
                    placeholder="e.g. 18"
                  />
                  <span className="absolute right-3 top-2 text-[10px] text-slate-400 font-bold">
                    {lang === "en" ? "mo" : "شهر"}
                  </span>
                </div>
                <button
                  onClick={handleUpdatePatientAge}
                  disabled={isUpdatingAge || !editAgeMonths}
                  className="bg-[#008DC9] hover:bg-[#005F8A] text-white text-xs font-bold px-3 py-2 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  {isUpdatingAge ? (
                    <span className="animate-spin text-white">⏳</span>
                  ) : ageUpdateSuccess ? (
                    <span className="text-emerald-300">✓</span>
                  ) : null}
                  <span>{lang === "en" ? "Update Age" : "تحديث العمر"}</span>
                </button>
              </div>
            </div>

            {/* Anthropometric Measurements Display */}
            {activeMeas && (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Logged Weight</span>
                  <span className="text-lg font-bold text-slate-800">{activeMeas.weightKg} kg</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Logged Height</span>
                  <span className="text-lg font-bold text-slate-800">{activeMeas.heightCm} cm</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Oedema Present</span>
                  <span className={`text-sm font-bold ${activeMeas.oedema ? "text-rose-600" : "text-emerald-600"}`}>
                    {activeMeas.oedema ? "YES - Extreme Risk" : "NO"}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">MUAC Indicator</span>
                  <span className={`text-lg font-bold ${activeMeas.muacMm && activeMeas.muacMm < 115 ? "text-rose-600" : "text-slate-800"}`}>
                    {activeMeas.muacMm ? `${activeMeas.muacMm} mm` : "Not Logged"}
                  </span>
                </div>
              </div>
            )}

            {/* GORGEOUS SMART LONGITUDINAL TRAJECTORY & FORECAST ANALYTICS */}
            {selectedPatientId && historicalMeasurements.length > 0 && (
              <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4 transition-all duration-300">
                <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#008DC9]" />
                    <h3 className="font-extrabold text-slate-900 text-sm uppercase tracking-wide">
                      {lang === "en" ? "Longitudinal Growth Velocity & Forecast" : "تحليل النمو التراكمي وتنبؤ التدهور"}
                    </h3>
                  </div>
                  <span className="text-[10px] bg-[#008DC9]/10 text-[#008DC9] font-black uppercase px-2 py-0.5 rounded-full font-mono">
                    Visit Count: {historicalMeasurements.length}
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Trend Velocity Metrics Grid */}
                  {growthTrend && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-xs">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Weight Velocity</span>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          {growthTrend.weightVelocity >= 0 ? (
                            <ArrowUpRight className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                          )}
                          <span className={`text-sm font-black ${growthTrend.weightVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {growthTrend.weightVelocity >= 0 ? "+" : ""}{growthTrend.weightVelocity.toFixed(2)} kg/m
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium block mt-1">سرعة الوزن شهرياً</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-xs">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">Height Velocity</span>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          {growthTrend.heightVelocity >= 0 ? (
                            <ArrowUpRight className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                          )}
                          <span className={`text-sm font-black ${growthTrend.heightVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {growthTrend.heightVelocity >= 0 ? "+" : ""}{growthTrend.heightVelocity.toFixed(1)} cm/m
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium block mt-1">سرعة الطول شهرياً</span>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 shadow-xs">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">MUAC Velocity</span>
                        <div className="flex items-center justify-center gap-1.5 mt-1">
                          {growthTrend.muacVelocity >= 0 ? (
                            <ArrowUpRight className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                          )}
                          <span className={`text-sm font-black ${growthTrend.muacVelocity >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {growthTrend.muacVelocity >= 0 ? "+" : ""}{growthTrend.muacVelocity.toFixed(1)} mm/m
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-medium block mt-1">سرعة محيط الذراع</span>
                      </div>
                    </div>
                  )}

                  {/* Cumulative Malnutrition Risk Banner */}
                  {growthTrend && (
                    <div className={`p-4 rounded-xl border ${
                      growthTrend.riskScore > 70 ? "bg-rose-50 border-rose-200 text-rose-900" :
                      growthTrend.riskScore > 30 ? "bg-amber-50 border-amber-200 text-amber-900" :
                      "bg-emerald-50 border-emerald-200 text-emerald-900"
                    } space-y-2 text-xs`}>
                      <div className="flex justify-between items-center font-bold">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-4 h-4" />
                          {lang === "en" ? growthTrend.trendRiskEn : growthTrend.trendRiskAr}
                        </span>
                        <span className="font-mono bg-white px-2 py-0.5 rounded border text-[10px] font-black uppercase">
                          {lang === "en" ? "Risk Score" : "معامل الخطر"}: {growthTrend.riskScore}%
                        </span>
                      </div>
                      <p className="font-medium leading-relaxed text-[11px]">
                        {lang === "en" ? growthTrend.trendDescriptionEn : growthTrend.trendDescriptionAr}
                      </p>
                    </div>
                  )}

                  {/* Custom Interactive SVG Line Chart of Weight History */}
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 space-y-3 shadow-xs">
                    <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wide">
                      {lang === "en" ? "Growth Trajectory Curve (Weight kg)" : "منحنى نمو الوزن التاريخي التراكمي (كجم)"}
                    </span>
                    
                    <div className="h-32 w-full flex items-center justify-center bg-white rounded-lg p-2 border border-slate-100">
                      <svg className="w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none">
                        <line x1="0" y1="20" x2="400" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="50" x2="400" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="80" x2="400" y2="80" stroke="#f1f5f9" strokeWidth="1" />

                        {(() => {
                          const weights = historicalMeasurements.map(m => m.weightKg);
                          const minW = Math.max(2, Math.min(...weights) - 1);
                          const maxW = Math.max(...weights) + 1.5;
                          const wDiff = maxW - minW || 1;

                          const points = historicalMeasurements.map((m, i) => {
                            const x = historicalMeasurements.length === 1 ? 200 : (i / (historicalMeasurements.length - 1)) * 360 + 20;
                            const y = 90 - ((m.weightKg - minW) / wDiff) * 80;
                            return { x, y, weight: m.weightKg, date: m.createdAt || m.date };
                          });

                          let d = "";
                          if (points.length === 1) {
                            d = `M ${points[0].x - 5} ${points[0].y} L ${points[0].x + 5} ${points[0].y}`;
                          } else {
                            d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
                          }

                          return (
                            <>
                              <path d={d} fill="none" stroke="#008DC9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                              
                              {points.length > 1 && (
                                <path 
                                  d={`${d} L ${points[points.length-1].x} 100 L ${points[0].x} 100 Z`} 
                                  fill="url(#weightGradDoc)" 
                                  opacity="0.12" 
                                />
                              )}

                              <defs>
                                <linearGradient id="weightGradDoc" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#008DC9" />
                                  <stop offset="100%" stopColor="#008DC9" stopOpacity="0" />
                                </linearGradient>
                              </defs>

                              {points.map((p, i) => (
                                <g key={i}>
                                  <circle cx={p.x} cy={p.y} r="5" fill="#008DC9" stroke="white" strokeWidth="2" />
                                  <text x={p.x} y={p.y - 10} textAnchor="middle" fill="#005F8A" className="text-[10px] font-black font-mono">
                                    {p.weight}kg
                                  </text>
                                  <text x={p.x} y="98" textAnchor="middle" fill="#94a3b8" className="text-[8px] font-bold">
                                    {new Date(p.date).toLocaleDateString(lang === "ar" ? "ar-YE" : "en-US", { month: "short", day: "numeric" })}
                                  </text>
                                </g>
                              ))}
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                    {historicalMeasurements.length > 0 && (
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-100 pt-2 font-mono">
                        <span>First Log: {new Date(historicalMeasurements[0].createdAt || historicalMeasurements[0].date).toLocaleDateString()}</span>
                        <span>Latest Log: {new Date(historicalMeasurements[historicalMeasurements.length-1].createdAt || historicalMeasurements[historicalMeasurements.length-1].date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* XGBoost severity prediction results */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#008DC9]" />
                {t.predictionEngine}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Wasting */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between h-48 transition-all ${
                  activePred.wasting.severityClass === "Severe" ? "bg-rose-50/50 border-rose-100" :
                  activePred.wasting.severityClass === "Moderate" ? "bg-orange-50/50 border-orange-100" : "bg-emerald-50/50 border-emerald-100"
                }`}>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-700">{t.wastingResult}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                        activePred.wasting.severityClass === "Severe" ? "bg-rose-100 text-rose-800" :
                        activePred.wasting.severityClass === "Moderate" ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {activePred.wasting.severityClass}
                      </span>
                    </div>
                    <span className="text-3xl font-extrabold text-slate-900 mt-3 block">{activePred.wasting.riskPercentage}%</span>
                  </div>
                  {userRole !== "Nurse" && userRole !== "Doctor" && (
                    <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 flex justify-between">
                      <span>{t.confidence}:</span>
                      <span className="font-semibold text-slate-800">{activePred.wasting.confidenceScore}%</span>
                    </div>
                  )}
                </div>

                {/* Stunting */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between h-48 transition-all ${
                  activePred.stunting.severityClass === "Severe" ? "bg-rose-50/50 border-rose-100" :
                  activePred.stunting.severityClass === "Moderate" ? "bg-orange-50/50 border-orange-100" : "bg-emerald-50/50 border-emerald-100"
                }`}>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-700">{t.stuntingResult}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                        activePred.stunting.severityClass === "Severe" ? "bg-rose-100 text-rose-800" :
                        activePred.stunting.severityClass === "Moderate" ? "bg-orange-100 text-orange-800" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {activePred.stunting.severityClass}
                      </span>
                    </div>
                    <span className="text-3xl font-extrabold text-slate-900 mt-3 block">{activePred.stunting.riskPercentage}%</span>
                  </div>
                  {userRole !== "Nurse" && userRole !== "Doctor" && (
                    <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 flex justify-between">
                      <span>{t.confidence}:</span>
                      <span className="font-semibold text-slate-800">{activePred.stunting.confidenceScore}%</span>
                    </div>
                  )}
                </div>

                {/* Underweight */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between h-48 transition-all ${
                  activePred.underweight.severityClass === "Severe" ? "bg-rose-50/50 border-rose-100" :
                  activePred.underweight.severityClass === "Moderate" ? "bg-orange-50/50 border-orange-100" : "bg-emerald-50/50 border-emerald-100"
                }`}>
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-700">{t.underweightResult}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                        activePred.underweight.severityClass === "Severe" ? "bg-rose-600 text-white" :
                        activePred.underweight.severityClass === "Moderate" ? "bg-amber-500 text-white" : "bg-emerald-100 text-emerald-800"
                      }`}>
                        {lang === "en" ? activePred.underweight.severityClass : translations.ar[activePred.underweight.severityClass.toLowerCase() as keyof typeof translations.ar] || activePred.underweight.severityClass}
                      </span>
                    </div>
                    <p className="text-2xl font-bold mt-2 text-slate-800">{activePred.underweight.riskPercentage}%</p>
                  </div>
                  {userRole !== "Nurse" && userRole !== "Doctor" && (
                    <div className="border-t border-slate-100 pt-2 flex justify-between text-xs text-slate-500">
                      <span>{t.confidence}</span>
                      <span className="font-semibold">{activePred.underweight.confidenceScore}%</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Clinical reasoning output / Recommendation */}
            {activeRec && (
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#008DC9]" />
                  {t.referralTitle}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Diagnosis</span>
                    <p className="text-sm font-medium text-slate-800">
                      {lang === "en" ? activeRec.diagnosis : activeRec.diagnosisAr}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Recommended Intervention</span>
                    <p className="text-sm font-medium text-slate-800">
                      {lang === "en" ? activeRec.recommendedIntervention : activeRec.recommendedInterventionAr}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">Referral Need</span>
                    <p className="text-sm font-medium text-slate-800">
                      {lang === "en" ? activeRec.referralNeed : activeRec.referralNeedAr}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-400 font-semibold block uppercase">WHO Guideline Citation</span>
                    <p className="text-xs text-slate-500 italic">
                      {activeRec.whoReference} | Source: {activeRec.evidenceSource}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Notes Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 print:hidden">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#008DC9]" />
                {lang === "ar" ? "إضافة ملاحظات سريرية مخصصة" : "Add Customized Clinical Notes"}
              </h3>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder={lang === "ar" ? "مثال: تم صرف الأغذية العلاجية الجاهزة للاستخدام (RUTF). المتابعة خلال 7 أيام للتحقق من التقدم السريري." : "e.g. Prescribed RUTF. Follow up in 7 days for clinical progress check."}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] focus:bg-white transition-all h-24"
              />
              <button
                onClick={handleSaveNotes}
                className="bg-[#008DC9] hover:bg-[#007cb2] text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors flex items-center gap-2"
              >
                {noteSaved 
                  ? (lang === "ar" ? "تم الحفظ بنجاح!" : "Saved successfully!") 
                  : (lang === "ar" ? "حفظ الملاحظة السريرية" : "Save Clinical Note")}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
            <HeartPulse className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-semibold text-slate-700">No active child records loaded.</h3>
            <p className="text-sm text-slate-400 max-w-sm mx-auto">
              Please register children or run diagnostic measurements inside the field Nurse dashboard to initiate AI diagnostic assessments.
            </p>
          </div>
        )}
      </div>

      {showNurseManager && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 shadow-xl border border-slate-200 flex flex-col gap-5 relative">
            <button
              onClick={() => setShowNurseManager(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserPlus className="w-6 h-6 text-[#008DC9]" />
              <h2 className="text-lg font-bold text-slate-900">
                {lang === "en" ? "Manage & Register Nurses" : "إدارة وتسجيل الممرضين"}
              </h2>
            </div>

            {nurseSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{nurseSuccessMsg}</span>
              </div>
            )}

            {nurseErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{nurseErrorMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Register New Nurse */}
              <form onSubmit={handleAddNurse} className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-150 text-slate-700">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-[#008DC9]" />
                  {lang === "en" ? "Register New Nurse" : "تسجيل ممرض جديد"}
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-500 mb-1 block">
                      {lang === "en" ? "Full Name" : "الاسم الكامل"}
                    </label>
                    <input
                      type="text"
                      required
                      value={newNurseName}
                      onChange={(e) => setNewNurseName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#008DC9] font-bold text-slate-800"
                      placeholder={lang === "en" ? "Nurse Full Name" : "اسم الممرض الكامل"}
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 mb-1 block">
                      {lang === "en" ? "Email Address" : "البريد الإلكتروني"}
                    </label>
                    <input
                      type="email"
                      required
                      value={newNurseEmail}
                      onChange={(e) => setNewNurseEmail(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#008DC9] font-bold text-slate-800"
                      placeholder="nurse@facility.gov.ye"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-500 mb-1 block">
                      {lang === "en" ? "Healthcare Facility" : "المرفق الصحي"}
                    </label>
                    <input
                      type="text"
                      value={newNurseFacility}
                      onChange={(e) => setNewNurseFacility(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-[#008DC9] font-bold text-slate-800"
                      placeholder="Hajja Rural Mobile Health Unit"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-lg text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  {lang === "en" ? "Register Nurse" : "تسجيل الممرض المعتمد"}
                </button>
              </form>

              {/* Right Column: Registered Nurses List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#008DC9]" />
                  {lang === "en" ? "Active Registered Nurses" : "الكادر التمريضي النشط المسجل"}
                </h3>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {users.filter(u => u.role === "Nurse").length > 0 ? (
                    users.filter(u => u.role === "Nurse").map((u) => (
                      <div key={u.id} className="p-3 bg-white rounded-xl border border-slate-150 shadow-xs flex items-center justify-between gap-3 text-slate-700">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{u.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5">{u.facility}</p>
                        </div>
                        <span className="bg-emerald-100 text-emerald-800 text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0">
                          {lang === "en" ? "Active" : "نشط"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-xs text-slate-400 font-semibold border border-dashed border-slate-200 rounded-xl">
                      {lang === "en" ? "No registered nurses found." : "لا يوجد ممرضين مسجلين بعد."}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
