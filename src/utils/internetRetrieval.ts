import { GoogleGenAI } from "@google/genai";

// Whitelist of trusted medical, nutritional, and global health domains
export const TRUSTED_DOMAINS = [
  "who.int",
  "unicef.org",
  "ncbi.nlm.nih.gov",
  "nih.gov",
  "thelancet.com",
  "oxfordacademic.com",
  "academic.oup.com",
  "elsevier.com",
  "clinicalnutritionjournal.com",
  "sciencedirect.com",
  "nature.com",
  "bmj.com",
  "cochranelibrary.com",
  "plos.org",
  "plosone.org",
  "biomedcentral.com",
  "bmcpublichealth.biomedcentral.com",
  "bmcnutrition.biomedcentral.com",
  "dhsprogram.com",
  "microdata.worldbank.org",
  "worldbank.org",
  "springer.com",
  "wiley.com",
  "mdpi.com",
  "un.org",
  "pediatrics.aappublications.org",
  "aap.org"
];

/**
 * Validates whether a URL belongs to a trusted scientific or global health source.
 * Rejects spam, social media, and low-quality/fake news outlets.
 */
export function validateScientificUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    
    const hostname = parsed.hostname.toLowerCase();
    
    // Check if hostname is directly in trusted domains or is a subdomain of a trusted domain
    const isTrusted = TRUSTED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith("." + domain)
    );
    
    if (isTrusted) return true;
    
    // Allow well-known scholarly top-level domains like .gov and .edu, but reject generic noise
    if (hostname.endsWith(".gov") || hostname.endsWith(".edu") || hostname.endsWith(".org")) {
      const untrustedKeywords = [
        "facebook", "twitter", "reddit", "youtube", "tiktok", "instagram", 
        "pinterest", "blogspot", "wordpress", "medium", "quora", "wikipedia"
      ];
      return !untrustedKeywords.some(kw => hostname.includes(kw));
    }
    
    return false;
  } catch (e) {
    return false;
  }
}

/**
 * Executes a web search grounded on the latest scientific sources using Gemini.
 */
export async function retrieveFromInternet(
  query: string,
  apiKey: string
): Promise<{
  answer: string;
  citations: { title: string; website: string; url: string; publishDate: string }[];
}> {
  if (!apiKey || apiKey === "AI_STUDIO_INJECTED_OR_YOUR_SECURE_API_KEY") {
    throw new Error("Gemini API Key is missing or invalid. Please configure your API key in Secrets or Environment variables.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const hasArabic = /[\u0600-\u06FF]/.test(query);
  const languageInstruction = hasArabic
    ? "Please answer this question comprehensively and objectively in clear, professional Arabic (العربية)."
    : "Please answer this question comprehensively and objectively in English.";

  const prompt = `You are a Senior Clinical Pediatrician and Research Scientist specializing in child malnutrition.
The user's query is: "${query}"

${languageInstruction}
Provide clear clinical guidance grounded in trusted publications. You must search for and prioritize results from:
- American Journal of Clinical Nutrition
- British Journal of Nutrition
- European Journal of Clinical Nutrition
- Clinical Nutrition (Elsevier)
- Advances in Nutrition (Oxford)
- The Lancet
- WHO Guidelines and child growth standards
- UNICEF reports and MICS databases
- The DHS Program
- Cochrane Library

Response Requirements:
1. Synthesize recent evidence (preferably 2020-2026).
2. Compare multiple sources, remove duplicated information, and resolve conflicting reports clinically.
3. Keep the response concise, structured, and highly readable using bullet points.
4. Output professional medical/clinical advice.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const answer = response.text || "No response generated.";
  const citations: { title: string; website: string; url: string; publishDate: string }[] = [];

  // Parse grounding chunks if available
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks && Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (chunk.web && chunk.web.uri) {
        const url = chunk.web.uri;
        const title = chunk.web.title || "Scientific Reference Document";
        
        let website = "Trusted Medical Source";
        try {
          const urlObj = new URL(url);
          website = urlObj.hostname.replace("www.", "");
        } catch (e) {
          // Keep default
        }

        // Validate scientific trust and reject low quality URLs
        if (validateScientificUrl(url)) {
          citations.push({
            title,
            website,
            url,
            publishDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "short" })
          });
        }
      }
    }
  }

  // Deduplicate citations by URL
  const uniqueCitations = citations.filter(
    (item, index, self) => self.findIndex(c => c.url === item.url) === index
  );

  return {
    answer,
    citations: uniqueCitations
  };
}
