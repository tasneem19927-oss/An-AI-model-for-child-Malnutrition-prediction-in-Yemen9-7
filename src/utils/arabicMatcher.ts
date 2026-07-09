/**
 * Arabic Name Normalization and Multi-Part Matcher for Clinical Database Queries
 * 
 * In Arabic culture (and specifically Yemeni clinical contexts), name spellings vary heavily 
 * due to differences in character rendering (e.g., Alif Hamza, Alif Maksura, Ta Marbuta).
 * Furthermore, children are often registered using their full triple names (Child Father Grandfather).
 * 
 * This utility normalizes common spelling variations and matches queries against database
 * entries based on partial word matches (such as matching at least 2 tokens of a triple name).
 */

/**
 * Normalizes common Arabic spelling variations to standard forms.
 * E.g., maps all Alif variants (أ, إ, آ) to a plain Alif (ا),
 * maps Ta Marbuta (ة) to Ha (ه), and maps Alif Maksura (ى) to Ya (ي).
 */
export const normalizeArabicName = (name: string): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Checks if a typed search query matches a database name using smart partial matching rules.
 * Handled conditions:
 * 1. Direct containment (one name is entirely within the other).
 * 2. Token-based matching: Splits names into words and requires at least 2 tokens of length > 2
 *    to match, which is perfect for identifying triple names with slight spelling differences.
 */
export const isTripleNameMatch = (typedName: string, dbName: string): boolean => {
  const normTyped = normalizeArabicName(typedName);
  const normDb = normalizeArabicName(dbName);
  
  if (!normTyped || !normDb) return false;
  
  // Rule 1: Direct sub-string match (quick path)
  if (normDb.includes(normTyped) || normTyped.includes(normDb)) {
    return true;
  }
  
  // Rule 2: Multi-part word intersection (token matching)
  const typedTokens = normTyped.split(" ").filter(t => t.length > 2);
  const dbTokens = normDb.split(" ").filter(t => t.length > 2);
  
  let matchCount = 0;
  for (const token of typedTokens) {
    if (dbTokens.includes(token)) {
      matchCount++;
    }
  }
  
  // Require at least 2 matching significant tokens to consider it a high-probability match
  return matchCount >= 2;
};
