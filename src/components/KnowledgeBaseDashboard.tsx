import React, { useState, useEffect } from "react";
import { translations, Language } from "../utils/translation";
import { 
  Search, 
  Database, 
  PlusCircle, 
  CheckCircle, 
  ExternalLink, 
  RefreshCw, 
  Cpu, 
  Layers, 
  Activity, 
  Check, 
  X, 
  Globe, 
  Wifi, 
  WifiOff, 
  FileText, 
  ChevronRight, 
  ShieldCheck,
  UserCheck,
  Zap,
  BookOpen,
  Info
} from "lucide-react";
import { chunkText } from "../utils/kbService";
import { ivfClusters, calculateSimilarity } from "../utils/rag";

interface KnowledgeBaseDashboardProps {
  lang: Language;
}

interface NewGuidelineProposal {
  id: string;
  title: string;
  titleAr: string;
  organization: string;
  year: number;
  authors: string;
  abstract: string;
  abstractAr: string;
  clinicalSummary: string;
  clinicalSummaryAr: string;
  keywords: string[];
  citation: string;
  sourceUrl: string;
  approvedByAdmin: boolean;
  approvedByDoctor: boolean;
  language: "en" | "ar" | "bilingual";
}

export function KnowledgeBaseDashboard({ lang }: KnowledgeBaseDashboardProps) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<"library" | "inspector" | "sync">("library");
  
  // Knowledge Base State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allReferences, setAllReferences] = useState<any[]>([]);
  const [selectedReference, setSelectedReference] = useState<any | null>(null);
  const [filterOrg, setFilterOrg] = useState<string>("ALL");
  const [filterLang, setFilterLang] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(false);

  // Suggestion Form Inputs
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthors, setNewAuthors] = useState("");
  const [newOrg, setNewOrg] = useState("");
  const [newYear, setNewYear] = useState(new Date().getFullYear().toString());
  const [newAbstract, setNewAbstract] = useState("");
  const [newCitation, setNewCitation] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [suggestSaved, setSuggestSaved] = useState(false);

  // Embeddings Inspector State
  const [inspectorText, setInspectorText] = useState<string>(
    "WHO Guidelines: F-75 Therapeutic Milk is indicated for stabilization of infants with Severe Acute Malnutrition who exhibit severe anorexia, systemic infection, or bilateral pitting oedema (Kwashiorkor). Administer 100-130 mL/kg/day under rigorous clinical monitoring to prevent refeeding syndrome."
  );
  const [selectedModel, setSelectedModel] = useState<"all-MiniLM-L6-v2" | "multi-qa-MiniLM-L6-cos-v1">("all-MiniLM-L6-v2");
  const [inspectionResult, setInspectionResult] = useState<any | null>(null);
  const [isVectorizing, setIsVectorizing] = useState<boolean>(false);
  const [indexingLog, setIndexingLog] = useState<string[]>([]);

  // MoPHP Sync State
  const [simulatedRole, setSimulatedRole] = useState<"Doctor" | "Administrator" | "Nurse">("Doctor");
  const [onlineSimulator, setOnlineSimulator] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([
    "Local offline guidelines cache initialized on boot. (Size: 105 chunks)",
    "IndexIVFFlat local indexing centroids mapped to 5 core malnutrition clusters."
  ]);
  
  // Predefined MoPHP/WHO Updates Proposals Awaiting Consensus (Yemeni Minister of Health Alignment)
  const [proposals, setProposals] = useState<NewGuidelineProposal[]>([
    {
      id: "PROP-001",
      title: "Yemeni MoPHP 2025 National Guidelines for the Outpatient Management of Severe Acute Malnutrition without Complications",
      titleAr: "وزارة الصحة العامة والسكان اليمنية 2025: الدليل الوطني للإدارة الخارجية لسوء التغذية الحاد الشديد بدون مضاعفات طبية",
      organization: "Yemeni MoPHP",
      year: 2025,
      authors: "Yemeni MoPHP Nutrition Department Expert Group",
      abstract: "These guidelines adapt WHO global standards specifically to the low-resource and high-volatility contexts in Yemen, standardizing MUAC-based diagnostics (<115mm) and optimized Ready-to-Use Therapeutic Food (RUTF) ration protocols for decentralized field mobile health clinics.",
      abstractAr: "يكيف هذا الدليل معايير منظمة الصحة العالمية خصيصاً مع السياق اليمني المتأثر بالنزاعات ومحدودية الموارد، حيث يوحد التشخيص بناء على قياس محيط منتصف الذراع (MUAC < 115 ملم) وصرف الأغذية العلاجية الجاهزة (RUTF) عبر العيادات المتنقلة.",
      clinicalSummary: "Outlines emergency OTP dosage charts. Prescribes 150-200 kcal/kg/day of RUTF. Sets strict weekly follow-up mandates and immediate emergency inpatient referral criteria for secondary complications like dehydration or persistent vomiting.",
      clinicalSummaryAr: "يوضح جداول جرعات الأغذية العلاجية OTP الطارئة بمعدل 150-200 سعرة حرارية لكل كجم يومياً. يقرر المتابعة الأسبوعية وشروط الإحالة الفورية للمستشفيات عند ظهور جفاف أو قيء مستمر.",
      keywords: ["Yemeni MoPHP", "OTP Guidelines", "RUTF dosage", "Low-resource adaptation"],
      citation: "Yemeni Ministry of Public Health and Population. (2025). National SAM Outpatient Protocol. Aden: MoPHP.",
      sourceUrl: "https://mophp-ye.org",
      approvedByAdmin: false,
      approvedByDoctor: false,
      language: "bilingual"
    },
    {
      id: "PROP-002",
      title: "WHO 2025 Consolidated Guideline on the Prevention and Management of Wasting and Nutritional Oedema in Infants and Children",
      titleAr: "منظمة الصحة العالمية 2025: الدليل الموحد للوقاية من الهزال والوذمة التغذوية لدى الرضع والأطفال وإدارتها",
      organization: "WHO",
      year: 2025,
      authors: "World Health Organization Department of Nutrition and Food Safety",
      abstract: "A landmark updated guideline providing new evidence-based thresholds and recommendations for the treatment of severe wasting, moderate wasting, and nutritional oedema, with a strong focus on community-based care and infant young child feeding (IYCF) counseling integration.",
      abstractAr: "دليل محدث تاريخي يقدم توصيات جديدة قائمة على الأدلة السريرية لعلاج الهزال الشديد والهزال المتوسط والوذمة التغذوية (الاستسقاء)، مع التركيز القوي على الرعاية المجتمعية ودمج استشارات تغذية الرضع وصغار الأطفال (IYCF).",
      clinicalSummary: "Expands the role of MUAC for identifying infants under 6 months. Refines the diagnostic criteria for bilateral pitting oedema and advocates for intensive complementary food support to prevent relapse from MAM to SAM.",
      clinicalSummaryAr: "يوسع دور محيط منتصف الذراع لمراقبة الأطفال دون سن 6 أشهر. يعيد صياغة المعايير التشخيصية للوذمة الانطباعية الثنائية ويوصي بالمكملات الغذائية لمنع الانتكاس من الهزال المتوسط إلى الشديد.",
      keywords: ["WHO 2025", "Nutritional Oedema", "MAM prevention", "Relapse Mitigation", "IYCF"],
      citation: "World Health Organization. (2025). Guideline on Wasting and Oedema. Geneva: WHO.",
      sourceUrl: "https://www.who.int",
      approvedByAdmin: false,
      approvedByDoctor: false,
      language: "en"
    },
    {
      id: "PROP-003",
      title: "Joint MoPHP & UNICEF 2026 Emergency Nutrition Response Protocol for Low-Access Conflict-Affected Districts in Yemen",
      titleAr: "البروتوكول المشترك بين وزارة الصحة واليونيسف 2026: بروتوكول الاستجابة الغذائية الطارئة في المديريات ذات الوصول المحدود في اليمن",
      organization: "UNICEF / MoPHP",
      year: 2026,
      authors: "Yemen Nutrition Cluster Taskforce",
      abstract: "An emergency simplified protocol designed for frontline community health volunteers (CHVs) operating in high-security risk zones where standard therapeutic supplies are intermittently disrupted. Integrates simplified diagnostics (MUAC-only and oedema check) and rationalized dosage regimens.",
      abstractAr: "بروتوكول مبسط للحالات الطارئة مصمم لمتطوعي الصحة المجتمعية العاملين في المناطق عالية الخطورة الأمنية حيث تنقطع الإمدادات بانتظام. يعتمد على القياس الثنائي البسيط لمحيط الذراع وفحص الوذمة فقط لتسريع التشخيص.",
      clinicalSummary: "Allows single-envelope daily therapeutic dosing under absolute supply scarcity. Authorizes non-professional community health volunteers to distribute emergency supplemental nutrition packages to reduce under-5 mortality.",
      clinicalSummaryAr: "يسمح بجرعات علاجية مبسطة (ظرف واحد يومياً) عند الشح الشديد للإمدادات العلاجية. يفوض متطوعي المجتمع لتوزيع مكملات التغذية لخفض معدل الوفيات.",
      keywords: ["UNICEF", "Emergency Protocol", "Simplified Treatment", "Conflict Zones", "Yemen"],
      citation: "Yemen Nutrition Cluster. (2026). Simplified Protocols for Emergency Scarcity. Sana'a: UNICEF.",
      sourceUrl: "https://unicef.org",
      approvedByAdmin: false,
      approvedByDoctor: false,
      language: "bilingual"
    }
  ]);

  useEffect(() => {
    fetchKnowledgeBase();
  }, []);

  const fetchKnowledgeBase = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/knowledge-base");
      const data = await res.json();
      setAllReferences(data);
    } catch (e) {
      console.error("Offline; knowledge base offline fallback loaded.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const res = await fetch("/api/rag/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery })
      });
      const data = await res.json();
      setSearchResults(data.results);
    } catch (err) {
      // Local fallback search (offline RAG using calculateSimilarity from ../utils/rag)
      const results = allReferences.map((ref) => {
        const corpusEn = `${ref.title} ${ref.abstract} ${ref.clinicalSummary} ${ref.keywords?.join(" ")}`;
        const corpusAr = `${ref.titleAr || ""} ${ref.abstractAr || ""} ${ref.clinicalSummaryAr || ""}`;
        const corpus = `${corpusEn} ${corpusAr}`.toLowerCase();
        
        const score = parseFloat(calculateSimilarity(searchQuery, corpus).toFixed(3));
        return { reference: ref, score, clusterName: "Local Cached IVF-Flat Index" };
      });
      setSearchResults(results.sort((a, b) => b.score - a.score).slice(0, 3));
    } finally {
      setLoading(false);
    }
  };

  const handleResetSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedReference(null);
  };

  const handleSubmitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newAuthors || !newAbstract) return;

    const payload = {
      title: newTitle,
      authors: newAuthors,
      organization: newOrg,
      year: newYear,
      abstract: newAbstract,
      citation: newCitation,
      sourceUrl: newUrl
    };

    try {
      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSuggestSaved(true);
        setTimeout(() => {
          setSuggestSaved(false);
          setShowAddForm(false);
          clearSuggestForm();
          fetchKnowledgeBase();
        }, 3000);
      }
    } catch (err) {
      // Offline fallback queue suggest to localStorage
      const localKBQueue = JSON.parse(localStorage.getItem("local_kb_suggestions_queue") || "[]");
      localKBQueue.push(payload);
      localStorage.setItem("local_kb_suggestions_queue", JSON.stringify(localKBQueue));
      
      setSuggestSaved(true);
      setTimeout(() => {
        setSuggestSaved(false);
        setShowAddForm(false);
        clearSuggestForm();
      }, 3000);
    }
  };

  const clearSuggestForm = () => {
    setNewTitle("");
    setNewAuthors("");
    setNewOrg("");
    setNewAbstract("");
    setNewCitation("");
    setNewUrl("");
  };

  // Embeddings Inspector Pipeline Simulation
  const handleInspectPipeline = () => {
    if (!inspectorText.trim()) return;
    setIsVectorizing(true);
    setIndexingLog(["Initializing Vector Pipeline...", `Target Model: ${selectedModel}`]);

    setTimeout(() => {
      // 1. Text Chunking
      const chunks = chunkText(inspectorText, 250);
      setIndexingLog(prev => [
        ...prev,
        `Step 1: Ingested text length: ${inspectorText.length} characters.`,
        `Step 1: Segmented into ${chunks.length} semantically coherent chunks using kbService.ts.`
      ]);

      // 2. Generate determinisic dense vectors (representing 384 dimensions)
      const generateSimulatedEmbedding = (text: string): number[] => {
        const vector: number[] = [];
        let seed = 0;
        for (let i = 0; i < text.length; i++) {
          seed += text.charCodeAt(i);
        }
        for (let i = 0; i < 384; i++) {
          const val = Math.sin(seed + i) * Math.cos(seed - i);
          vector.push(parseFloat(val.toFixed(4)));
        }
        return vector;
      };

      const primaryChunk = chunks[0] || inspectorText;
      const embedding = generateSimulatedEmbedding(primaryChunk);

      setIndexingLog(prev => [
        ...prev,
        `Step 2: Vectorizing Primary Chunk: "${primaryChunk.substring(0, 40)}..."`,
        `Step 2: Dense float embedding generated. Dimensionality: 384.`
      ]);

      // 3. IVF-Flat Centroid Routing
      const centroidScores = ivfClusters.map(cluster => {
        let matchCount = 0;
        const lowercaseText = primaryChunk.toLowerCase();
        cluster.centroidKeywords.forEach(kw => {
          if (lowercaseText.includes(kw.toLowerCase())) {
            matchCount += 1;
          }
        });
        return {
          id: cluster.id,
          name: cluster.name,
          nameAr: cluster.nameAr,
          score: matchCount
        };
      });

      const winningCentroid = [...centroidScores].sort((a, b) => b.score - a.score)[0] || centroidScores[0];

      setIndexingLog(prev => [
        ...prev,
        `Step 3: Calculating cosine proximity against 5 IVF centroids.`,
        `Step 3: Closest cluster matched: "Centroid ${winningCentroid.id} - ${winningCentroid.name}" (Overlap Score: ${winningCentroid.score}).`
      ]);

      setInspectionResult({
        chunks,
        embedding,
        centroidScores,
        winningCentroid,
        primaryChunk
      });
      setIsVectorizing(false);
      setIndexingLog(prev => [...prev, "Pipeline Inspector complete. Ready to write to index."]);
    }, 1200);
  };

  const handleIndexIntoLocalDB = () => {
    if (!inspectionResult) return;

    const newRef = {
      id: `REF-INSPECT-${Date.now()}`,
      title: `Field Operator Upload: ${inspectionResult.primaryChunk.substring(0, 45)}...`,
      authors: "Field Clinician (Operator)",
      organization: "Yemen Local Deployment Unit",
      year: new Date().getFullYear(),
      abstract: inspectionResult.primaryChunk,
      keywords: ["field-upload", "operator-ingested"],
      citation: "Uploaded directly via RAG Embeddings Inspector.",
      sourceUrl: "",
      approvedByAdmin: true,
      approvedByDoctor: true
    };

    // Save to local RAG dynamic references list
    const existingStr = localStorage.getItem("yemen_platform_dynamic_refs") || "[]";
    let list = JSON.parse(existingStr);
    list.push(newRef);
    localStorage.setItem("yemen_platform_dynamic_refs", JSON.stringify(list));

    // Update in-memory reference view
    setAllReferences(prev => [newRef, ...prev]);
    setIndexingLog(prev => [
      ...prev,
      `[SUCCESS] Appended chunk to local IndexedDB/localStorage FAISS Cache.`,
      `[SUCCESS] Reference ${newRef.id} is now LIVE in the bilingual search indices.`
    ]);

    // Simple toast simulation
    alert("Guideline chunk successfully vectorized, cached, and indexed into the local vector space!");
  };

  // MoPHP Online Sync and Approval Consensus
  const handleTriggerSync = () => {
    if (!onlineSimulator) {
      alert("Error: Network disconnected. Toggle the 'Internet Synchronization Gate' to simulate a live satellite or cellular uplink.");
      return;
    }

    setIsSyncing(true);
    setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Querying MoPHP aden/sanaa central update feeds...`]);

    setTimeout(() => {
      setSyncLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Found 3 newer protocol guideline proposals waiting for local clinic integration.`,
        `[${new Date().toLocaleTimeString()}] Establishing satellite socket connection... secure handshakes authorized.`
      ]);
      setIsSyncing(false);
    }, 1500);
  };

  const handleApproveProposal = async (propId: string, roleToSimulate: "Doctor" | "Administrator") => {
    // Update local proposal state
    const updatedProposals = proposals.map(p => {
      if (p.id === propId) {
        const approvedByAdmin = roleToSimulate === "Administrator" ? true : p.approvedByAdmin;
        const approvedByDoctor = roleToSimulate === "Doctor" ? true : p.approvedByDoctor;
        
        // If both are now approved, automatically trigger vector pipeline!
        if (approvedByAdmin && approvedByDoctor) {
          triggerBackgroundVectorization(p);
        }

        return {
          ...p,
          approvedByAdmin,
          approvedByDoctor
        };
      }
      return p;
    });

    setProposals(updatedProposals);

    // Write audit log and sync log
    const prop = proposals.find(p => p.id === propId);
    if (prop) {
      setSyncLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [CONCENSUS] ${roleToSimulate} approved proposal "${prop.title.substring(0, 35)}..."`
      ]);

      // If we are online, trigger server side approvals to persist in Firestore
      if (onlineSimulator) {
        try {
          await fetch(`/api/knowledge-base/approve/${propId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: roleToSimulate, userEmail: "tasneem1992.7@gmail.com" })
          });
        } catch (e) {
          console.warn("Could not synchronize approval to central servers, queued locally.");
        }
      }
    }
  };

  const triggerBackgroundVectorization = (prop: NewGuidelineProposal) => {
    setSyncLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [PIPELINE] Consensus Reached! Triggering all-MiniLM-L6-v2 vector pipeline...`,
      `[${new Date().toLocaleTimeString()}] [PIPELINE] Tokenizing "${prop.title.substring(0, 40)}..."`,
      `[${new Date().toLocaleTimeString()}] [PIPELINE] Dense vectors generated (Dimensions: 384, Type: Float32).`,
      `[${new Date().toLocaleTimeString()}] [PIPELINE] Routing to IVF cluster 1 and 3... Index successfully optimized and updated.`
    ]);

    // Append to active RAG refs
    const newRef = {
      id: prop.id,
      title: prop.title,
      titleAr: prop.titleAr,
      authors: prop.authors,
      organization: prop.organization,
      year: prop.year,
      abstract: prop.abstract,
      abstractAr: prop.abstractAr,
      clinicalSummary: prop.clinicalSummary,
      clinicalSummaryAr: prop.clinicalSummaryAr,
      keywords: prop.keywords,
      citation: prop.citation,
      sourceUrl: prop.sourceUrl,
      approvedByAdmin: true,
      approvedByDoctor: true
    };

    // Save to local dynamic references
    const existingStr = localStorage.getItem("yemen_platform_dynamic_refs") || "[]";
    let list = JSON.parse(existingStr);
    if (!list.some((r: any) => r.id === newRef.id)) {
      list.push(newRef);
      localStorage.setItem("yemen_platform_dynamic_refs", JSON.stringify(list));
    }

    setAllReferences(prev => {
      if (prev.some(r => r.id === newRef.id)) return prev;
      return [newRef, ...prev];
    });

    // Notify user
    alert(`Consensus reached! "${prop.title.substring(0, 50)}..." has been fully approved, vectorized, and integrated into active clinical recommendation RAG engine.`);
  };

  const renderedList = searchResults.length > 0 
    ? searchResults 
    : allReferences
        .filter(r => {
          if (filterOrg !== "ALL" && r.organization !== filterOrg) return false;
          if (filterLang !== "ALL") {
            if (filterLang === "AR" && !r.titleAr) return false;
            if (filterLang === "EN" && r.titleAr && r.titleAr === r.title) return false;
          }
          return true;
        })
        .map(r => ({ reference: r, score: 1.0, clusterName: "WHO Consolidated Indices" }));

  // Get unique organizations for the filter list
  const uniqueOrgs = Array.from(new Set(allReferences.map(r => r.organization))).filter(Boolean);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" id="kb-global-dashboard-container">
      {/* Custom Styled Header Banner */}
      <div className="bg-[#008DC9] rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-2xl transform translate-x-12 -translate-y-12"></div>
        <div className="space-y-1 z-10">
          <span className="text-[10px] uppercase font-bold tracking-widest bg-white/20 px-2.5 py-1 rounded-full text-white">
            {lang === "en" ? "Offline-First Decision Support Suite" : "حزمة دعم القرار دون اتصال بالإنترنت"}
          </span>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 mt-2">
            <Database className="w-6.5 h-6.5 text-[#EFE300]" />
            {lang === "en" ? "Bilingual Clinical Guidelines & RAG Library" : "المكتبة الإرشادية والبحث الدلالي ثنائي اللغة"}
          </h1>
          <p className="text-white/85 text-xs font-semibold max-w-2xl">
            {lang === "en" 
              ? "Access peer-reviewed WHO and Yemeni MoPHP child malnutrition protocols. Experience interactive embedding vectorizing pipelines and multi-role sync consensus safeguards optimized for zero-connectivity zones."
              : "تصفح وابحث في بروتوكولات سوء التغذية للأطفال الخاصة بمنظمة الصحة العالمية ووزارة الصحة اليمنية. استكشف خط معالجة المتجهات وتأكيد بروتوكولات الإجماع في المناطق المعزولة."}
          </p>
        </div>

        {/* Global Network Indicator */}
        <div className="shrink-0 bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-xs font-bold space-y-1 z-10 flex flex-col items-end">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${onlineSimulator ? "bg-emerald-400 animate-ping" : "bg-rose-400"}`}></span>
            <span>{onlineSimulator ? "UPLINK STABLE (SIMULATED)" : "OFFLINE CACHE ACTIVE"}</span>
          </div>
          <button 
            onClick={() => setOnlineSimulator(!onlineSimulator)} 
            className="text-[10px] text-[#EFE300] hover:underline font-black mt-1 uppercase"
          >
            Toggle Satellite Gate
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab("library")}
          className={`px-5 py-3 font-bold text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "library" 
              ? "border-[#008DC9] text-[#008DC9]" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <BookOpen className="w-4.5 h-4.5" />
          {lang === "en" ? "Browse & Search Library" : "استعراض والبحث في المكتبة"}
        </button>

        <button
          onClick={() => setActiveTab("inspector")}
          className={`px-5 py-3 font-bold text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "inspector" 
              ? "border-[#008DC9] text-[#008DC9]" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Cpu className="w-4.5 h-4.5" />
          {lang === "en" ? "Embeddings Inspector Pipeline" : "مفتش ومحلل المتجهات والقطع"}
        </button>

        <button
          onClick={() => setActiveTab("sync")}
          className={`px-5 py-3 font-bold text-sm transition-all flex items-center gap-2 border-b-2 cursor-pointer ${
            activeTab === "sync" 
              ? "border-[#008DC9] text-[#008DC9]" 
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="w-4.5 h-4.5" />
          {lang === "en" ? "MoPHP MoC Update Portal" : "بوابة مزامنة تحديثات وزارة الصحة"}
          {proposals.some(p => !p.approvedByAdmin || !p.approvedByDoctor) && (
            <span className="w-2.5 h-2.5 bg-purple-600 rounded-full animate-pulse shrink-0"></span>
          )}
        </button>
      </div>

      {/* Tab 1: Guidelines Library Browse & Search */}
      {activeTab === "library" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Search Column */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Search className="w-4.5 h-4.5 text-[#008DC9]" />
                {lang === "en" ? "Semantic Vector Retrieval Search" : "البحث الدلالي المتجهي المدعوم"}
              </h2>
              <form onSubmit={handleSearch} className="space-y-3">
                <div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === "en" ? "Search wasting, oedema dosage, stunting protocols..." : "ابحث عن بروتوكولات الهزال، علاج الوذمة، تغذية الأطفال..."}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#008DC9] focus:bg-white transition-all font-medium"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-[#008DC9] hover:bg-[#007cb2] text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    {lang === "en" ? "Query Vector DB" : "بحث في قاعدة المتجهات"}
                  </button>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={handleResetSearch}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 rounded-xl text-xs transition-all"
                    >
                      {lang === "en" ? "Reset" : "إعادة تعيين"}
                    </button>
                  )}
                </div>
              </form>

              {/* Advanced Filter Widgets */}
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <h3 className="text-xs font-bold text-slate-700">{lang === "en" ? "Filter by Source Agency" : "تصفية حسب المنظمة"}</h3>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFilterOrg("ALL")}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      filterOrg === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {lang === "en" ? "All Sources" : "جميع المصادر"}
                  </button>
                  {uniqueOrgs.map((org, index) => (
                    <button
                      key={index}
                      onClick={() => setFilterOrg(org)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                        filterOrg === org ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {org}
                    </button>
                  ))}
                </div>

                <h3 className="text-xs font-bold text-slate-700 pt-2">{lang === "en" ? "Filter by Language" : "تصفية حسب اللغة"}</h3>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => setFilterLang("ALL")}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      filterLang === "ALL" ? "bg-[#008DC9] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {lang === "en" ? "All Languages" : "كل اللغات"}
                  </button>
                  <button
                    onClick={() => setFilterLang("AR")}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      filterLang === "AR" ? "bg-[#008DC9] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {lang === "en" ? "Arabic" : "العربية"}
                  </button>
                  <button
                    onClick={() => setFilterLang("EN")}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                      filterLang === "EN" ? "bg-[#008DC9] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {lang === "en" ? "English" : "الإنجليزية"}
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Proposal Trigger Panel */}
            <div className="bg-purple-50/75 p-6 rounded-2xl border border-purple-100 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                  <PlusCircle className="w-4.5 h-4.5 text-purple-700" />
                  {lang === "en" ? "Submit Custom Protocol" : "تقديم بروتوكول مخصص للتدقيق"}
                </h3>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="text-xs text-purple-700 hover:text-purple-900 font-black uppercase"
                >
                  {showAddForm ? "Close" : "Open Form"}
                </button>
              </div>

              {showAddForm && (
                <form onSubmit={handleSubmitSuggestion} className="space-y-3 text-xs">
                  <div>
                    <label className="text-purple-900 font-bold mb-1 block">Protocol Title *</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. Aden regional complementary feeding study"
                      className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-purple-900 font-bold mb-1 block">Lead Authors *</label>
                      <input
                        type="text"
                        required
                        value={newAuthors}
                        onChange={(e) => setNewAuthors(e.target.value)}
                        placeholder="e.g. Dr. Al-Haddad"
                        className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-purple-900 font-bold mb-1 block">Year</label>
                      <input
                        type="text"
                        value={newYear}
                        onChange={(e) => setNewYear(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-purple-900 font-bold mb-1 block">Source Organization</label>
                    <input
                      type="text"
                      value={newOrg}
                      onChange={(e) => setNewOrg(e.target.value)}
                      placeholder="e.g. Sana'a University"
                      className="w-full bg-white border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-purple-900 font-bold mb-1 block">Abstract / Key Clinical Guidelines *</label>
                    <textarea
                      required
                      value={newAbstract}
                      onChange={(e) => setNewAbstract(e.target.value)}
                      placeholder="Enter the full guideline text..."
                      className="w-full bg-white border border-purple-200 rounded-lg p-3 h-20 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2 px-4 rounded-xl shadow-sm transition-all cursor-pointer"
                  >
                    {suggestSaved ? "Successfully submitted!" : "Submit for Consensus Ingestion"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Results Display Area */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Database className="w-4.5 h-4.5 text-[#008DC9]" />
                {lang === "en" ? "Active RAG Vector Space Guideline Chunks" : "القطع النشطة لمتجهات الدليل الاسترشادي"}
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-bold">
                  {allReferences.length} total references
                </span>
              </h2>
            </div>

            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-[#008DC9] animate-spin" />
                <p className="text-xs font-bold text-slate-500">Querying semantic indices...</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-60 sm:max-h-80 lg:max-h-[calc(100vh-270px)] overflow-y-auto pr-2">
                {renderedList.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Info className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-bold">No guideline segments found matching the specified filters.</p>
                  </div>
                ) : (
                  renderedList.map((item: any, idx: number) => {
                    const r = item.reference;
                    const isSelected = selectedReference?.id === r.id;

                    return (
                      <div 
                        key={idx} 
                        onClick={() => setSelectedReference(isSelected ? null : r)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-xs space-y-2.5 hover:border-slate-300 ${
                          isSelected 
                            ? "bg-[#008DC9]/5 border-[#008DC9] shadow-sm" 
                            : "bg-slate-50/50 border-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                              {r.organization || "WHO"}
                            </span>
                            <h4 className="font-extrabold text-slate-900 text-sm mt-1 leading-snug">
                              {lang === "en" ? r.title : r.titleAr || r.title}
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold">
                              Authors: {r.authors} | Year: {r.year}
                            </p>
                          </div>
                          {searchResults.length > 0 && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-black whitespace-nowrap">
                              Score: {item.score}
                            </span>
                          )}
                        </div>

                        {/* Collapsible Abstract Content */}
                        <div className="text-slate-600 leading-relaxed font-semibold">
                          <span className="text-slate-900 font-bold block mb-1">
                            {lang === "en" ? "Consolidated Scientific Protocol Chunk:" : "القطعة العلمية الموحدة للبروتوكول:"}
                          </span>
                          <p className={isSelected ? "" : "line-clamp-2"}>
                            {lang === "en" ? r.abstract : r.abstractAr || r.abstract}
                          </p>
                        </div>

                        {isSelected && (
                          <>
                            {r.clinicalSummary && (
                              <div className="text-slate-600 leading-relaxed border-t border-slate-100 pt-3 space-y-1 font-semibold animate-fadeIn">
                                <span className="text-slate-900 font-bold block">
                                  {lang === "en" ? "Diagnostic Indicators & Intervention Directives:" : "المؤشرات التشخيصية وتوجيهات التدخل:"}
                                </span>
                                <p className="bg-white/80 p-3 rounded-lg border border-slate-200/60 leading-relaxed text-slate-700 font-medium">
                                  {lang === "en" ? r.clinicalSummary : r.clinicalSummaryAr || r.clinicalSummary}
                                </p>
                              </div>
                            )}

                            {r.keywords && r.keywords.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-2">
                                {r.keywords.map((kw: string, i: number) => (
                                  <span key={i} className="bg-slate-100 text-slate-600 text-[9px] font-black px-2 py-0.5 rounded">
                                    #{kw}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="flex flex-col sm:flex-row justify-between sm:items-center text-[10px] text-slate-400 border-t border-slate-100 pt-3 font-bold gap-2">
                              <span>Citation: {r.citation}</span>
                              {r.sourceUrl && (
                                <a
                                  href={r.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#008DC9] hover:text-[#007cb2] font-black flex items-center gap-1 shrink-0 bg-[#008DC9]/10 px-2.5 py-1 rounded"
                                >
                                  {lang === "en" ? "View Source" : "عرض المصدر"}
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </>
                        )}

                        {!isSelected && (
                          <div className="text-right">
                            <span className="text-[10px] text-[#008DC9] font-extrabold hover:underline">
                              {lang === "en" ? "Click to view full protocol..." : "انقر لعرض كامل البروتوكول..."}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Embeddings & IVF Pipeline Inspector */}
      {activeTab === "inspector" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Input & Parameters Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-[#008DC9]" />
                {lang === "en" ? "Dynamic Vector Embedding Pipeline" : "مراحل توليد وتوجيه المتجهات السريرية"}
              </h2>

              <p className="text-slate-500 text-xs font-semibold leading-relaxed">
                {lang === "en"
                  ? "Input clinical text (protocols, emergency measures, or research notes). This simulation parses, chunks, vectorizes, and visualizes the semantic alignment steps of our offline-first RAG engine."
                  : "أدخل نصاً سريرياً لمشاهدة كيف يقوم نموذج RAG المحلي بتجزئة النصوص واستخراج المعالم الرياضية وتوليد متجهات ذات 384 بعداً لمطابقتها فوراً."}
              </p>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-slate-700 font-bold text-xs mb-1 block">
                    {lang === "en" ? "Select Local Embedding Model Proxy" : "نموذج توليد المتجهات المحلي"}
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#008DC9] font-bold text-slate-700"
                  >
                    <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (384 Dimensions - Fast)</option>
                    <option value="multi-qa-MiniLM-L6-cos-v1">multi-qa-MiniLM-L6-cos-v1 (384 Dimensions - QA Tuned)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold text-xs mb-1 block">
                    {lang === "en" ? "Clinical Protocol Segment / Text Input" : "النص السريري للبروتوكول"}
                  </label>
                  <textarea
                    value={inspectorText}
                    onChange={(e) => setInspectorText(e.target.value)}
                    rows={6}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#008DC9] focus:bg-white transition-all font-medium text-slate-700"
                    placeholder="e.g. In severe stunting (HAZ < -3 SD), provide supplementary complementary food..."
                  />
                  <div className="text-right text-[10px] text-slate-400 font-bold mt-1">
                    {inspectorText.length} characters | Approx {Math.ceil(inspectorText.length / 4)} tokens
                  </div>
                </div>

                <button
                  onClick={handleInspectPipeline}
                  disabled={isVectorizing || !inspectorText.trim()}
                  className="w-full bg-[#008DC9] hover:bg-[#007cb2] disabled:bg-slate-200 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Zap className="w-3.5 h-3.5 text-[#EFE300]" />
                  {isVectorizing ? "Generating Vectors..." : "Execute Vector Ingestion Pipeline"}
                </button>
              </div>
            </div>

            {/* Pipeline Step Log */}
            <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl shadow-inner space-y-3 font-mono text-[10px]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-[#008DC9]">PIPELINE LOG TRACE</span>
                <span className="text-slate-500 font-bold">STATE: IDLE</span>
              </div>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {indexingLog.length === 0 ? (
                  <p className="text-slate-500">Waiting for trigger input...</p>
                ) : (
                  indexingLog.map((log, index) => (
                    <p key={index} className="leading-relaxed">
                      <span className="text-[#EFE300] mr-1.5">&gt;</span>
                      {log}
                    </p>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Visualization Column */}
          <div className="lg:col-span-7 space-y-6">
            {!inspectionResult ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
                <Info className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
                <h3 className="text-base font-bold text-slate-800">Vector space is empty</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto font-medium">
                  Trigger the Vector Ingestion Pipeline on the left to inspect detailed paragraph chunking, vector weights, centroid alignments, and FAISS space maps.
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                {/* Step 1: Semantic Chunks View */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-800 font-extrabold">1</span>
                    {lang === "en" ? "Semantic Paragraph Chunking" : "تفتيت النصوص الذكي إلى مقاطع متناسقة"}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {inspectionResult.chunks.map((chunk: string, i: number) => (
                      <div key={i} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] leading-relaxed relative font-medium">
                        <span className="absolute top-2 right-2 text-[9px] font-bold bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
                          Chunk {i + 1}
                        </span>
                        <p className="pr-12 text-slate-700">{chunk}</p>
                        <div className="mt-2 text-[10px] text-slate-400 font-bold">
                          {chunk.length} characters | approx {Math.ceil(chunk.length / 4)} tokens
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 2: Dense Vectors Visualizer */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-800 font-extrabold">2</span>
                    {lang === "en" ? "Dense Embeddings Weight Matrix (384-Float)" : "مصفوفة أوزان المتجهات ثلاثية الأبعاد (384-Float)"}
                  </h3>

                  <p className="text-[11px] text-slate-500 font-medium">
                    {lang === "en" 
                      ? "A visual heat-map representing weight coefficients of the 384 dimensions. High positive weights are highlighted in bright teal, and highly negative weights in amber/red."
                      : "تمثيل بصري تفاعلي للأوزان الرقمية المولدة للمقاطع السريرية. تمثل الألوان درجة تقارب المفاهيم دلالياً."}
                  </p>

                  {/* Dense Heat Matrix Grid */}
                  <div className="pt-2">
                    <div className="flex flex-wrap gap-0.5 max-h-[140px] overflow-y-auto border border-slate-200 p-2.5 rounded-xl bg-slate-50 justify-center">
                      {inspectionResult.embedding.map((weight: number, i: number) => {
                        // Calculate color based on weight intensity
                        let bgClass = "bg-slate-200";
                        if (weight > 0.6) bgClass = "bg-teal-600";
                        else if (weight > 0.2) bgClass = "bg-teal-400";
                        else if (weight > 0) bgClass = "bg-teal-200";
                        else if (weight > -0.2) bgClass = "bg-amber-200";
                        else if (weight > -0.6) bgClass = "bg-amber-400";
                        else bgClass = "bg-red-500";

                        return (
                          <div 
                            key={i} 
                            title={`Dim ${i + 1}: Weight ${weight}`}
                            className={`w-2 h-2 sm:w-2.5 sm:h-2.5 aspect-square rounded-[1px] hover:scale-125 transition-all ${bgClass}`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-2">
                      <span>Dim #1</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-500 rounded-sm"></span> Negative</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-200 rounded-sm"></span> Zero</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-teal-600 rounded-sm"></span> Positive</span>
                      </div>
                      <span>Dim #384</span>
                    </div>
                  </div>

                  {/* First 10 dense floats */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono text-[10px] text-slate-600 flex flex-wrap gap-2 justify-center">
                    <span className="font-bold text-slate-800">Vector Head [1-12]:</span>
                    {inspectionResult.embedding.slice(0, 12).map((val: number, idx: number) => (
                      <span key={idx} className="bg-white px-1.5 py-0.5 rounded border border-slate-200/80">
                        {val >= 0 ? `+${val.toFixed(4)}` : val.toFixed(4)}
                      </span>
                    ))}
                    <span>...</span>
                  </div>
                </div>

                {/* Step 3: IVF Cluster Centroid Mapping */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-800 font-extrabold">3</span>
                    {lang === "en" ? "FAISS IndexIVFFlat Centroid Routing" : "مسار وتوجيه عناقيد فئة المجموعات"}
                  </h3>

                  <div className="space-y-3 pt-1 text-[11px]">
                    {inspectionResult.centroidScores.map((centroid: any, idx: number) => {
                      const isWinner = centroid.id === inspectionResult.winningCentroid.id;
                      const percentage = Math.min(100, Math.max(10, centroid.score * 20));

                      return (
                        <div key={idx} className={`p-3 rounded-xl border transition-all ${
                          isWinner ? "bg-[#008DC9]/5 border-[#008DC9]/50" : "bg-slate-50/40 border-slate-200/60"
                        }`}>
                          <div className="flex justify-between items-center mb-1.5 font-bold">
                            <span className={isWinner ? "text-[#008DC9]" : "text-slate-700"}>
                              Centroid #{centroid.id}: {lang === "en" ? centroid.name : centroid.nameAr}
                            </span>
                            <span className={isWinner ? "text-[#008DC9] font-black" : "text-slate-400"}>
                              {centroid.score} Keyword Overlaps
                            </span>
                          </div>

                          <div className="w-full bg-slate-200/60 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${isWinner ? "bg-[#008DC9]" : "bg-slate-400"}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleIndexIntoLocalDB}
                      className="w-full bg-[#008DC9] hover:bg-[#007cb2] text-white font-bold py-3 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Database className="w-4 h-4" />
                      {lang === "en" ? "Write to Local FAISS Indices & IndexedDB" : "تأكيد كتابة وحفظ المتجهات في الفهرس المحلي"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: MoPHP & WHO Sync Portal */}
      {activeTab === "sync" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn" id="mophp-consensus-tab">
          {/* Sourcing MoPHP Updates Feed */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <Globe className="w-5.5 h-5.5 text-purple-600 animate-pulse" />
                    {lang === "en" ? "Yemeni MoPHP & WHO Update Queue" : "قائمة تحديثات وزارة الصحة ومنظمة الصحة العالمية"}
                  </h2>
                  <p className="text-slate-500 text-xs font-semibold max-w-xl">
                    {lang === "en" 
                      ? "Awaiting dual-consensus authorizations before indexing. In decentralized emergency zones, medical guidelines must be approved by both Doctors and Administrators to assure local protocol compliance."
                      : "بانتظار موافقة ثنائية وتوافق الآراء قبل تفعيل الإدخال لضمان تلبية المعايير المحلية للعيادات النائية."}
                  </p>
                </div>

                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing}
                  className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  {lang === "en" ? "Check Central Feeds" : "التحقق من الخوادم المركزية"}
                </button>
              </div>

              {/* Simulation Identity Selector Widget */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="text-slate-400 font-bold block uppercase text-[9px] tracking-wider">Simulated Role Identity</span>
                  <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-purple-600" />
                    Act as Clinician: <span className="text-purple-700 underline underline-offset-2">{simulatedRole}</span>
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => setSimulatedRole("Doctor")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      simulatedRole === "Doctor" ? "bg-purple-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Clinical Doctor
                  </button>
                  <button
                    onClick={() => setSimulatedRole("Administrator")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      simulatedRole === "Administrator" ? "bg-purple-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Sys Administrator
                  </button>
                  <button
                    onClick={() => setSimulatedRole("Nurse")}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                      simulatedRole === "Nurse" ? "bg-purple-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Field Nurse
                  </button>
                </div>
              </div>

              {/* List of Proposals Awaiting Consensus */}
              <div className="space-y-4 pt-2">
                {proposals.map((prop) => {
                  const fullyApproved = prop.approvedByAdmin && prop.approvedByDoctor;

                  return (
                    <div 
                      key={prop.id} 
                      className={`p-5 rounded-2xl border text-xs space-y-4 transition-all ${
                        fullyApproved 
                          ? "bg-emerald-50/40 border-emerald-200" 
                          : "bg-slate-50/50 border-slate-200/80"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-purple-100 text-purple-800 text-[9px] font-black uppercase px-2 py-0.5 rounded">
                              {prop.organization}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">Year: {prop.year}</span>
                          </div>
                          <h3 className="text-sm font-extrabold text-slate-950 mt-1 leading-snug">
                            {lang === "en" ? prop.title : prop.titleAr}
                          </h3>
                        </div>
                        {fullyApproved && (
                          <span className="bg-emerald-100 text-emerald-800 font-black text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            INDEXED LIVE
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-600 bg-white p-3.5 rounded-xl border border-slate-100 leading-relaxed font-semibold">
                        <div>
                          <span className="font-bold text-slate-900 block mb-1">Abstract:</span>
                          <p>{lang === "en" ? prop.abstract : prop.abstractAr}</p>
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 block mb-1">Clinical Guidelines Summary:</span>
                          <p>{lang === "en" ? prop.clinicalSummary : prop.clinicalSummaryAr}</p>
                        </div>
                      </div>

                      {/* Approval Consensus Controls */}
                      <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs font-bold">
                        <div className="flex items-center gap-4 shrink-0">
                          {/* Doctor Checkbox */}
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                              prop.approvedByDoctor 
                                ? "bg-purple-600 border-purple-600 text-white" 
                                : "bg-white border-slate-300"
                            }`}>
                              {prop.approvedByDoctor && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <span className={prop.approvedByDoctor ? "text-slate-800" : "text-slate-400"}>
                              {lang === "en" ? "Doctor Approved" : "موافقة الطبيب المعتمد"}
                            </span>
                          </div>

                          {/* Admin Checkbox */}
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                              prop.approvedByAdmin 
                                ? "bg-purple-600 border-purple-600 text-white" 
                                : "bg-white border-slate-300"
                            }`}>
                              {prop.approvedByAdmin && <Check className="w-3.5 h-3.5" />}
                            </div>
                            <span className={prop.approvedByAdmin ? "text-slate-800" : "text-slate-400"}>
                              {lang === "en" ? "Admin Approved" : "موافقة مسؤول النظام"}
                            </span>
                          </div>
                        </div>

                        {/* Direct Approval Simulate Buttons */}
                        {!fullyApproved && (
                          <div className="flex gap-2 w-full sm:w-auto">
                            {simulatedRole === "Doctor" && !prop.approvedByDoctor && (
                              <button
                                onClick={() => handleApproveProposal(prop.id, "Doctor")}
                                className="flex-1 sm:flex-initial bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                              >
                                Approve as Doctor
                              </button>
                            )}

                            {simulatedRole === "Administrator" && !prop.approvedByAdmin && (
                              <button
                                onClick={() => handleApproveProposal(prop.id, "Administrator")}
                                className="flex-1 sm:flex-initial bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer"
                              >
                                Approve as Administrator
                              </button>
                            )}

                            {simulatedRole === "Nurse" && (
                              <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                Nurses cannot approve central guidelines
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sync Status Sidebar logs */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Activity className="w-4.5 h-4.5 text-[#008DC9]" />
                {lang === "en" ? "Local Index Cache Stats" : "إحصائيات الفهرس والاتصال"}
              </h3>

              <div className="space-y-3.5 text-xs font-bold text-slate-600">
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span>Connection Mode</span>
                  <span className={onlineSimulator ? "text-emerald-600" : "text-amber-600"}>
                    {onlineSimulator ? "Online Satellite Active" : "Offline Decoupled"}
                  </span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span>Current RAG Vector Count</span>
                  <span className="text-slate-900">{allReferences.length} Chunks</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span>IVF Sub-Clusters</span>
                  <span className="text-slate-900">5 Centroids Active</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2">
                  <span>Index Type</span>
                  <span className="text-slate-900">FAISS IndexIVFFlat (Cosine)</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 text-emerald-400 p-5 rounded-2xl shadow-inner space-y-3 font-mono text-[10px]">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold uppercase text-emerald-500">Live Sync Logs</span>
                <span className="bg-emerald-500/10 text-emerald-400 px-1.5 rounded text-[8px] font-bold">ONLINE</span>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto leading-relaxed">
                {syncLogs.map((log, idx) => (
                  <p key={idx} className="border-l border-emerald-500/30 pl-2">
                    {log}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
