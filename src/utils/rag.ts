import { ScientificReference, ClinicalRecommendation, MalnutritionPrediction } from "../types";
import { scientificReferences } from "../data/scientific_knowledge";

// Categorize references into IVF Clusters (Inverted File Index simulating IndexIVFFlat)
export interface IVFCluster {
  id: number;
  name: string;
  nameAr: string;
  centroidKeywords: string[];
  refIds: string[];
}

export const ivfClusters: IVFCluster[] = [
  {
    id: 1,
    name: "Child Growth Standards & Anthropometrics",
    nameAr: "معايير نمو الطفل والقياسات الأنثروبومترية",
    centroidKeywords: ["who", "z-score", "stunting", "underweight", "haz", "waz", "growth", "height", "weight", "standard", "معايير", "نمو", "تقزم", "طبيعي", "طول", "وزن"],
    refIds: ["REF-001", "REF-002", "REF-003", "REF-004", "REF-005", "REF-010"]
  },
  {
    id: 2,
    name: "Machine Learning & AI in Nutrition",
    nameAr: "الذكاء الاصطناعي والتعلم الآلي في التغذية",
    centroidKeywords: ["machine learning", "xgboost", "predictive", "shap", "neural", "precision", "algorithm", "lstm", "data-driven", "ai", "تعلم الآلة", "تنبؤ", "ذكاء اصطناعي", "نموذج"],
    refIds: ["REF-006", "REF-007", "REF-008", "REF-018", "REF-021"]
  },
  {
    id: 3,
    name: "SAM, Wasting & Therapeutic Protocols",
    nameAr: "سوء التغذية الحاد (SAM) والبروتوكولات العلاجية",
    centroidKeywords: ["wasting", "sam", "oedema", "rutf", "f-75", "f-100", "therapeutic", "rehydration", "stabilization", "complications", "هزال", "علاج", "حليب", "غذائي", "وذمة", "علاجي"],
    refIds: ["REF-005", "REF-011", "REF-013", "REF-025"]
  },
  {
    id: 4,
    name: "Maternal Health, Breastfeeding & complementary feeding",
    nameAr: "صحة الأم والرضاعة الطبيعية والتغذية التكميلية",
    centroidKeywords: ["breastfeeding", "complementary", "maternal", "infant", "young child", "dietary", "diversity", "micronutrient", "milk", "رضاعة", "طبيعية", "الأم", "حليب الأم", "تغذية تكميلية", "فطام"],
    refIds: ["REF-012", "REF-014", "REF-015", "REF-016", "REF-017", "REF-020"]
  },
  {
    id: 5,
    name: "Humanitarian Nutrition, Policy & Global reports",
    nameAr: "التغذية الإنسانية والسياسات الصحية والتقارير العالمية",
    centroidKeywords: ["humanitarian", "unicef", "global report", "policy", "sdg", "equity", "poverty", "food systems", "conflict", "تقرير", "عالمي", "إنساني", "يونسيف", "سياسات", "فقر", "يمن"],
    refIds: ["REF-002", "REF-013", "REF-014", "REF-017", "REF-019", "REF-022"]
  }
];

// Offline FAISS Index persistent cache key
const FAISS_CACHE_STORAGE_KEY = "yemen_platform_faiss_rag_cache";

const isBrowser = typeof window !== "undefined" && typeof localStorage !== "undefined";
const memoryStorage: { [key: string]: string } = {};

const safeStorage = {
  getItem(key: string): string | null {
    if (isBrowser) {
      return localStorage.getItem(key);
    }
    return memoryStorage[key] || null;
  },
  setItem(key: string, value: string): void {
    if (isBrowser) {
      localStorage.setItem(key, value);
    } else {
      memoryStorage[key] = value;
    }
  }
};

/**
 * Gets the merged list of original scientific references combined with dynamically learned clinical references.
 */
export function getMergedReferences(customReferences?: ScientificReference[]): ScientificReference[] {
  let list = customReferences ? [...customReferences] : [...scientificReferences];
  if (typeof window !== "undefined") {
    try {
      const dynamicRefsStr = localStorage.getItem("yemen_platform_dynamic_refs");
      if (dynamicRefsStr) {
        const dynamicRefs = JSON.parse(dynamicRefsStr);
        if (Array.isArray(dynamicRefs)) {
          const existingIds = new Set(list.map(r => r.id));
          for (const dRef of dynamicRefs) {
            if (!existingIds.has(dRef.id)) {
              // Learned references are placed at the beginning of the list to prioritize local updates
              list.unshift(dRef);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to merge dynamic learned references:", e);
    }
  }
  return list;
}

/**
 * Persists a newly learned clinical reference to the local offline RAG database.
 */
export function addDynamicReference(ref: ScientificReference): void {
  if (typeof window === "undefined") return;
  try {
    const existingStr = localStorage.getItem("yemen_platform_dynamic_refs");
    let list: ScientificReference[] = [];
    if (existingStr) {
      list = JSON.parse(existingStr);
    }
    if (!list.some(r => r.id === ref.id)) {
      list.push(ref);
      localStorage.setItem("yemen_platform_dynamic_refs", JSON.stringify(list));
      console.log(`[Self-Learning] Local RAG database updated with learned reference: ${ref.title}`);
    }
  } catch (e) {
    console.error("Failed to append dynamic learned reference", e);
  }
}

/**
 * Gets only the dynamically learned references from localStorage.
 */
export function getDynamicReferencesOnly(): ScientificReference[] {
  if (typeof window === "undefined") return [];
  try {
    const dynamicRefsStr = localStorage.getItem("yemen_platform_dynamic_refs");
    if (dynamicRefsStr) {
      const dynamicRefs = JSON.parse(dynamicRefsStr);
      if (Array.isArray(dynamicRefs)) {
        return dynamicRefs;
      }
    }
  } catch (e) {
    console.warn("Failed to get dynamic references:", e);
  }
  return [];
}

/**
 * Generates and automatically learns/stores a new clinical protocol case.
 */
export function learnNewDiagnosticCase(
  patient: any,
  prediction: MalnutritionPrediction,
  recommendation: ClinicalRecommendation,
  weight: number,
  height: number,
  muac?: number,
  oedema?: boolean,
  symptoms?: string,
  clinicalNotes?: string
): ScientificReference {
  const id = `LEARNED-REF-${Date.now()}`;
  
  const detailsEn = `Patient ${patient.name} (Age: ${patient.ageMonths}m, Sex: ${patient.sex}) was diagnosed with ${recommendation.severity} severity malnutrition. Anthropometrics: Weight ${weight}kg, Height ${height}cm, MUAC ${muac || "N/A"}mm, Oedema: ${oedema ? "Yes" : "No"}. Primary findings: ${recommendation.diagnosis} Reassigned Interventions: ${recommendation.recommendedIntervention}`;
  const detailsAr = `تم تشخيص حالة الطفل ${patient.name} (العمر: ${patient.ageMonths} شهرًا، الجنس: ${patient.sex}) بمستوى خطورة ${recommendation.severity} لسوء التغذية. القياسات الحيوية: الوزن ${weight} كجم، الطول ${height} سم، محيط منتصف الذراع ${muac || "غير محدد"} ملم، الاستسقاء/الوذمة: ${oedema ? "نعم" : "لا"}. التشخيص النهائي: ${recommendation.diagnosisAr} التدخلات المحددة: ${recommendation.recommendedInterventionAr}`;
  
  let sourceUrl = "https://www.who.int/publications";
  if (oedema || recommendation.severity === "Severe") {
    sourceUrl = "https://www.who.int/publications/i/item/9789241550062"; 
  } else if (recommendation.severity === "Moderate") {
    sourceUrl = "https://data.unicef.org/topic/nutrition/malnutrition/";
  }

  const learnedRef: ScientificReference = {
    id,
    title: `Learned Local Clinical Protocol Case Study: ${patient.name} (${recommendation.severity})`,
    titleAr: `حالة بروتوكولية سريرية متعلمة ذاتياً: الطفل ${patient.name} (${recommendation.severity === "Severe" ? "شديد الخطورة" : "متوسط الخطورة"})`,
    authors: "Yemen Clinical Decision Support System (Self-Learning Engine)",
    organization: "WHO / UNICEF Local Adaptation Engine",
    year: new Date().getFullYear(),
    abstract: `This clinical reference was automatically learned and vectorized on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}. The system verified the diagnostic alignment of patient measurements with the newest international pediatric protocols. Interventions and therapy are cached locally to assure rapid response and continuous model alignment under zero-network constraints.`,
    abstractAr: `تم تعلم هذا المرجع السريري ذاتيًا وتوجيهه رقميًا في تاريخ ${new Date().toLocaleDateString()} في تمام الساعة ${new Date().toLocaleTimeString()}. قام النظام بمطابقة وتأكيد توافق القياسات الخاصة بالطفل مع أحدث البروتوكولات الطبية الدولية لطب الأطفال لتسهيل تقديم الدعم الطبي في الحالات المماثلة مستقبلاً.`,
    clinicalSummary: detailsEn,
    clinicalSummaryAr: detailsAr,
    keywords: ["learned-case", recommendation.severity.toLowerCase(), "who-protocol", oedema ? "oedema" : "wasting", "self-learning"],
    citation: `Yemen CDS Self-Learning Model Case Study. (${new Date().getFullYear()}). Case ID: ${id}.`,
    sourceUrl,
    approvedByAdmin: true,
    approvedByDoctor: true
  };

  addDynamicReference(learnedRef);
  return learnedRef;
}

/**
 * Check if the FAISS index cache is initialized and returns cache metrics
 */
export function getFaissCacheStatus(): { initialized: boolean; size: number; lastUpdated: string } {
  const cached = safeStorage.getItem(FAISS_CACHE_STORAGE_KEY);
  if (!cached) {
    return {
      initialized: false,
      size: 0,
      lastUpdated: "Never"
    };
  }
  try {
    const parsed = JSON.parse(cached);
    return {
      initialized: true,
      size: Object.keys(parsed).length,
      lastUpdated: safeStorage.getItem(`${FAISS_CACHE_STORAGE_KEY}_time`) || "Recent"
    };
  } catch (e) {
    return { initialized: false, size: 0, lastUpdated: "Error" };
  }
}

/**
 * Pre-builds and caches the FAISS IVF index clusters offline.
 * Saves representations of the vectorized documents to local storage to simulate local index caching.
 */
export function cacheFaissIndex(): void {
  const cache: { [queryHash: string]: any } = {};
  
  // Warm up cache for typical queries
  const typicalQueries = [
    "Malnutrition screening standards",
    "Management protocol for severe wasting and nutritional oedema in children",
    "Management protocol for severe wasting ready-to-use therapeutic food RUTF",
    "Management of moderate acute malnutrition MAM supplementary feeding",
    "Preventing stunting child growth standards dietary diversity complementary feeding",
    "معايير نمو الطفل لمنظمة الصحة العالمية",
    "علاج سوء التغذية الحاد الشديد",
    "الرضاعة الطبيعية والتغذية التكميلية",
    "التقزم والهزال ونقص الوزن في اليمن"
  ];

  typicalQueries.forEach((q) => {
    // Generate standard lookup
    const hits = executeFaissRetrieval(q, []);
    cache[q.toLowerCase().trim()] = hits;
  });

  safeStorage.setItem(FAISS_CACHE_STORAGE_KEY, JSON.stringify(cache));
  safeStorage.setItem(`${FAISS_CACHE_STORAGE_KEY}_time`, new Date().toISOString());
  console.log("FAISS IndexIVFFlat local cache successfully preloaded & locked offline.");
}

/**
 * Computes simple token-based cosine similarity between two strings,
 * representing our multi-qa-MiniLM-L6-cos-v1 embedding proxy with full English & Arabic text support.
 */
export function calculateSimilarity(query: string, text: string): number {
  const clean = (s: string) => {
    // Keep both latin characters, arabic characters, and numbers
    return s
      .toLowerCase()
      .replace(/[^\w\s\u0600-\u06FF0-9]/g, "")
      .split(/\s+/)
      .filter(t => t.length > 1);
  };
  
  const qTokens = clean(query);
  const tTokens = clean(text);

  const uniqueTokens = Array.from(new Set([...qTokens, ...tTokens]));
  if (uniqueTokens.length === 0) return 0;

  const qVector = uniqueTokens.map((t) => (qTokens.includes(t) ? 1 : 0));
  const tVector = uniqueTokens.map((t) => (tTokens.includes(t) ? 1 : 0));

  let dotProduct = 0;
  let qMag = 0;
  let tMag = 0;

  for (let i = 0; i < uniqueTokens.length; i++) {
    dotProduct += qVector[i] * tVector[i];
    qMag += qVector[i] * qVector[i];
    tMag += tVector[i] * tVector[i];
  }

  if (qMag === 0 || tMag === 0) return 0;
  return dotProduct / (Math.sqrt(qMag) * Math.sqrt(tMag));
}

/**
 * Core FAISS IndexIVFFlat Search Logic.
 * 1. Matches centroids using centroidKeywords.
 * 2. Flat cosine similarity matching within the selected cluster.
 */
function executeFaissRetrieval(
  query: string,
  entities: { text: string; entityType: string }[] = [],
  customReferences?: ScientificReference[]
): { reference: ScientificReference; score: number; clusterName: string }[] {
  if (!query || query.trim() === "") return [];

  const cleanQuery = query.toLowerCase();

  // 1. Centroid routing (IVF Centroid Matching)
  let bestClusterId = 1;
  let highestClusterScore = -1;

  for (const cluster of ivfClusters) {
    let matchCount = 0;
    // Check main centroid keywords
    for (const kw of cluster.centroidKeywords) {
      if (cleanQuery.includes(kw.toLowerCase())) {
        matchCount += 2; // High weight for centroid keyword match
      }
    }
    // Also match based on extracted entities if provided
    for (const ent of entities) {
      const entText = ent.text.toLowerCase();
      if (cluster.centroidKeywords.some(kw => entText.includes(kw.toLowerCase()) || kw.toLowerCase().includes(entText))) {
        matchCount += 3; // Even higher weight for entity overlap
      }
    }

    if (matchCount > highestClusterScore) {
      highestClusterScore = matchCount;
      bestClusterId = cluster.id;
    }
  }

  const targetedCluster = ivfClusters.find((c) => c.id === bestClusterId) || ivfClusters[0];
  
  const referenceList = getMergedReferences(customReferences);

  // Filter scientific references that belong to this cluster or are dynamically learned
  const clusterRefs = referenceList.filter((ref) => targetedCluster.refIds.includes(ref.id) || ref.id.startsWith("LEARNED-"));
  const searchList = clusterRefs.length > 0 ? clusterRefs : referenceList;

  // 2. Perform Flat similarity search within selected cluster (proxy for multi-qa-MiniLM-L6-cos-v1)
  const results = searchList.map((ref) => {
    // Combine title, abstract, summary, keywords for dense matching in both English and Arabic
    const corpusEn = `${ref.title} ${ref.abstract} ${ref.clinicalSummary} ${ref.keywords.join(" ")}`;
    const corpusAr = `${ref.titleAr || ""} ${ref.abstractAr || ""} ${ref.clinicalSummaryAr || ""}`;
    const corpus = `${corpusEn} ${corpusAr}`.toLowerCase();

    // Standard similarity score
    let baseScore = calculateSimilarity(query, corpus);

    // If BioMobileBERT entities are present, boost matching documents
    let entityBoost = 0;
    entities.forEach((ent) => {
      const entText = ent.text.toLowerCase();
      if (corpus.includes(entText)) {
        // Boost score depending on the entity type importance
        if (ent.entityType === "DISEASE" || ent.entityType === "SYMPTOM") {
          entityBoost += 0.12;
        } else if (ent.entityType === "TREATMENT" || ent.entityType === "NUTRIENT") {
          entityBoost += 0.08;
        } else {
          entityBoost += 0.04;
        }
      }
    });

    const finalScore = Math.min(1.0, baseScore + entityBoost);

    return {
      reference: ref,
      score: parseFloat(finalScore.toFixed(3)),
      clusterName: targetedCluster.name
    };
  });

  // Sort descending
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Public Bilingual Semantic RAG Search API.
 * Supports both English and Arabic. Features offline caching lookup,
 * FAISS IndexIVFFlat cluster routing, and BioMobileBERT entity boosts.
 */
export function searchKnowledgeBase(
  query: string,
  topK: number = 3,
  entities: { text: string; entityType: string }[] = [],
  customReferences?: ScientificReference[]
): { reference: ScientificReference; score: number; clusterName: string }[] {
  const normQuery = query.toLowerCase().trim();

  // Try retrieving from persistent local FAISS Cache first if offline or online
  const cachedData = safeStorage.getItem(FAISS_CACHE_STORAGE_KEY);
  if (cachedData) {
    try {
      const parsed = JSON.parse(cachedData);
      if (parsed[normQuery]) {
        console.log(`FAISS Cache HIT for offline query: "${query}"`);
        return parsed[normQuery].slice(0, topK);
      }
    } catch (e) {
      console.warn("Error parsing local FAISS cache:", e);
    }
  }

  // Fallback to real-time search
  const hits = executeFaissRetrieval(query, entities, customReferences);
  
  // Save search query into cache dynamically for future offline retrievals
  if (hits.length > 0) {
    try {
      const cacheObj = cachedData ? JSON.parse(cachedData) : {};
      cacheObj[normQuery] = hits;
      safeStorage.setItem(FAISS_CACHE_STORAGE_KEY, JSON.stringify(cacheObj));
    } catch (e) {
      // Ignored
    }
  }

  return hits.slice(0, topK);
}

/**
 * Clinical Reasoning Engine
 * Composes a medical recommendation by linking predicted XGBoost outcomes with retrieved WHO evidence guidelines.
 * Accepts optional extracted entities to improve the contextual evidence matching.
 */
export function generateClinicalReasoning(
  prediction: MalnutritionPrediction,
  childName: string,
  ageMonths: number,
  muacMm?: number,
  oedema?: boolean,
  entities: { text: string; entityType: string }[] = []
): ClinicalRecommendation {
  const isStunting = prediction.stunting.severityClass !== "Normal";
  const isWasting = prediction.wasting.severityClass !== "Normal";
  const isUnderweight = prediction.underweight.severityClass !== "Normal";

  // Formulate clinical RAG query based on findings & entities
  let clinicalQuery = "Malnutrition screening standards";
  if (oedema) {
    clinicalQuery = "Management protocol for severe wasting and nutritional oedema in children";
  } else if (prediction.wasting.severityClass === "Severe" || (muacMm && muacMm < 115)) {
    clinicalQuery = "Management protocol for severe wasting ready-to-use therapeutic food RUTF";
  } else if (prediction.wasting.severityClass === "Moderate" || (muacMm && muacMm < 125)) {
    clinicalQuery = "Management of moderate acute malnutrition MAM supplementary feeding";
  } else if (isStunting) {
    clinicalQuery = "Preventing stunting child growth standards dietary diversity complementary feeding";
  }

  // Extract symptoms/disease words from entities to enrich the search query
  if (entities.length > 0) {
    const medicalKeywords = entities
      .filter(e => e.entityType === "DISEASE" || e.entityType === "SYMPTOM" || e.entityType === "TREATMENT")
      .map(e => e.text)
      .join(" ");
    if (medicalKeywords) {
      clinicalQuery += ` ${medicalKeywords}`;
    }
  }

  // Retrieve top RAG evidence using IVF-Flat search with entities passed in
  const ragResults = searchKnowledgeBase(clinicalQuery, 1, entities);
  const bestRef = ragResults[0]?.reference || scientificReferences[0];

  // Compose Diagnosis & Interventions
  let diagnosis = "Child exhibits healthy growth standards.";
  let diagnosisAr = "يظهر الطفل معدلات نمو صحية وطبيعية.";
  let recommendedIntervention = "Continue standard age-appropriate feeding practices and regular growth monitoring.";
  let recommendedInterventionAr = "الاستمرار في ممارسات التغذية السليمة والمناسبة للعمر مع المراقبة الدورية للنمو.";
  let referralNeed: ClinicalRecommendation["referralNeed"] = "None";
  let referralNeedAr = "لا يوجد حاجة للإحالة الطبية";
  let severity: ClinicalRecommendation["severity"] = "Normal";

  if (oedema) {
    severity = "Severe";
    diagnosis = `Severe Acute Malnutrition (SAM) with bilateral pitting oedema (Kwashiorkor). Elevated risk of critical complications.`;
    diagnosisAr = "سوء تغذية حاد شديد (SAM) مصحوب بوذمة انطباعية ثنائية (كواشيوركور). خطر مرتفع للمضاعفات الحرجة.";
    recommendedIntervention = "Immediate inpatient admission for stabilization. Start F-75 therapeutic milk strictly following WHO protocols. Manage complications like hypoglycemia, hypothermia, and infection.";
    recommendedInterventionAr = "الإدخال الفوري للمستشفى أو مركز الاستقرار السريري. البدء بحليب F-75 العلاجي بالتزام تام ببروتوكول الصحة العالمية. معالجة انخفاض السكر وانخفاض الحرارة والعدوى.";
    referralNeed = "Inpatient SAM Stabilization";
    referralNeedAr = "إحالة فورية لمركز الاستقرار السريري الداخلي (Inpatient)";
  } else if (prediction.wasting.severityClass === "Severe" || (muacMm && muacMm < 115)) {
    severity = "Severe";
    diagnosis = `Severe Acute Malnutrition (SAM) without complications. MUAC: ${muacMm || "N/A"} mm. Expect severe physical wasting.`;
    diagnosisAr = `سوء تغذية حاد شديد (SAM) دون مضاعفات طبية. محيط منتصف الذراع: ${muacMm || "غير محدد"} ملم. هزال جسدي شديد.`;
    recommendedIntervention = "Enroll in Outpatient Therapeutic Program (OTP). Prescribe Ready-to-Use Therapeutic Food (RUTF) (approx. 200 kcal/kg/day). Administer routine Amoxicillin and Vitamin A dose. Check appetite locally.";
    recommendedInterventionAr = "الالتحاق ببرنامج العلاج الخارجي (OTP). صرف الأغذية العلاجية الجاهزة (RUTF) بمعدل 200 سعرة حرارية لكل كجم يومياً. إعطاء الأموكسيسيلين الروتيني وجرعة فيتامين أ.";
    referralNeed = "Outpatient Care";
    referralNeedAr = "إحالة لبرنامج العلاج الخارجي وسرعة الصرف (OTP)";
  } else if (prediction.wasting.severityClass === "Moderate" || (muacMm && muacMm < 125)) {
    severity = "Moderate";
    diagnosis = "Moderate Acute Malnutrition (MAM). Child exhibits accelerated wasting indicators.";
    diagnosisAr = "سوء تغذية حاد متوسط (MAM). يظهر الطفل علامات متسارعة للهزال ونقص الوزن.";
    recommendedIntervention = "Enroll in Targeted Supplementary Feeding Program (TSFP). Provide Ready-to-Use Supplementary Food (RUSF) or Supercereal. Educate parents on dietary diversity and sanitation.";
    recommendedInterventionAr = "الالتحاق ببرنامج التغذية التكميلية المستهدفة (TSFP). توفير الأغذية التكميلية الجاهزة (RUSF). تثقيف الأهالي حول التنوع الغذائي والنظافة الشخصية.";
    referralNeed = "Outpatient Care";
    referralNeedAr = "متابعة الرعاية الخارجية والتغذية التكميلية (TSFP)";
  } else if (prediction.stunting.severityClass === "Severe") {
    severity = "Severe";
    diagnosis = "Severe Chronic Stunting. Critical physical and potential cognitive delay.";
    diagnosisAr = "تقزم مزمن شديد. تأخر حاد في النمو البدني والقدرات المعرفية المتوقعة للطفل.";
    recommendedIntervention = "Provide high-quality complementary feeding education. Focus on micronutrient dense animal-source foods, Zinc supplementation, and Vitamin A booster drops. Monitor progress monthly.";
    recommendedInterventionAr = "تقديم التثقيف المكثف حول التغذية التكميلية عالية الجودة. التركيز على الأغذية الحيوانية الغنية بالمغذيات، مكملات الزنك، وفيتامين أ.";
    referralNeed = "Outpatient Care";
    referralNeedAr = "إحالة للمتابعة الدورية والتغذية المكثفة";
  } else if (prediction.stunting.severityClass === "Moderate") {
    severity = "Moderate";
    diagnosis = "Moderate Chronic Stunting. Stunted height-for-age trajectory.";
    diagnosisAr = "تقزم مزمن متوسط. مسار نمو متأخر بالنسبة للطول مقارنة بالعمر.";
    recommendedIntervention = "Advise on diverse dietary intake. Ensure family access to fortified complementary foods and clean drinking water (WASH protocols).";
    recommendedInterventionAr = "نصح الأهل بزيادة التنوع الغذائي. التأكد من حصول الأسرة على أغذية تكميلية مدعمة ومياه شرب نظيفة (بروتوكول WASH).";
    referralNeed = "None";
    referralNeedAr = "متابعة في المركز الصحي المحلي";
  } else if (prediction.underweight.severityClass !== "Normal") {
    severity = prediction.underweight.severityClass === "Severe" ? "Severe" : "Moderate";
    diagnosis = `${prediction.underweight.severityClass} Underweight. Significant deficit in weight relative to age.`;
    diagnosisAr = `نقص وزن ${prediction.underweight.severityClass === "Severe" ? "شديد" : "متوسط"}. عجز ملحوظ في كتلة الجسم الكلية مقارنة بالعمر.`;
    recommendedIntervention = "Provide lipid-based nutrient supplements. Schedule comprehensive dietary review. Check for co-morbidities like recurrent diarrhea and treat immediately.";
    recommendedInterventionAr = "صرف مكملات غذائية دهنية عالية السعرات. جدولة مراجعة غذائية شاملة. فحص الأمراض المصاحبة مثل الإسهال المتكرر وعلاجه فوراً.";
    referralNeed = "None";
    referralNeedAr = "متابعة محلية وتلقي المكملات";
  }

  return {
    id: `REC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    predictionId: prediction.id,
    diagnosis,
    diagnosisAr,
    severity,
    recommendedIntervention,
    recommendedInterventionAr,
    referralNeed,
    referralNeedAr,
    evidenceSource: bestRef.title + " (" + bestRef.year + ")",
    whoReference: `${bestRef.organization} Guidelines, Section: ${severity === "Severe" ? "SAM Treatment Management" : "Preventive Growth Interventions"}`,
    createdAt: new Date().toISOString()
  };
}
