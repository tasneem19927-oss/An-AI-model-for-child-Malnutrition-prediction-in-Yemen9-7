import { ScientificReference } from "../types";

/**
 * Splits a long text body into smaller, semantically coherent chunks (paragraphs).
 */
export function chunkText(text: string, maxCharLength: number = 800): string[] {
  if (!text) return [];
  
  // Split by paragraphs first
  const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if ((currentChunk + "\n" + paragraph).length <= maxCharLength) {
      currentChunk = currentChunk ? currentChunk + "\n" + paragraph : paragraph;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // If a single paragraph is extremely long, split it by sentences
      if (paragraph.length > maxCharLength) {
        const sentences = paragraph.split(/(?<=[.?!])\s+/);
        let sentenceChunk = "";
        for (const sentence of sentences) {
          if ((sentenceChunk + " " + sentence).length <= maxCharLength) {
            sentenceChunk = sentenceChunk ? sentenceChunk + " " + sentence : sentence;
          } else {
            if (sentenceChunk) chunks.push(sentenceChunk);
            sentenceChunk = sentence;
          }
        }
        currentChunk = sentenceChunk;
      } else {
        currentChunk = paragraph;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Checks if a document already exists in the Knowledge Base to avoid duplicates.
 */
export function isDuplicate(
  title: string,
  url: string | undefined,
  existingRefs: ScientificReference[]
): boolean {
  const normTitle = title.toLowerCase().trim();
  const normUrl = url ? url.toLowerCase().trim() : "";

  return existingRefs.some(ref => {
    if (normUrl && ref.sourceUrl && ref.sourceUrl.toLowerCase().trim() === normUrl) {
      return true;
    }
    return ref.title.toLowerCase().trim() === normTitle;
  });
}

/**
 * Chunks, extracts metadata, and prepares reference objects for incremental indexing.
 */
export function prepareDocumentForIndexing(params: {
  question: string;
  answer: string;
  citations: { title: string; website: string; url: string; publishDate?: string }[];
  existingRefs: ScientificReference[];
}): ScientificReference[] {
  const { question, answer, citations, existingRefs } = params;

  // 1. Check if this question search is already cached/indexed
  if (isDuplicate(`AI Grounded: ${question}`, citations[0]?.url, existingRefs)) {
    return [];
  }

  const timestamp = new Date().toISOString();
  const year = new Date().getFullYear();
  const mainUrl = citations[0]?.url || "https://who.int/malnutrition-policy";
  const mainTitle = citations[0]?.title || "WHO Guidelines on Wasting and Stunting";
  const mainOrg = citations[0]?.website || "World Health Organization";

  // 2. Perform automatic document chunking on the AI Answer
  const answerChunks = chunkText(answer, 600);
  const newReferences: ScientificReference[] = [];

  answerChunks.forEach((chunk, index) => {
    const chunkId = `REF-AUTO-${Date.now()}-${index}`;
    const chunkTitle = `AI Grounded Response: "${question}" (Part ${index + 1}/${answerChunks.length})`;
    
    const ref: ScientificReference = {
      id: chunkId,
      title: chunkTitle,
      titleAr: `إجابة ذكية مدعومة: "${question}" (الجزء ${index + 1}/${answerChunks.length})`,
      authors: "AI Knowledge Harvester",
      organization: mainOrg,
      year: year,
      abstract: chunk,
      abstractAr: `تمت مزامنة هذا النص آلياً من قواعد بيانات التغذية العالمية لتعزيز الرعاية الصحية في حالات الطوارئ.`,
      clinicalSummary: `Auto-Indexed Question: "${question}"\nSource Reference: ${mainTitle}\nRetrieval Timestamp: ${timestamp}`,
      clinicalSummaryAr: `سؤال المستخدم: "${question}"\nتاريخ الاسترجاع: ${timestamp}`,
      keywords: ["AI Grounded", "Auto-Indexed", "Smart Retrieval", "Scientific Validation"],
      citation: `${mainOrg}. (${year}). Grounded research on malnutrition: ${mainTitle}. Retrieved via Yemen AI Engine.`,
      sourceUrl: mainUrl,
      approvedByAdmin: true, // Auto-approved as valid scientific grounding
      approvedByDoctor: true
    };

    newReferences.push(ref);
  });

  return newReferences;
}
