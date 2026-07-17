import React, { useState, useEffect } from "react";
import { translations, Language } from "./utils/translation";
import { NurseDashboard } from "./components/NurseDashboard";
import { DoctorDashboard } from "./components/DoctorDashboard";
import { AdminDashboard } from "./components/AdminDashboard";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { AIMonitoringDashboard } from "./components/AIMonitoringDashboard";
import { KnowledgeBaseDashboard } from "./components/KnowledgeBaseDashboard";
import { SyncDashboard } from "./components/SyncDashboard";
import { RecordsSyncDashboard } from "./components/RecordsSyncDashboard";
import { syncManager } from "./utils/syncManager";
import { signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, googleProvider, db as firestoreDb } from "./utils/firebase";
import { doc, setDoc } from "firebase/firestore";
import { 
  Heart, 
  Activity, 
  ShieldAlert, 
  Database, 
  BarChart3, 
  Server, 
  Settings, 
  User, 
  Globe, 
  Wifi, 
  WifiOff, 
  LogOut, 
  ChevronRight, 
  Clock,
  Sparkles,
  RefreshCw,
  Files,
  Search,
  X,
  BookOpen,
  Award,
  AlertCircle,
  Menu
} from "lucide-react";

export default function App() {
  const [lang, setLang] = useState<Language>("en");
  const [online, setOnline] = useState<boolean>(true);
  const [syncState, setSyncState] = useState<any>({
    online: true,
    pendingRecordsCount: 0,
    lastSyncTime: null,
    syncInProgress: false,
    deviceName: "Yemen-Mobile-Unit-8192",
    deviceId: "DEV-F81A"
  });
  const [toast, setToast] = useState<{ type: "success" | "error" | "info" | "warning"; text: string } | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("nurse");
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchResult, setGlobalSearchResult] = useState<any | null>(null);
  const [globalSearchStatus, setGlobalSearchStatus] = useState<string>("");
  const [globalSearchStepsCompleted, setGlobalSearchStepsCompleted] = useState<string[]>([]);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginError, setLoginError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const t = translations[lang];

  // System status clock
  const [timeStr, setTimeStr] = useState("");

  // Subscribe to SyncManager updates and listen for network/sync Toast events
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((state) => {
      setSyncState(state);
      setOnline(state.online);
    });

    const handleNetworkEvent = (e: Event) => {
      const isOnline = (e as CustomEvent).detail.online;
      if (isOnline) {
        setToast({
          type: "success",
          text: lang === "en" ? "Internet Connection Restored. Realtime sync mode activated." : "تم استعادة الاتصال بالإنترنت. تم تفعيل المزامنة الفورية."
        });
      } else {
        setToast({
          type: "warning",
          text: lang === "en" ? "Offline Mode Activated. All measurements will be stored securely in local IndexedDB." : "تم تفعيل الوضع غير المتصل بالإنترنت. سيتم حفظ القياسات الطبية بأمان في قاعدة البيانات المحلية (IndexedDB)."
        });
      }
      setTimeout(() => setToast(null), 6000);
    };

    const handleSyncEvent = (e: Event) => {
      const count = (e as CustomEvent).detail.recordsCount;
      setToast({
        type: "success",
        text: lang === "en" 
          ? `Synchronization Completed Successfully! Synced ${count} medical record(s) to cloud database.` 
          : `تمت مزامنة البيانات الطبية بنجاح! تم رفع عدد ${count} من السجلات إلى قاعدة البيانات الرئيسية.`
      });
      setTimeout(() => setToast(null), 6000);
    };

    window.addEventListener("network-status-changed", handleNetworkEvent);
    window.addEventListener("synchronization-completed", handleSyncEvent);

    return () => {
      unsubscribe();
      window.removeEventListener("network-status-changed", handleNetworkEvent);
      window.removeEventListener("synchronization-completed", handleSyncEvent);
    };
  }, [lang]);
  const [demoUsers, setDemoUsers] = useState<any[]>([]);

  const fetchDemoUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      setDemoUsers(data);
      localStorage.setItem("offline_users", JSON.stringify(data));
    } catch (e) {
      const cached = localStorage.getItem("offline_users");
      if (cached) {
        setDemoUsers(JSON.parse(cached));
      } else {
        const defaults = [
          { id: "USR-001", name: "Dr. Samer Al-Sanaani", email: "dr.samer@gmail.com", role: "Doctor", facility: "Sana'a Pediatric Clinic", active: true },
          { id: "USR-002", name: "Tasnim Al-Ohami", email: "tasneem1992.7@gmail.com", role: "Administrator", facility: "National Health Ministry Coordination Center", active: true },
          { id: "USR-003", name: "Nurse Reem Al-Asiri", email: "nurse.reem@gmail.com", role: "Nurse", facility: "Hajja Rural Mobile Health Unit", active: true }
        ];
        setDemoUsers(defaults);
        localStorage.setItem("offline_users", JSON.stringify(defaults));
      }
    }
  };

  useEffect(() => {
    fetchDemoUsers();
  }, [isAuthenticated]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const cached = localStorage.getItem("offline_users");
        const usersList = cached ? JSON.parse(cached) : demoUsers;
        let matched = usersList.find((u: any) => u.email === user.email);
        if (!matched) {
          matched = {
            id: `USR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
            name: user.displayName || "Google User",
            email: user.email,
            role: "Doctor",
            facility: "Google Authenticated Clinic Unit",
            active: true
          };
        }
        setCurrentUser(matched);
        setIsAuthenticated(true);
      }
    });
    return () => unsubscribe();
  }, [demoUsers]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toUTCString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleGlobalSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearchQuery.trim()) return;

    setGlobalSearchLoading(true);
    setGlobalSearchResult(null);
    setGlobalSearchStepsCompleted([]);

    const steps = online 
      ? [
          "Searching trusted scientific sources...",
          "Analyzing references...",
          "Updating knowledge base...",
          "Generating answer...",
          "Complete."
        ]
      : [
          "Searching local knowledge...",
          "Generating answer...",
          "Complete."
        ];

    let currentStepIdx = 0;
    setGlobalSearchStatus(steps[0]);

    const statusInterval = setInterval(() => {
      if (currentStepIdx < steps.length - 2) {
        currentStepIdx++;
        setGlobalSearchStatus(steps[currentStepIdx]);
        setGlobalSearchStepsCompleted((prev) => [...prev, steps[currentStepIdx - 1]]);
      }
    }, 1200);

    try {
      const res = await fetch("/api/ai/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: globalSearchQuery, isOnline: online })
      });
      const data = await res.json();

      clearInterval(statusInterval);
      setGlobalSearchStatus("Complete.");
      setGlobalSearchStepsCompleted(steps.slice(0, -1));
      setGlobalSearchResult(data);
    } catch (err) {
      clearInterval(statusInterval);
      setGlobalSearchStatus("Error.");
      setGlobalSearchResult({
        answer: lang === "en" 
          ? "Failed to perform intelligent search. Please check your connectivity or API key configurations."
          : "فشل في إجراء البحث الذكي بالذكاء الاصطناعي. يرجى التحقق من الاتصال بالإنترنت ومفاتيح الترخيص.",
        citations: [],
        mode: online ? "online" : "offline"
      });
    } finally {
      setGlobalSearchLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail })
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        // Default views depending on role-based access control (RBAC)
        if (data.user.role === "Nurse") {
          setActiveTab("nurse");
        } else if (data.user.role === "Doctor") {
          setActiveTab("doctor");
        } else {
          setActiveTab("admin");
        }
      } else {
        setLoginError(data.message || "Authorized clinic credentials not matching.");
      }
    } catch (err) {
      // Offline authentication fallback with registered users
      const match = demoUsers.find((u) => u.email === loginEmail);
      if (match) {
        setCurrentUser(match);
        setIsAuthenticated(true);
        if (match.role === "Nurse") setActiveTab("nurse");
        else if (match.role === "Doctor") setActiveTab("doctor");
        else setActiveTab("admin");
      } else {
        setLoginError("Offline Authentication: Credentials not recognized in local cache memory.");
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setLoginError("");
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const googleUser = result.user;
      
      const cached = localStorage.getItem("offline_users");
      const usersList = cached ? JSON.parse(cached) : demoUsers;
      let matched = usersList.find((u: any) => u.email === googleUser.email);
      
      if (!matched) {
        matched = {
          id: `USR-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          name: googleUser.displayName || "Google User",
          email: googleUser.email,
          role: "Doctor",
          facility: "Google Authenticated Clinic Unit",
          active: true
        };
        
        if (online) {
          try {
            await setDoc(doc(firestoreDb, "users", matched.id), matched);
            await fetch(`/api/users/register`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(matched)
            });
          } catch (e) {
            console.error("Failed to persist Google user to Firestore:", e);
          }
        }
      }
      
      setCurrentUser(matched);
      setIsAuthenticated(true);
      
      if (matched.role === "Nurse") {
        setActiveTab("nurse");
      } else if (matched.role === "Doctor") {
        setActiveTab("doctor");
      } else {
        setActiveTab("admin");
      }
      
      handleLogAuditOnServer("Google Authentication", `User authenticated via Google Sign-In: ${googleUser.email}.`);
      
      setToast({
        type: "success",
        text: lang === "en" ? `Signed in successfully as ${matched.name}` : `تم تسجيل الدخول بنجاح باسم ${matched.name}`
      });
      setTimeout(() => setToast(null), 4000);
    } catch (err: any) {
      console.error("Google Sign-In Error:", err);
      setLoginError(lang === "en" ? `Google Sign-In failed: ${err.message}` : `فشل تسجيل الدخول عبر جوجل: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error signing out from Firebase:", err);
    }
    setIsAuthenticated(false);
    setCurrentUser(null);
    setLoginEmail("");
  };

  const handleLogAuditOnServer = async (action: string, details: string) => {
    if (!currentUser) return;
    try {
      await fetch("/api/logs/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          userEmail: currentUser.email,
          role: currentUser.role,
          action,
          details,
          timestamp: new Date().toISOString()
        })
      });
    } catch (e) {
      // Offline cache logging
      const offlineLogs = JSON.parse(localStorage.getItem("offline_audit_logs") || "[]");
      offlineLogs.unshift({
        id: `AUD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        userId: currentUser.id,
        userEmail: currentUser.email,
        role: currentUser.role,
        action: `${action} (Offline Cached)`,
        timestamp: new Date().toISOString(),
        details
      });
      localStorage.setItem("offline_audit_logs", JSON.stringify(offlineLogs));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F1F5F9] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 text-slate-800 transition-colors" dir={lang === "ar" ? "rtl" : "ltr"}>
        {/* Upper Lang / Connectivity Toggle */}
        <div className="flex justify-between items-center max-w-md mx-auto w-full mb-4">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            {lang === "en" ? "العربية" : "English"}
          </button>

          <button
            onClick={() => syncManager.toggleOnlineSimulator(!online)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
              online ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-rose-100 text-rose-800 hover:bg-rose-200"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            {online ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-rose-600" />}
            {online ? "Online" : "Offline Simulator"}
          </button>
        </div>

        {/* Login Box */}
        <div className="max-w-md w-full mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-md space-y-6">
          <div className="text-center space-y-1.5">
            <Heart className="w-12 h-12 text-rose-600 mx-auto animate-pulse" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {lang === "en" ? "AI model for child Malnutrition prediction" : "نموذج الذكاء الاصطناعي للتنبؤ بسوء التغذية لدى الأطفال"}
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                {lang === "en" ? "Clinician Authorized Email Address" : "البريد الإلكتروني المعتمد للمرفق الصحي"}
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="e.g. tasneem1992.7@gmail.com"
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-4 py-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#008DC9] transition-all"
              />
            </div>

            {loginError && (
              <span className="text-xs font-semibold text-rose-600 block bg-rose-50 border border-rose-100 p-2.5 rounded-lg">
                {loginError}
              </span>
            )}

            <button
              type="submit"
              className="w-full bg-[#008DC9] hover:bg-[#007cb2] text-white font-semibold py-3 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <User className="w-4 h-4" />
              {lang === "en" ? "Authenticate Credentials" : "التحقق من الهوية الطبية"}
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative bg-white px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {lang === "en" ? "or securely sign in with" : "أو سجل دخولك بأمان بواسطة"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full bg-white hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 border border-slate-200 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {lang === "en" ? "Sign in with Google" : "تسجيل الدخول باستخدام Google"}
            </button>
          </form>

          {/* Quick Seeding Demo Accounts */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-center">
              {lang === "en" ? "Demonstration RBAC Accounts Quick-Fill" : "الحسابات التجريبية للمحاكاة والتحقق (الدخول السريع)"}
            </span>
            <div className="grid grid-cols-1 gap-2 text-xs">
              {(demoUsers.length > 0 ? demoUsers : [
                { id: "USR-001", name: "Dr. Samer Al-Sanaani", email: "dr.samer@gmail.com", role: "Doctor", active: true },
                { id: "USR-002", name: "Tasnim Al-Ohami", email: "tasneem1992.7@gmail.com", role: "Administrator", active: true },
                { id: "USR-003", name: "Nurse Reem Al-Asiri", email: "nurse.reem@gmail.com", role: "Nurse", active: true }
              ]).map((user) => {
                let avatarStyle = "";
                let avatarLetters = "";
                let roleLabel = "";
                
                if (user.role === "Doctor") {
                  avatarStyle = "from-[#008DC9] to-blue-500";
                  avatarLetters = "DR";
                  roleLabel = lang === "en" ? "Doctor" : "طبيب";
                } else if (user.role === "Nurse") {
                  avatarStyle = "from-emerald-400 to-teal-500";
                  avatarLetters = "NR";
                  roleLabel = lang === "en" ? "Nurse" : "ممرض";
                } else {
                  avatarStyle = "from-purple-500 to-indigo-600";
                  avatarLetters = "AD";
                  roleLabel = lang === "en" ? "Admin" : "مسؤول";
                }

                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setLoginEmail(user.email)}
                    className="text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-3 w-full group relative overflow-hidden"
                    dir={lang === "ar" ? "rtl" : "ltr"}
                  >
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarStyle} flex items-center justify-center text-white text-[10px] font-black shrink-0 shadow-sm border border-white/20 group-hover:scale-105 transition-transform`}>
                      {avatarLetters}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <span className="font-bold text-slate-800 block text-xs truncate group-hover:text-[#008DC9] transition-colors">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono block truncate">{user.email}</span>
                    </div>
                    <span className="text-[9px] font-extrabold bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                      {roleLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info block */}
        <div className="text-center text-[10px] text-slate-400 font-bold max-w-sm mx-auto space-y-1">
          <p>YEMEN CHILD MALNUTRITION PREDICTION PLATFORM</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col font-sans text-slate-800" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* Top Header Rail */}
      <header className="bg-[#008DC9] text-white sticky top-0 z-40 print:hidden shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-md flex items-center justify-center shadow-sm">
              <Heart className="w-6 h-6 text-[#008DC9] animate-pulse" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold leading-none tracking-tight">
                YEMEN CLINICAL SUPPORT
              </h1>
              <span className="hidden sm:block text-[10px] text-blue-100 opacity-90 font-medium uppercase tracking-widest mt-1">
                AI model for child Malnutrition prediction | MICS6 Engine
              </span>
            </div>
          </div>

          {/* Quick Header System Status Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Clock */}
            <span className="hidden lg:flex text-[11px] font-semibold text-white/95 tracking-wider bg-white/10 border border-white/20 px-2.5 py-1.5 rounded-lg items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {timeStr}
            </span>

            {/* Language Selection */}
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="text-xs font-semibold text-white hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 px-2 py-1.5 sm:px-3 sm:py-1.5 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === "en" ? "العربية" : "English"}</span>
            </button>

            {/* Connection Toggle */}
            <button
              onClick={() => syncManager.toggleOnlineSimulator(!online)}
              title={lang === "en" ? "Toggle connection mode simulation" : "تبديل محاكاة حالة الاتصال بالشبكة"}
              className={`text-xs font-bold px-2 py-1 sm:px-3 sm:py-1 rounded-lg flex flex-col items-center gap-0.5 transition-all border cursor-pointer ${
                online 
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25" 
                  : "bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/25"
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-rose-500"}`} />
                {online ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
                <span className="hidden sm:inline">{online ? "ONLINE" : "OFFLINE"}</span>
              </div>
              <span className="hidden sm:block text-[8px] opacity-80 font-mono tracking-tight font-medium">
                Sync: {syncState.lastSyncTime ? new Date(syncState.lastSyncTime).toLocaleTimeString(lang === "en" ? "en-US" : "ar-YE") : (lang === "en" ? "Never" : "لا يوجد")}
              </span>
            </button>

            {/* User Session */}
            <div className="hidden md:block h-8 w-[1px] bg-white/20" />
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs font-bold block leading-none">{currentUser.name}</span>
                <span className="text-[9px] bg-white/20 text-white border border-white/20 px-2 py-0.5 rounded-full font-bold uppercase block mt-1 w-max ml-auto">
                  {currentUser.role}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                title="Logout Account"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>

            {/* Hamburger Menu Toggle Button for Mobile/Tablet */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
              aria-label="Toggle Clinical Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Dropdown Panel */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 shadow-xl transition-all z-30 relative py-4 px-4 space-y-4 print:hidden">
          {/* User Session Profile Header */}
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">
                {lang === "en" ? "Active User" : "المستخدم الحالي"}
              </span>
              <span className="text-sm font-extrabold text-slate-800 block mt-0.5">{currentUser?.name}</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold uppercase inline-block mt-1">
                {currentUser?.role}
              </span>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "Logout" : "تسجيل الخروج"}</span>
            </button>
          </div>

          {/* Navigation Links (Clinical Menu) */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
              {lang === "en" ? "Clinical Menu" : "القائمة الطبية"}
            </p>

            <button
              onClick={() => {
                setActiveTab("nurse");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2.5 ${
                activeTab === "nurse"
                  ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Activity className="w-4 h-4 text-[#008DC9]" />
              {t.measurementsEntry}
            </button>

            <button
              onClick={() => {
                setActiveTab("doctor");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2.5 ${
                activeTab === "doctor"
                  ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-[#008DC9]" />
              {t.recommendations}
            </button>

            <button
              onClick={() => {
                setActiveTab("sync_dashboard");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2.5 ${
                activeTab === "sync_dashboard"
                  ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <RefreshCw className={`w-4 h-4 text-[#008DC9] ${syncState.syncInProgress ? 'animate-spin' : ''}`} />
              {lang === "en" ? "Offline Sync Hub" : "مركز المزامنة دون اتصال"}
              {syncState.pendingRecordsCount > 0 && (
                <span className="ml-auto text-[10px] bg-orange-100 text-orange-800 font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                  {syncState.pendingRecordsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("records_sync");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2.5 ${
                activeTab === "records_sync"
                  ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Files className="w-4 h-4 text-[#008DC9]" />
              {lang === "en" ? "Records & Sync" : "السجلات والمزامنة"}
              {syncState.pendingRecordsCount > 0 ? (
                <span className="ml-auto text-[10px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                  {syncState.pendingRecordsCount}
                </span>
              ) : (
                <span className="ml-auto text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full">
                  ✓
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("kb");
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2.5 ${
                activeTab === "kb"
                  ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Database className="w-4 h-4 text-[#008DC9]" />
              {lang === "en" ? "Guidelines Library" : "المكتبة الإرشادية الطبية"}
            </button>

            {currentUser?.role !== "Nurse" && (
              <>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mt-4 mb-2">Analytics & Models</p>

                <button
                  onClick={() => {
                    setActiveTab("analytics");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2.5 ${
                    activeTab === "analytics"
                      ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-[#008DC9]" />
                  {lang === "en" ? "Malnutrition Analytics" : "إحصائيات سوء التغذية"}
                </button>

                {currentUser?.role !== "Doctor" && (
                  <button
                    onClick={() => {
                      setActiveTab("ai_monitoring");
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2.5 ${
                      activeTab === "ai_monitoring"
                        ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <Server className="w-4 h-4 text-[#008DC9]" />
                    {lang === "en" ? "AI & NER Engine Sandbox" : "بيئة تجربة محرك الذكاء الاصطناعي"}
                  </button>
                )}
              </>
            )}

            {currentUser?.role === "Administrator" && (
              <>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mt-4 mb-2">Administrative Portals</p>
                <button
                  onClick={() => {
                    setActiveTab("admin");
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2.5 ${
                    activeTab === "admin"
                      ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Settings className="w-4 h-4 text-[#008DC9]" />
                  {t.userManagement}
                </button>
              </>
            )}

            {currentUser?.role !== "Doctor" && currentUser?.role !== "Nurse" && (
              <div className="pt-4 border-t border-slate-100">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                  <p className="text-[10px] font-bold text-[#008DC9] uppercase mb-1">Edge AI Model</p>
                  <p className="text-xs text-blue-900 font-semibold">v2.4.0 ONNX Loaded</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-medium">Quantization INT8: OK</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global AI Search Panel */}
      <div className="bg-slate-100 border-b border-slate-200 py-6 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 w-full max-w-3xl relative">
              <form onSubmit={handleGlobalSearch} className="relative flex items-center">
                <input
                  type="text"
                  value={globalSearchQuery}
                  onChange={(e) => setGlobalSearchQuery(e.target.value)}
                  placeholder={
                    lang === "en"
                      ? "Search scientific journals & clinical guidelines... (e.g. F-75 dosage, SAM, stunting)"
                      : "ابحث في المجلات العلمية والبروتوكولات الطبية... (مثل جرعة F-75، التقزم، SAM)"
                  }
                  className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-[#008DC9] focus:ring-2 focus:ring-[#008DC9]/20 rounded-2xl pl-12 pr-16 lg:pr-32 py-4 text-sm font-medium transition-all shadow-sm focus:outline-none text-slate-900 placeholder-slate-400"
                />
                <Search className="absolute left-4 w-5 h-5 text-slate-400" />
                <button
                  type="submit"
                  disabled={globalSearchLoading}
                  className="absolute right-2 bg-gradient-to-r from-[#008DC9] to-[#00A1E4] hover:from-[#007cb2] hover:to-[#008DC9] disabled:from-slate-300 disabled:to-slate-400 text-white font-bold py-2.5 px-3 lg:px-6 rounded-xl text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                  title={lang === "en" ? "Ask Support" : "اسأل الدعم"}
                >
                  {globalSearchLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden lg:inline">{lang === "en" ? "Ask Support" : "اسأل الدعم"}</span>
                </button>
              </form>
            </div>

            <div className="flex gap-2.5 items-center bg-white p-2.5 lg:px-4 lg:py-2.5 rounded-xl border border-slate-200 shadow-sm shrink-0" title={online ? (lang === "en" ? "Smart Web Grounding: ACTIVE" : "البحث المتصل بالشبكة: نشط") : (lang === "en" ? "Offline Mode" : "الوضع دون اتصال")}>
              <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
              <span className="text-xs font-bold text-slate-600 hidden lg:inline">
                {online 
                  ? (lang === "en" ? "Smart Web Grounding: ACTIVE" : "البحث المتصل بالشبكة: نشط") 
                  : (lang === "en" ? "Offline Mode: Local Guideline Index" : "الوضع دون اتصال: المكتبة المحلية فقط")
                }
              </span>
            </div>
          </div>

          {/* Search Loading & Milestones */}
          {globalSearchLoading && (
            <div className="mt-4 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100 shrink-0">
                  <RefreshCw className="w-4 h-4 text-[#008DC9] animate-spin" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    {lang === "en" ? "AI Search Engine Processing" : "محرك البحث الذكي قيد التشغيل"}
                  </h4>
                  <p className="text-[10px] font-bold text-[#008DC9] mt-0.5 animate-pulse">
                    {globalSearchStatus}
                  </p>
                </div>
              </div>

              {/* Steps Completed Breadcrumbs */}
              <div className="flex flex-wrap gap-2 items-center">
                {globalSearchStepsCompleted.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-[9px] font-bold text-slate-500 animate-fade-in">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search Results Display Area */}
          {globalSearchResult && (
            <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-6 shadow-md relative overflow-hidden">
              <button 
                onClick={() => setGlobalSearchResult(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                <Sparkles className="w-5 h-5 text-[#008DC9]" />
                <h3 className="text-sm font-bold text-slate-900">
                  {lang === "en" ? "AI Assistant Decision Support Answer" : "إجابة الدعم الطبي الذكي"}
                </h3>
                <span className={`ml-auto text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                  globalSearchResult.mode === "online" 
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200" 
                    : "bg-amber-100 text-amber-800 border border-amber-200"
                }`}>
                  {globalSearchResult.mode === "online" 
                    ? (lang === "en" ? "Grounded Web Search" : "مستند للويب")
                    : (lang === "en" ? "Local Guidelines RAG" : "مستند للمكتبة المحلية")
                  }
                </span>
                {globalSearchResult.newDocumentIndexed && (
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 font-extrabold px-2.5 py-0.5 rounded-full animate-pulse ml-2">
                    {lang === "en" ? "Auto-Indexed into KB" : "تمت الفهرسة آلياً للمكتبة"}
                  </span>
                )}
              </div>

              {/* The generated response markdown structure */}
              <div className="prose prose-sm max-w-none text-slate-800 text-sm leading-relaxed whitespace-pre-line mb-6">
                {globalSearchResult.answer}
              </div>

              {/* Citations Panel */}
              {globalSearchResult.citations && globalSearchResult.citations.length > 0 && (
                <div className="border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-1.5 mb-3">
                    <BookOpen className="w-4 h-4 text-slate-500" />
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {lang === "en" ? "Source Citations & Academic References" : "المراجع والاقتباسات الأكاديمية"}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {globalSearchResult.citations.map((citation: any, idx: number) => {
                      const isLocal = !!citation.documentId;
                      return (
                        <div 
                          key={idx} 
                          className="bg-slate-50 border border-slate-200 p-3 rounded-xl hover:border-slate-300 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                              {isLocal ? (
                                <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                  {lang === "en" ? "Local Doc" : "مستند محلي"}
                                </span>
                              ) : (
                                <span className="bg-emerald-100 text-emerald-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded">
                                  {lang === "en" ? "Web Source" : "مصدر ويب"}
                                </span>
                              )}
                              
                              {/* Confidence score for local citations */}
                              {citation.confidenceScore !== undefined && (
                                <span className="ml-auto bg-slate-200 text-slate-700 text-[8px] font-bold px-1 py-0.5 rounded">
                                  {lang === "en" ? "Similarity:" : "التطابق:"} {(citation.confidenceScore * 100).toFixed(0)}%
                                </span>
                              )}
                            </div>

                            <p className="text-xs font-bold text-slate-800 line-clamp-2 mb-1">
                              {citation.title}
                            </p>
                            <p className="text-[10px] text-slate-500 font-semibold mb-2">
                              {citation.website} • {citation.publishDate}
                            </p>
                          </div>

                          {isLocal ? (
                            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-100 pt-1.5 mt-1">
                              <span>ID: {citation.documentId}</span>
                              <Award className="w-3.5 h-3.5 text-amber-500" />
                            </div>
                          ) : (
                            <a 
                              href={citation.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[10px] text-[#008DC9] font-bold hover:underline inline-flex items-center gap-1 border-t border-slate-100 pt-1.5 mt-1 w-full"
                            >
                              <span>{lang === "en" ? "View Publication" : "عرض المنشور"}</span>
                              <ChevronRight className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Container Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-1 sm:px-6 lg:px-8 py-3 sm:py-6 flex flex-row gap-1.5 sm:gap-6 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="flex w-12 sm:w-16 md:w-64 bg-white border border-slate-200 rounded-2xl p-1 sm:p-2 md:p-4 flex-col gap-1.5 shrink-0 shadow-sm print:hidden transition-all duration-300" id="nav-sidebar">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2 hidden md:block">Clinical Menu</p>
          
          <button
            onClick={() => setActiveTab("nurse")}
            className={`w-full text-left px-1 sm:px-2 md:px-3 py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center md:justify-start gap-1.5 sm:gap-2.5 ${
              activeTab === "nurse" 
                ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm" 
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Activity className="w-4 h-4 text-[#008DC9] shrink-0" />
            <span className="hidden md:block">{t.measurementsEntry}</span>
          </button>

          <button
            onClick={() => setActiveTab("doctor")}
            className={`w-full text-left px-1 sm:px-2 md:px-3 py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center md:justify-start gap-1.5 sm:gap-2.5 ${
              activeTab === "doctor" 
                ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm" 
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-[#008DC9] shrink-0" />
            <span className="hidden md:block">{t.recommendations}</span>
          </button>

          <button
            onClick={() => setActiveTab("sync_dashboard")}
            className={`w-full text-left px-1 sm:px-2 md:px-3 py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center md:justify-start gap-1.5 sm:gap-2.5 ${
              activeTab === "sync_dashboard" 
                ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm" 
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <div className="relative">
              <RefreshCw className={`w-4 h-4 text-[#008DC9] shrink-0 ${syncState.syncInProgress ? 'animate-spin' : ''}`} />
              {syncState.pendingRecordsCount > 0 && (
                <span className="md:hidden absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className="hidden md:block">{lang === "en" ? "Offline Sync Hub" : "مركز المزامنة دون اتصال"}</span>
            {syncState.pendingRecordsCount > 0 && (
              <span className="hidden md:inline-block ml-auto text-[10px] bg-orange-100 text-orange-800 font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                {syncState.pendingRecordsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("records_sync")}
            className={`w-full text-left px-1 sm:px-2 md:px-3 py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center md:justify-start gap-1.5 sm:gap-2.5 ${
              activeTab === "records_sync" 
                ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm" 
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <div className="relative">
              <Files className="w-4 h-4 text-[#008DC9] shrink-0" />
              {syncState.pendingRecordsCount > 0 && (
                <span className="md:hidden absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className="hidden md:block">{lang === "en" ? "Records & Sync" : "السجلات والمزامنة"}</span>
            {syncState.pendingRecordsCount > 0 ? (
              <span className="hidden md:inline-block ml-auto text-[10px] bg-rose-100 text-rose-800 font-extrabold px-1.5 py-0.5 rounded-full animate-pulse">
                {syncState.pendingRecordsCount}
              </span>
            ) : (
              <span className="hidden md:inline-block ml-auto text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full">
                ✓
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("kb")}
            className={`w-full text-left px-1 sm:px-2 md:px-3 py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center md:justify-start gap-1.5 sm:gap-2.5 ${
              activeTab === "kb" 
                ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm" 
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Database className="w-4 h-4 text-[#008DC9] shrink-0" />
            <span className="hidden md:block">{lang === "en" ? "Guidelines Library" : "المكتبة الإرشادية الطبية"}</span>
          </button>

          {currentUser?.role !== "Nurse" && (
            <>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mt-4 mb-2 hidden md:block">Analytics & Models</p>

              <button
                onClick={() => setActiveTab("analytics")}
                className={`w-full text-left px-1 sm:px-2 md:px-3 py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center md:justify-start gap-1.5 sm:gap-2.5 ${
                  activeTab === "analytics" 
                    ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <BarChart3 className="w-4 h-4 text-[#008DC9] shrink-0" />
                <span className="hidden md:block">{lang === "en" ? "Malnutrition Analytics" : "إحصائيات سوء التغذية"}</span>
              </button>

              {currentUser?.role !== "Doctor" && (
                <button
                  onClick={() => setActiveTab("ai_monitoring")}
                  className={`w-full text-left px-1 sm:px-2 md:px-3 py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center md:justify-start gap-1.5 sm:gap-2.5 ${
                    activeTab === "ai_monitoring" 
                      ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm" 
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Server className="w-4 h-4 text-[#008DC9] shrink-0" />
                  <span className="hidden md:block">{lang === "en" ? "AI & NER Engine Sandbox" : "بيئة تجربة محرك الذكاء الاصطناعي"}</span>
                </button>
              )}
            </>
          )}

          {/* Admin RBAC Tab */}
          {currentUser?.role === "Administrator" && (
            <>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mt-4 mb-2 hidden md:block">Administrative Portals</p>
              <button
                onClick={() => setActiveTab("admin")}
                className={`w-full text-left px-1 sm:px-2 md:px-3 py-2 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center justify-center md:justify-start gap-1.5 sm:gap-2.5 ${
                  activeTab === "admin" 
                    ? "bg-slate-100 text-[#008DC9] border-l-4 border-[#008DC9] shadow-sm" 
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Settings className="w-4 h-4 text-[#008DC9] shrink-0" />
                <span className="hidden md:block">{t.userManagement}</span>
              </button>
            </>
          )}

          {currentUser?.role !== "Doctor" && currentUser?.role !== "Nurse" && (
            <div className="mt-auto pt-4 border-t border-slate-100 hidden md:block">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-[10px] font-bold text-[#008DC9] uppercase mb-1">Edge AI Model</p>
                <p className="text-xs text-blue-900 font-semibold">v2.4.0 ONNX Loaded</p>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">Quantization INT8: OK</p>
              </div>
            </div>
          )}
        </aside>

        {/* Content View Routing Area */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "nurse" && (
            <NurseDashboard lang={lang} onLogAudit={handleLogAuditOnServer} online={online} userRole={currentUser?.role} />
          )}

          {activeTab === "doctor" && (
            <DoctorDashboard lang={lang} onLogAudit={handleLogAuditOnServer} online={online} userRole={currentUser?.role} />
          )}

          {activeTab === "kb" && (
            <KnowledgeBaseDashboard lang={lang} />
          )}

          {activeTab === "sync_dashboard" && (
            <SyncDashboard lang={lang} currentUser={currentUser} />
          )}

          {activeTab === "records_sync" && (
            <RecordsSyncDashboard lang={lang} onNavigateToNurse={() => setActiveTab("nurse")} />
          )}

          {activeTab === "analytics" && (
            <AnalyticsDashboard lang={lang} />
          )}

          {activeTab === "ai_monitoring" && (
            <AIMonitoringDashboard lang={lang} />
          )}

          {activeTab === "admin" && currentUser?.role === "Administrator" && (
            <AdminDashboard lang={lang} onLogAudit={handleLogAuditOnServer} online={online} />
          )}
        </main>
      </div>

      {/* Floatable Realtime Toast Alerts */}
      {toast && (
        <div className="fixed bottom-12 right-6 z-50 max-w-md animate-bounce" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
          <div className={`p-4 rounded-xl shadow-2xl border flex items-center gap-3 ${
            toast.type === "success" ? "bg-emerald-50 text-emerald-950 border-emerald-200" :
            toast.type === "warning" ? "bg-orange-50 text-orange-950 border-orange-200" :
            "bg-blue-50 text-blue-950 border-blue-200"
          }`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${
              toast.type === "success" ? "bg-emerald-500" :
              toast.type === "warning" ? "bg-orange-500" :
              "bg-blue-500"
            }`} />
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-400">
                {toast.type === "success" ? (lang === 'en' ? "Platform Sync Success" : "نجاح المزامنة") : (lang === 'en' ? "Platform Connectivity Alert" : "تنبيه الاتصال")}
              </span>
              <span className="text-xs font-bold mt-0.5">{toast.text}</span>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Footer */}
      <footer className="h-10 bg-slate-200 border-t border-slate-300 flex items-center justify-between px-6 shrink-0 text-slate-500 print:hidden text-[10px]">
        <div className="flex items-center gap-4 text-[10px] font-semibold text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 block"></span> FAISS Index: 4,200 nodes</span>
          <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full block ${online ? 'bg-emerald-500' : 'bg-amber-500'}`}></span> Local Sync: {online ? "Online Realtime" : "Cached Queue"}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-400 block"></span> MICS6 Engine Ready</span>
        </div>
        <div className="text-[10px] text-slate-400 font-bold">
          UNICEF/WHO MICS6 Integrated System © 2026
        </div>
      </footer>
    </div>
  );
}
