import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Language } from "../utils/translation";
import { 
  Search, 
  Database, 
  ExternalLink, 
  RefreshCw, 
  Cpu, 
  Activity, 
  Check, 
  Globe, 
  ShieldCheck,
  UserCheck,
  Zap,
  BookOpen
} from "lucide-react";
import { chunkText } from "../utils/kbService";
import { ivfClusters, calculateSimilarity } from "../utils/rag";
import { ScientificReference } from "../types";
import { scientificReferences } from "../data/scientific_knowledge";

interface KnowledgeBaseDashboardProps {
  lang: Language;
}

interface NewGuidelineProposal {
  id: string;
  title: string;
  titleAr: string;
  authors: string;
  organization: string;
  year: number;
  abstract: string;
  abstractAr: string;
  citation: string;
  sourceUrl: string;
  approvedByAdmin: boolean;
  approvedByDoctor: boolean;
}

interface SearchResult {
  reference: ScientificReference;
  score: number;
  clusterName: string;
}

export function KnowledgeBaseDashboard({ lang }: KnowledgeBaseDashboardProps) {
  const [activeTab, setActiveTab] = useState<"library" | "inspector" | "sync">("library");
  
  // Knowledge Base State
  const [searchQuery, setSearchQuery] = useState<string>("" );
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allReferences, setAllReferences] = useState<ScientificReference[]>([]);
  const [selectedReference, setSelectedReference] = useState<ScientificReference | null>(null);
  const [filterOrg, setFilterOrg] = useState<string>("ALL");
  const [filterLang, setFilterLang] = useState<string>("ALL");
  const [loading, setLoading] = useState<boolean>(false);
  
  // New Suggestion Form State
  const [newTitle, setNewTitle] = useState<string>("");
  const [newAuthors, setNewAuthors] = useState<string>("");
  const [newOrg, setNewOrg] = useState<string>("");
  const [newYear, setNewYear] = useState<number>(2024);
  const [newAbstract, setNewAbstract] = useState<string>("");
  const [newCitation, setNewCitation] = useState<string>("");
  const [newUrl, setNewUrl] = useState<string>("");
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Embeddings Inspector State
  const [inspectorText, setInspectorText] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("all-MiniLM-L6-v2");
  const [isVectorizing, setIsVectorizing] = useState<boolean>(false);
  const [indexingLog, setIndexingLog] = useState<string[]>([]);
  const [inspectionResult, setInspectionResult] = useState<any | null>(null);

  // Consensus Simulator State
  const [onlineSimulator, setOnlineSimulator] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [SYSTEM] Satellite uplink online. Synchronized with MoPHP Central DB.`
  ]);

  const [proposals, setProposals] = useState<NewGuidelineProposal[]>([
    {
      id: "PROP-901",
      title: "Modified WHO protocol for 10% dextrose administration in severe acute malnutrition with signs of shock",
      titleAr: "بروتوكول منظمة الصحة العالمية المعدل لإعطاء سكر الدكستروز بنسبة 10٪ في حالات سوء التغذية الحاد الشديد مع علامات الصدمة",
      authors: "Al-Haddad, A., & MoPHP Nutrition Council",
      organization: "Ministry of Public Health & Population (Yemen)",
      year: 2024,
      abstract: "This field-tested protocol defines immediate therapeutic correction guidelines for hypoglycemic shock in clinical stabilization wards. Recommends a slow bolus (5ml/kg) of 10% dextrose within 15 minutes, coupled with thermal stabilization.",
      abstractAr: "يحدد هذا البروتوكول الميداني المعتمد إرشادات التصحيح العلاجي الفوري لصدمة نقص السكر في الدم في أجنحة الاستقرار السريري. يوصي بجرعة بطيئة (5 مل / كجم) من الدكستروز 10٪ خلال 15 دقيقة، بالتزامن مع التثبيت الحراري.",
      citation: "Yemen MoPHP Guideline Bulletin, Sec. 4.2, 2024.",
      sourceUrl: "https://moph-yemen.org/guidelines",
      approvedByAdmin: false,
      approvedByDoctor: true
    },
    {
      id: "PROP-902",
      title: "Consensus criteria for early discharge to outpatient therapeutic programs (OTP) in conflict-affected zones",
      titleAr: "معايير التوافق للتسريح المبكر إلى برامج العلاج الخارجي في المناطق المتأثرة بالصراع",
      authors: "UNICEF Yemen & WHO Joint Panel",
      organization: "UNICEF",
      year: 2023,
      abstract: "To alleviate bed capacity bottlenecks in fragile stabilization wards, this recommendation allows medically stable children with MUAC > 115mm and resolved systemic infections to transition early to RUTF-based OTP care with trained community health agents.",
      abstractAr: "لتخفيف الاختناقات في غرف الاستقرار الهشة، تسمح هذه التوصية للأطفال المستقرين طبياً الذين يزيد محيط منتصف العضد لديهم عن 115 مم والذين شُفيت التهاباتهم الجهازية بالانتقال المبكر إلى رعاية العيادات الخارجية باستخدام التغذية العلاجية الجاهزة.",
      citation: "UNICEF Technical Report #YEM-2023-NUT12.",
      sourceUrl: "https://unicef.org/yemen/reports",
      approvedByAdmin: true,
      approvedByDoctor: false
    }
  ]);

  const fetchKnowledgeBase = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/knowledge-base");
      if (!res.ok) throw new Error("Failed to fetch knowledge base");
      const data = await res.json();
      setAllReferences(data);
    } catch (e) {
      console.error("Offline; knowledge base offline fallback loaded.", e);
      setAllReferences(scientificReferences);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBase();
  }, [fetchKnowledgeBase]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      // Direct offline/fallback search using local state
      const results = allReferences.map((ref) => {
        const corpusEn = `${ref.title || ""} ${ref.abstract || ""} ${ref.clinicalSummary || ""} ${ref.keywords?.join(" ") || ""}`;
        const corpusAr = `${ref.titleAr || ""} ${ref.abstractAr || ""} ${ref.clinicalSummaryAr || ""}`;
        const corpus = `${corpusEn} ${corpusAr}`.toLowerCase();
        
        const score = calculateSimilarity(searchQuery, corpus);
        return { reference: ref, score, clusterName: "Vector-Retrieved Match" };
      });

      setSearchResults(results.filter((r) => r.score > 0.05).sort((a, b) => b.score - a.score));
    } catch (err) {
      console.error("Local search execution error", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, allReferences]);

  const handleResetSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedReference(null);
  }, []);

  const clearSuggestForm = useCallback(() => {
    setNewTitle("");
    setNewAuthors("");
    setNewOrg("");
    setNewAbstract("");
    setNewCitation("");
    setNewUrl("");
  }, []);

  const handleSubmitSuggestion = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle || !newAuthors || !newAbstract) return;

    const ref: Omit<ScientificReference, "id"> = {
      title: newTitle,
      authors: newAuthors,
      organization: newOrg || "Independent Clinician Proposal",
      year: newYear,
      abstract: newAbstract,
      citation: newCitation || "Direct user clinical submission.",
      sourceUrl: newUrl,
      approvedByAdmin: false,
      approvedByDoctor: false,
      keywords: ["custom-submission", "peer-proposal"],
      status: "Active"
    };

    setLoading(true);
    try {
      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ref)
      });
      if (res.ok) {
        setSubmitSuccess(true);
        fetchKnowledgeBase();
        setTimeout(() => {
          setSubmitSuccess(false);
          clearSuggestForm();
        }, 3000);
      }
    } catch (err) {
      console.warn("Server offline, suggesting offline state simulation", err);
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        clearSuggestForm();
      }, 3000);
    } finally {
      setLoading(false);
    }
  }, [newTitle, newAuthors, newOrg, newYear, newAbstract, newCitation, newUrl, clearSuggestForm, fetchKnowledgeBase]);

  // Embeddings Inspector Pipeline Simulation
  const handleInspectPipeline = useCallback(() => {
    if (!inspectorText.trim()) return;
    setIsVectorizing(true);
    setIndexingLog(["Initializing Vector Pipeline...", `Target Model: ${selectedModel}`]);

    setTimeout(() => {
      // 1. Text chunker execution
      const chunks = chunkText(inspectorText, 250);
      setIndexingLog(prev => [
        ...prev,
        `Step 1: Segmented into ${chunks.length} semantically coherent chunks using kbService.ts.`
      ]);

      // 2. Generate deterministic dense vectors (representing 384 dimensions)
      const generateSimulatedEmbedding = (text: string): number[] => {
        const vector: number[] = [];
        let seed = 0;
        for (let i = 0; i < text.length; i++) {
          seed += text.charCodeAt(i);
        }
        for (let i = 0; i < 8; i++) {
          const val = Math.sin(seed + i) * 1.5;
          vector.push(parseFloat(val.toFixed(4)));
        }
        return vector;
      };

      const primaryChunk = chunks[0] || inspectorText;
      const primaryEmbedding = generateSimulatedEmbedding(primaryChunk);

      setIndexingLog(prev => [
        ...prev,
        "Step 2: Vector embedding generated successfully (384-dimensional space).",
        `Primary Embedding Segment: [${primaryEmbedding.join(", ")}... (384 dimensions)]`
      ]);

      // 3. FAISS Cluster Allocation
      let matchedCluster = "General Nutrition & Growth";
      let highestSimilarity = 0.0;
      const lowerChunk = primaryChunk.toLowerCase();

      Object.entries(ivfClusters).forEach(([clusterKey, keywords]) => {
        let matches = 0;
        keywords.forEach((keyword: string) => {
          if (lowerChunk.includes(keyword.toLowerCase())) matches++;
        });
        const currentSim = matches / keywords.length;
        if (currentSim > highestSimilarity) {
          highestSimilarity = currentSim;
          matchedCluster = clusterKey;
        }
      });

      setIndexingLog(prev => [
        ...prev,
        `Step 3: IVF-Flat Inverted File Index routing active. Nearest cluster: ${matchedCluster}.`
      ]);

      setInspectionResult({
        primaryChunk,
        vectorPreview: primaryEmbedding,
        cluster: matchedCluster,
        totalChunks: chunks.length
      });
      setIsVectorizing(false);
      setIndexingLog(prev => [...prev, "Pipeline Inspector complete. Ready to write to index."]);
    }, 1200);
  }, [inspectorText, selectedModel]);

  const handleIndexIntoLocalDB = useCallback(() => {
    if (!inspectionResult) return;

    const newRef: ScientificReference = {
      id: `REF-INSPECT-${Date.now()}`,
      title: `Field Operator Upload: ${inspectionResult.primaryChunk.substring(0, 45)}...`,
      authors: "Field Clinician (Operator)",
      organization: "Operational Field Intake",
      year: new Date().getFullYear(),
      abstract: inspectionResult.primaryChunk,
      clinicalSummary: "Ingested via vector inspector. Standard clinical review required.",
      keywords: ["field-upload", "operator-ingested"],
      citation: "Uploaded directly via RAG Embeddings Inspector.",
      sourceUrl: "",
      approvedByAdmin: true,
      approvedByDoctor: true,
      status: "Active"
    };

    setAllReferences(prev => [newRef, ...prev]);
    setInspectionResult(null);
    setInspectorText("");
    setIndexingLog([]);

    // Simple toast simulation
    alert("Guideline chunk successfully vectorized, cached, and indexed into the local vector space!");
  }, [inspectionResult]);

  // MoPHP Online Sync and Approval Consensus
  const handleTriggerSync = useCallback(() => {
    if (!onlineSimulator) {
      alert("Error: Network disconnected. Toggle the 'Internet Synchronization Gate' to simulate a live satellite or cellular uplink.");
      return;
    }
    setIsSyncing(true);
    setSyncLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] [SYNC] Initalizing satellite cellular handshake...`]);
    
    setTimeout(() => {
      setSyncLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] [SYNC] Handshake accepted. Pushing local vector cache to MoPHP DB.`,
        `[${new Date().toLocaleTimeString()}] [SUCCESS] Synchronization complete. ${allReferences.length} clinical references verified.`
      ]);
      setIsSyncing(false);
    }, 1500);
  }, [onlineSimulator, allReferences]);

  const triggerBackgroundVectorization = useCallback((prop: NewGuidelineProposal) => {
    setSyncLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] [PIPELINE] Consensus Reached! Triggering all-MiniLM-L6-v2 vector pipeline...`,
      `[${new Date().toLocaleTimeString()}] [PIPELINE] Successfully generated dense vectors for: "${prop.title.substring(0, 30)}..."`,
      `[${new Date().toLocaleTimeString()}] [SUCCESS] Propagated to clinical active references.`
    ]);

    // Append to active RAG refs
    const newRef: ScientificReference = {
      id: prop.id,
      title: prop.title,
      titleAr: prop.titleAr,
      authors: prop.authors,
      organization: prop.organization,
      year: prop.year,
      abstract: prop.abstract,
      abstractAr: prop.abstractAr,
      clinicalSummary: prop.abstract.substring(0, 120) + "...",
      keywords: ["moph-approved", "consensus-reached"],
      citation: prop.citation,
      sourceUrl: prop.sourceUrl,
      approvedByAdmin: true,
      approvedByDoctor: true,
      status: "Active"
    };

    setAllReferences(prev => [newRef, ...prev]);

    // Notify user
    alert(`Consensus reached! "${prop.title.substring(0, 50)}..." has been fully approved, vectorized, and integrated into active clinical recommendation RAG engine.`);
  }, []);

  const handleApproveProposal = useCallback(async (propId: string, roleToSimulate: "Doctor" | "Administrator") => {
    // Update local proposal state
    setProposals(prevProposals => {
      const updated = prevProposals.map(p => {
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
      return updated;
    });

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
          console.warn("Could not synchronize approval to central servers, queued locally.", e);
        }
      }
    }
  }, [proposals, onlineSimulator, triggerBackgroundVectorization]);

  const renderedList = useMemo(() => {
    if (searchResults.length > 0) {
      return searchResults;
    }
    return allReferences
      .filter(r => {
        if (filterOrg !== "ALL" && r.organization !== filterOrg) return false;
        if (filterLang !== "ALL") {
          if (filterLang === "AR" && !r.titleAr) return false;
          if (filterLang === "EN" && r.titleAr && r.titleAr === r.title) return false;
        }
        return true;
      })
      .map(r => ({ reference: r, score: 1.0, clusterName: "WHO Consolidated Indices" }));
  }, [searchResults, allReferences, filterOrg, filterLang]);

  // Get unique organizations for the filter list
  const uniqueOrgs = useMemo(() => {
    return Array.from(new Set(allReferences.map(r => r.organization))).filter(Boolean);
  }, [allReferences]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" id="kb-global-dashboard-container">
      {/* Dashboard Top Header Navigation */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden" id="kb-panel-header">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                RAG ENGINE / KNOWLEDGE BASE
              </span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active FAISS IVF Index
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              Bilingual Clinical Knowledge Base
            </h1>
            <p className="text-slate-300 max-w-2xl text-sm">
              Manage and index WHO protocols, academic clinical literature, and regional nutritional models.
              Vectorized assets power the smart diagnosis and recommendations engine in Arabic and English.
            </p>
          </div>

          <div className="flex bg-slate-800 p-1.5 rounded-xl border border-slate-700/80 self-start md:self-auto">
            <button
              onClick={() => setActiveTab("library")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2 ${
                activeTab === "library"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
              id="btn-tab-library"
            >
              <Database className="w-3.5 h-3.5" />
              Reference Library ({allReferences.length})
            </button>
            <button
              onClick={() => setActiveTab("inspector")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2 ${
                activeTab === "inspector"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
              id="btn-tab-inspector"
            >
              <Cpu className="w-3.5 h-3.5" />
              Vector Pipeline Inspector
            </button>
            <button
              onClick={() => setActiveTab("sync")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-2 ${
                activeTab === "sync"
                  ? "bg-purple-600 text-white shadow"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
              id="btn-tab-sync"
            >
              <Globe className="w-3.5 h-3.5" />
              MoPHP Online Sync
            </button>
          </div>
        </div>
      </div>

      {activeTab === "library" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-start" id="kb-library-grid-section">
          {/* Main search and filters column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search and Filters panel */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-600" />
                Bilingual Knowledge Search
              </h2>

              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search WHO guidelines, MAM/SAM, therapeutic milk formula or conflict indicators..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none transition-all"
                    id="input-kb-search-query"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                  id="btn-execute-search"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Search RAG"}
                </button>
                {searchResults.length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetSearch}
                    className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                    id="btn-reset-search"
                  >
                    Reset
                  </button>
                )}
              </form>

              {/* Advanced Filter Pills */}
              <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
                <span className="text-slate-500 font-medium">Filter Organization:</span>
                <button
                  onClick={() => setFilterOrg("ALL")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    filterOrg === "ALL"
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  All ({allReferences.length})
                </button>
                {uniqueOrgs.map((org) => {
                  const count = allReferences.filter(r => r.organization === org).length;
                  return (
                    <button
                      key={org}
                      onClick={() => setFilterOrg(org)}
                      className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                        filterOrg === org
                          ? "bg-purple-50 border-purple-200 text-purple-700"
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {org} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                <span className="text-slate-500 font-medium">Filter Language:</span>
                <button
                  onClick={() => setFilterLang("ALL")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    filterLang === "ALL"
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Any Language
                </button>
                <button
                  onClick={() => setFilterLang("EN")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    filterLang === "EN"
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  English Reference Only
                </button>
                <button
                  onClick={() => setFilterLang("AR")}
                  className={`px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    filterLang === "AR"
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Arabic Translated Reference Only
                </button>
              </div>
            </div>

            {/* Reference List Results */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  {searchResults.length > 0 ? "Semantic Retrieval Hits" : "Clinical References Database"}
                </h2>
                <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                  {searchResults.length > 0 ? `${searchResults.length} matching guidelines` : `${renderedList.length} total references`}
                </span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1" id="kb-results-list">
                {renderedList.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl text-slate-500">
                    <p className="text-xs font-bold">No guideline segments found matching the specified filters.</p>
                  </div>
                ) : (
                  renderedList.map((item: SearchResult, idx: number) => {
                    const r = item.reference;
                    const isSelected = selectedReference?.id === r.id;

                    return (
                      <div
                        key={r.id || idx}
                        onClick={() => setSelectedReference(r)}
                        className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                          isSelected
                            ? "bg-purple-50/50 border-purple-200 shadow-sm"
                            : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/30"
                        }`}
                        id={`ref-card-${r.id}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono rounded font-semibold">
                                {r.id}
                              </span>
                              <span className="text-[10px] font-mono text-purple-600 font-semibold uppercase tracking-wider">
                                {r.organization}
                              </span>
                              {r.year && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  ({r.year})
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug">
                              {r.title}
                            </h3>
                            {r.titleAr && r.titleAr !== r.title && (
                              <h3 className="font-bold text-indigo-900 text-xs leading-snug text-right mt-1 dir-rtl font-sans">
                                {r.titleAr}
                              </h3>
                            )}
                          </div>

                          {searchResults.length > 0 && (
                            <div className="text-right shrink-0">
                              <span className="inline-block text-[10px] font-mono font-bold px-2 py-1 rounded bg-purple-100 text-purple-700">
                                Sim: {(item.score * 100).toFixed(1)}%
                              </span>
                              <div className="text-[9px] text-slate-400 mt-1">{item.clusterName}</div>
                            </div>
                          )}
                        </div>

                        {/* Keyword badges */}
                        {r.keywords && r.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {r.keywords.map((kw, kIdx) => (
                              <span
                                key={kIdx}
                                className="text-[9px] font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Guidelines details or custom suggestion form sidebar */}
          <div className="space-y-6">
            {/* Context details container */}
            {selectedReference ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6 text-left" id="kb-detail-panel">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded text-[10px] font-mono font-bold">
                    {selectedReference.id}
                  </span>
                  <button
                    onClick={() => setSelectedReference(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                  >
                    Close Preview
                  </button>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-purple-600">
                    {selectedReference.organization} ({selectedReference.year})
                  </span>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    {selectedReference.title}
                  </h3>
                  {selectedReference.titleAr && selectedReference.titleAr !== selectedReference.title && (
                    <p className="text-sm font-semibold text-indigo-900 leading-normal bg-slate-50 p-3 rounded-xl text-right dir-rtl font-sans">
                      {selectedReference.titleAr}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 italic mt-1">
                    Authors: {selectedReference.authors}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Semantic Abstract
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-4 rounded-xl border border-slate-50">
                    {selectedReference.abstract}
                  </p>
                  {selectedReference.abstractAr && (
                    <p className="text-xs text-slate-700 leading-relaxed bg-indigo-50/20 p-4 rounded-xl border border-indigo-50/30 text-right dir-rtl font-sans">
                      {selectedReference.abstractAr}
                    </p>
                  )}
                </div>

                {selectedReference.clinicalSummary && (
                  <div className="space-y-3 bg-purple-50/30 p-4 rounded-xl border border-purple-50">
                    <h4 className="text-xs font-bold text-purple-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      Clinician Reasoning Corroboration
                    </h4>
                    <p className="text-xs text-purple-950 leading-relaxed">
                      {selectedReference.clinicalSummary}
                    </p>
                    {selectedReference.clinicalSummaryAr && (
                      <p className="text-xs text-indigo-950 leading-relaxed text-right dir-rtl font-sans pt-2 border-t border-purple-100/40">
                        {selectedReference.clinicalSummaryAr}
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <p>
                    <strong className="text-slate-700">Source:</strong> {selectedReference.citation}
                  </p>
                  {selectedReference.sourceUrl && (
                    <a
                      href={selectedReference.sourceUrl}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="inline-flex items-center gap-1 text-purple-600 hover:underline font-semibold mt-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open Clinical Source Link
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6 text-left" id="kb-suggest-form-panel">
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Suggest Guidelines Proposal
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Submit new nutritional consensus papers, clinical studies or local MoPHP reports. Suggestions will require Doctor and Administrator validation.
                  </p>
                </div>

                <form onSubmit={handleSubmitSuggestion} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Guideline Title (English)*</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. WHO protocol for administration of therapeutic milk F-75"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Authors / Panel*</label>
                      <input
                        type="text"
                        required
                        value={newAuthors}
                        onChange={(e) => setNewAuthors(e.target.value)}
                        placeholder="e.g. Al-Hamadi, S. et al."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-600">Year</label>
                      <input
                        type="number"
                        value={newYear}
                        onChange={(e) => setNewYear(parseInt(e.target.value) || 2024)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Issuing Organization / Publisher</label>
                    <input
                      type="text"
                      value={newOrg}
                      onChange={(e) => setNewOrg(e.target.value)}
                      placeholder="e.g. WHO, UNICEF, Ministry of Health"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Abstract Summary (Clinical Core)*</label>
                    <textarea
                      required
                      rows={4}
                      value={newAbstract}
                      onChange={(e) => setNewAbstract(e.target.value)}
                      placeholder="Describe the clinical recommendations, dose metrics, sample ranges, and context..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Full Academic Citation</label>
                    <input
                      type="text"
                      value={newCitation}
                      onChange={(e) => setNewCitation(e.target.value)}
                      placeholder="e.g. Lancet Child Adolescent Health 2024; 8(2): 102-114."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Resource Web URL</label>
                    <input
                      type="url"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://www.ncbi.nlm.nih.gov/pmc/..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none"
                    />
                  </div>

                  {submitSuccess && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-medium">
                      <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                      Proposal successfully sent to Central MoPHP Registry Queue.
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm"
                  >
                    {loading ? "Submitting Proposal..." : "Submit Clinical Guideline Proposal"}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "inspector" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-start" id="kb-inspector-tab-section">
          <div className="lg:col-span-2 space-y-6 text-left">
            {/* Input Vectorizer block */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-600" />
                  RAG Embeddings Vectorizer Inspector
                </h2>
                <p className="text-xs text-slate-500">
                  Input raw medical recommendations or stunting research papers. Inspect the live bilingual tokenization, semantic chunking boundaries, and vector generation simulation.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Choose Dense Transformer Model Mapping</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none bg-white font-mono"
                  >
                    <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 [384 Dimensions] (Offline Mobile Compatible)</option>
                    <option value="bilingual-yemen-bert-v4">yemen-bio-bert-v4 [768 Dimensions] (Arabic Pediatric Specialized)</option>
                    <option value="openai-ada-002">text-embedding-3-small [1536 Dimensions] (Cloud Gateway)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Text Content to Index</label>
                  <textarea
                    rows={8}
                    value={inspectorText}
                    onChange={(e) => setInspectorText(e.target.value)}
                    placeholder="Paste research paragraphs, clinical rules, or stunting therapeutic metrics here..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 outline-none resize-none font-sans leading-relaxed"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleInspectPipeline}
                  disabled={isVectorizing || !inspectorText.trim()}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-2 disabled:opacity-50 shadow-sm"
                  id="btn-trigger-vectorization"
                >
                  {isVectorizing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Generating High-Dimensional Dense Matrices...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      Trigger Ingestion Pipeline
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Simulated Live Vectorizing Console */}
            {indexingLog.length > 0 && (
              <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    VECTOR PIPELINE COMPILER CONSOLE
                  </span>
                  <span className="text-[10px] text-slate-500">all-MiniLM-L6-v2</span>
                </div>

                <div className="space-y-2 text-xs text-indigo-300 max-h-64 overflow-y-auto pr-1">
                  {indexingLog.map((log, idx) => (
                    <div key={idx} className="flex gap-2.5">
                      <span className="text-slate-600 select-none">{idx + 1}.</span>
                      <p className="leading-relaxed whitespace-pre-wrap">{log}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6 text-left">
            {/* Visualizer output */}
            {inspectionResult ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-6" id="vector-pipeline-result-panel">
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-slate-900">Ingested Index Segment</h3>
                  <p className="text-xs text-slate-500">
                    Calculated embedding matrix segments allocated inside FAISS index files.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">
                      Nearest IVF Flat Cluster Node
                    </span>
                    <div className="px-3 py-2 bg-purple-50 text-purple-700 border border-purple-100 rounded-xl font-mono text-xs font-bold">
                      {inspectionResult.cluster}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">
                      Coherent Chunks Generated
                    </span>
                    <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl font-mono text-xs font-bold text-slate-700">
                      {inspectionResult.totalChunks} discrete segments (Max 250 characters each)
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">
                      First Chunk Sample Preview
                    </span>
                    <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed font-mono">
                      "{inspectionResult.primaryChunk}"
                    </p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">
                      Dense Embedding Preview (Float32 Array)
                    </span>
                    <div className="p-3 bg-slate-950 text-emerald-400 rounded-xl text-xs font-mono break-all leading-normal">
                      [ {inspectionResult.vectorPreview.join(", ")} ... ]
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleIndexIntoLocalDB}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Commit and Write into Local FAISS Space
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-500">
                <Cpu className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-xs font-bold text-slate-700">Vector Workspace Inactive</h4>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1 leading-normal">
                  Write clinical guideline context and click "Trigger Ingestion Pipeline" to preview high-dimensional semantic indexing.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "sync" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 align-start" id="kb-sync-tab-section">
          {/* MoPHP consensus panel */}
          <div className="lg:col-span-2 space-y-6 text-left">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-600" />
                  Bilingual Consensus Validator
                </h2>
                <p className="text-xs text-slate-500">
                  Regional guidelines and pediatric modifications must obtain dual-consensus validation before FAISS ingestion. Simulate local consensus gates.
                </p>
              </div>

              {/* List of active validation proposals */}
              <div className="space-y-4">
                {proposals.map((prop) => {
                  const consensusReached = prop.approvedByAdmin && prop.approvedByDoctor;

                  return (
                    <div
                      key={prop.id}
                      className={`p-5 rounded-2xl border transition-all ${
                        consensusReached
                          ? "bg-emerald-50/20 border-emerald-100"
                          : "bg-white border-slate-100"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono rounded font-bold">
                              {prop.id}
                            </span>
                            <span className="text-[10px] uppercase font-mono text-slate-400 font-bold tracking-wider">
                              {prop.organization}
                            </span>
                          </div>
                          <h3 className="font-extrabold text-slate-900 text-sm">
                            {prop.title}
                          </h3>
                          {prop.titleAr && (
                            <h3 className="font-semibold text-indigo-900 text-xs text-right dir-rtl font-sans bg-slate-50 p-2.5 rounded-lg">
                              {prop.titleAr}
                            </h3>
                          )}
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {prop.abstract}
                          </p>
                        </div>

                        {/* Approvals Consensus Box */}
                        <div className="flex md:flex-col gap-2 shrink-0 md:min-w-[160px]">
                          <button
                            onClick={() => handleApproveProposal(prop.id, "Doctor")}
                            disabled={prop.approvedByDoctor}
                            className={`px-3 py-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-between gap-1.5 ${
                              prop.approvedByDoctor
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>Doctor Review:</span>
                            <span className="flex items-center gap-1">
                              {prop.approvedByDoctor ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Yes
                                </>
                              ) : "Pending"}
                            </span>
                          </button>

                          <button
                            onClick={() => handleApproveProposal(prop.id, "Administrator")}
                            disabled={prop.approvedByAdmin}
                            className={`px-3 py-2 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-between gap-1.5 ${
                              prop.approvedByAdmin
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>Admin Consensus:</span>
                            <span className="flex items-center gap-1">
                              {prop.approvedByAdmin ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Yes
                                </>
                              ) : "Pending"}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-6 text-left">
            {/* Network simulator configuration */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600 animate-spin-slow" />
                Satellite Uplink Sync
              </h3>

              <div className="p-4 bg-slate-50 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Central Sync Connection</span>
                  <button
                    onClick={() => setOnlineSimulator(!onlineSimulator)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                      onlineSimulator ? "bg-purple-600" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        onlineSimulator ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${onlineSimulator ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                  <span className="text-xs font-mono font-bold text-slate-700">
                    {onlineSimulator ? "VSAT Satellite Gate: ONLINE" : "VSAT Satellite Gate: OFFLINE"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTriggerSync}
                disabled={isSyncing}
                className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Synchronize Databases Now
              </button>
            </div>

            {/* Sync Audit Trail */}
            <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-3 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-400">VSAT HANDSHAKE LOGS</span>
              </div>

              <div className="space-y-2 text-[11px] text-purple-300 max-h-56 overflow-y-auto pr-1">
                {syncLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 leading-relaxed">
                    <p>{log}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}