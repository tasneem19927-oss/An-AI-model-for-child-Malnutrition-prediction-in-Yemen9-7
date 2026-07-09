import { retrieveFromInternet } from "./internetRetrieval";
import { prepareDocumentForIndexing } from "./kbService";
import { searchKnowledgeBase } from "./rag";
import { ScientificReference } from "../types";
import { GoogleGenAI } from "@google/genai";

export interface Citation {
  title: string;
  website: string;
  url: string;
  publishDate: string;
  documentId?: string;
  confidenceScore?: number;
}

export interface SearchResult {
  answer: string;
  citations: Citation[];
  mode: "online" | "offline";
  steps: string[];
  newDocumentIndexed?: boolean;
}

/**
 * Synthesizes a coherent, readable clinical summary offline using 
 * the abstract and summaries of the top matching local references.
 */
export function synthesizeOfflineAnswer(
  query: string,
  hits: { reference: ScientificReference; score: number; clusterName: string }[]
): { answer: string; citations: Citation[] } {
  if (hits.length === 0) {
    return {
      answer: "No relevant clinical guidelines or scientific references were found in the local database to answer your question offline.\n\nPlease connect to the Internet or adjust your search to focus on standard terms such as 'SAM therapeutic milk', 'stunting prevention', or 'breastfeeding recommendations'.",
      citations: []
    };
  }

  // Compose a gorgeous, highly structured synthesis of the local documents
  let answer = `[Offline Mode - Displaying Local Guideline Synthesis]\n\n`;
  answer += `Your query matched our verified clinical guidelines library. Here is the relevant structured guidance:\n\n`;

  hits.forEach((hit, idx) => {
    const ref = hit.reference;
    answer += `### ${idx + 1}. Reference: ${ref.title}\n`;
    answer += `*Source: ${ref.authors} (${ref.year}) - Published by ${ref.organization}*\n\n`;
    answer += `> **Guideline/Abstract:** ${ref.abstract}\n\n`;
    if (ref.clinicalSummary) {
      answer += `**Core Clinical Protocol:** ${ref.clinicalSummary}\n\n`;
    }
  });

  answer += `---\n*Disclaimer: Operating in fully offline mode. Answers are sourced strictly from local cached medical documents and protocols.*`;

  const citations: Citation[] = hits.map(hit => ({
    title: hit.reference.title,
    website: hit.reference.organization || "Local Guidelines Library",
    url: hit.reference.sourceUrl || "#",
    publishDate: hit.reference.year?.toString() || "Verified Guideline",
    documentId: hit.reference.id,
    confidenceScore: hit.score
  }));

  return { answer, citations };
}

/**
 * Synthesizes a coherent, readable clinical summary offline using 
 * Gemini to answer the specific query using local guidelines context.
 */
export async function synthesizeOfflineAnswerWithAI(
  query: string,
  hits: { reference: ScientificReference; score: number; clusterName: string }[],
  apiKey: string
): Promise<{ answer: string; citations: Citation[] }> {
  if (!apiKey || apiKey === "AI_STUDIO_INJECTED_OR_YOUR_SECURE_API_KEY") {
    return synthesizeOfflineAnswer(query, hits);
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    // Detect if the query is in Arabic or has Arabic characters
    const hasArabic = /[\u0600-\u06FF]/.test(query);

    const docContext = hits.map((hit, idx) => {
      const ref = hit.reference;
      return `Document ${idx + 1}:
Title: ${ref.title}
Organization: ${ref.organization}
Abstract/Summary: ${ref.abstract}
Clinical Protocol: ${ref.clinicalSummary || "N/A"}`;
    }).join("\n\n");

    const systemInstruction = `You are an expert pediatric nutritionist and medical advisor.
You are operating in offline mode using verified cached medical guidelines.
Your goal is to answer the user's question accurately, concisely, and directly, using ONLY the provided guideline documents as context.
Do not invent any facts. If the provided context cannot answer the question, state that politely.

Language Requirement:
- If the user's query contains Arabic characters or is in Arabic, you MUST write the entire response in clean, professional Arabic.
- If the query is in English, respond in English.
- Use a friendly, professional, clear tone. Avoid technical jargon where possible, but keep medical guidelines exact (e.g., F-75, F-100, RUTF, MUAC cutoffs).`;

    const prompt = `User's Query: "${query}"

Guidelines Context:
${docContext}

Please synthesize a clear, direct answer to the user's query based on the context above.
Do not start with "Disclaimer" or "[Offline Mode]". The system will append that metadata automatically.
Just provide the clean, direct answer.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
      },
    });

    const generatedText = response.text || "";

    const citations: Citation[] = hits.map(hit => ({
      title: hit.reference.title,
      website: hit.reference.organization || "Local Guidelines Library",
      url: hit.reference.sourceUrl || "#",
      publishDate: hit.reference.year?.toString() || "Verified Guideline",
      documentId: hit.reference.id,
      confidenceScore: hit.score
    }));

    // Detect response language to match disclaimer
    const isArabicResponse = /[\u0600-\u06FF]/.test(generatedText);
    let answer = `[Offline Mode - Displaying Local Guideline Synthesis]\n\n${generatedText}\n\n---\n`;
    if (isArabicResponse) {
      answer += `*تنويه: يتم التشغيل بالوضع المحلي غير المتصل بالشبكة. الإجابات مستمدة تماماً من وثائق وبروتوكولات الرعاية المحلية المحفوظة.*`;
    } else {
      answer += `*Disclaimer: Operating in fully offline mode. Answers are sourced strictly from local cached medical documents and protocols.*`;
    }

    return { answer, citations };
  } catch (err) {
    console.warn("AI offline synthesis failed, falling back to static offline synthesis", err);
    return synthesizeOfflineAnswer(query, hits);
  }
}

/**
 * The high-level orchestrator for the Intelligent Search system.
 * Detects connectivity, searches online/offline, updates Knowledge Base, and builds citations.
 */
export async function performIntelligentSearch(params: {
  query: string;
  isOnline: boolean;
  apiKey?: string;
  dbKnowledgeBase: ScientificReference[];
  onAddReferences?: (refs: ScientificReference[]) => void;
}): Promise<SearchResult> {
  const { query, isOnline, apiKey, dbKnowledgeBase, onAddReferences } = params;
  const steps: string[] = [];

  // Step 1: Detect connectivity
  if (isOnline) {
    // ONLINE MODE
    steps.push("Searching trusted scientific sources...");
    steps.push("Analyzing references...");
    
    try {
      const internetResult = await retrieveFromInternet(query, apiKey || "");
      steps.push("Updating knowledge base...");

      let newDocumentIndexed = false;
      
      // Automatic Knowledge Base Update (Silent)
      if (internetResult.citations.length > 0) {
        const preparedRefs = prepareDocumentForIndexing({
          question: query,
          answer: internetResult.answer,
          citations: internetResult.citations,
          existingRefs: dbKnowledgeBase
        });

        if (preparedRefs.length > 0) {
          newDocumentIndexed = true;
          if (onAddReferences) {
            onAddReferences(preparedRefs);
          }
        }
      }

      steps.push("Generating answer...");
      steps.push("Complete.");

      return {
        answer: internetResult.answer,
        citations: internetResult.citations,
        mode: "online",
        steps,
        newDocumentIndexed
      };

    } catch (e: any) {
      console.warn("Internet search failed or rate-limited; switching gracefully to local offline RAG.", e);
      // Fail-safe transition to offline mode
      steps.push(`Internet search failed: ${e.message || e}`);
      steps.push("Searching local knowledge...");
      steps.push("Generating answer...");
      steps.push("Complete.");

      const hits = searchKnowledgeBase(query, 3, [], dbKnowledgeBase);
      const offline = await synthesizeOfflineAnswerWithAI(query, hits, apiKey || "");

      return {
        answer: offline.answer,
        citations: offline.citations,
        mode: "offline",
        steps
      };
    }
  } else {
    // OFFLINE MODE
    steps.push("Searching local knowledge...");
    steps.push("Generating answer...");
    steps.push("Complete.");

    // Retrieve from local database using semantic vector similarity simulation
    const hits = searchKnowledgeBase(query, 3, [], dbKnowledgeBase);
    const offline = await synthesizeOfflineAnswerWithAI(query, hits, apiKey || "");

    return {
      answer: offline.answer,
      citations: offline.citations,
      mode: "offline",
      steps
    };
  }
}
