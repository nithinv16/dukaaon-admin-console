/**
 * Product Name Cleaning Utility
 * Removes unwanted content from OCR-extracted product names like barcodes, SKUs, prices, etc.
 */

/**
 * Clean product name by removing:
 * - Item numbers (16|)
 * - Barcodes/SKUs (18063200, 1K508301)
 * - Prices (110.0)
 * - Unit codes (PCS, KG, etc.)
 * - Pipe delimiters (|)
 * - Reference codes (R/18063200)
 */
export function cleanProductName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') {
    return '';
  }

  let cleaned = rawName.trim();

  // Remove pipe delimiters first
  cleaned = cleaned.replace(/\|/g, ' ');

  // Remove item numbers at the start (e.g., "16|" or "16 " or "16)")
  cleaned = cleaned.replace(/^\s*\d+\s*[|\s)]*\s*/i, '');

  // Remove barcodes/SKUs patterns BEFORE other cleaning:
  // Pattern: "R/18063200" or "/18063200"
  cleaned = cleaned.replace(/\bR\/\s*\d{6,}\b/gi, '');
  cleaned = cleaned.replace(/\/\s*\d{6,}\b/gi, '');
  
  // Pattern: Alphanumeric codes like "1K508301" (letter followed by 6+ digits)
  cleaned = cleaned.replace(/\b[A-Z]\d{6,}\b/gi, '');
  
  // Pattern: Long numeric codes (8+ digits) - likely barcodes
  cleaned = cleaned.replace(/\b\d{8,}\b/g, '');
  
  // Pattern: Alphanumeric codes with slashes like "A/B123456"
  cleaned = cleaned.replace(/\b[A-Z0-9]+\/[A-Z0-9]{6,}\b/gi, '');

  // Remove prices (decimal numbers with optional currency)
  cleaned = cleaned.replace(/\$?\s*\d+[,.]?\d*\.?\d{0,2}\s*/g, '');

  // Remove unit codes (PCS, KG, G, ML, L, etc.)
  cleaned = cleaned.replace(/\b(PCS|PC|PIECES?|KG|G|GRAM|GRAMS?|ML|MILLILITER|L|LITER|LITRE|BOX|CARTON|PACK|BOTTLE|CAN|TIN|DOZEN|DZ)\b/gi, '');

  // Remove reference codes (R/, REF:, etc.) - but only if followed by codes
  cleaned = cleaned.replace(/\b(REF|REFERENCE|R):\s*[A-Z0-9]+\b/gi, '');
  cleaned = cleaned.replace(/\bR\s+(?=\d{6,})/gi, ''); // "R " followed by long numbers

  // Remove quantity patterns (1x, 2 pcs, etc.)
  cleaned = cleaned.replace(/\b\d+\s*(x|X|\*)\s*/g, '');

  // Remove trailing codes/patterns after product name
  // Pattern: "51G R/18063200" or "51G R" at the end (weight followed by reference code)
  cleaned = cleaned.replace(/\s+\d+[A-Z]{1,2}\s+[A-Z]\/\s*[\dA-Z]+\s*$/i, ''); // "51G R/18063200"
  cleaned = cleaned.replace(/\s+\d+[A-Z]{1,2}\s+[A-Z]\s*$/i, ''); // "51G R" (reference code, not part of name)
  
  // Remove standalone reference codes like "R/" or "/" followed by codes at the end
  cleaned = cleaned.replace(/\s+[A-Z]\/\s*[\dA-Z]+\s*$/i, '');

  // Clean up multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Remove leading/trailing special characters (but keep & for product names like "FRUIT&NUT")
  cleaned = cleaned.replace(/^[^a-zA-Z0-9&]+|[^a-zA-Z0-9&]+$/g, '');

  // Remove remaining long numeric-only segments (4+ digits that aren't part of product name)
  // But preserve numbers that are clearly part of product names (like "51G" in context)
  cleaned = cleaned.replace(/\s+\d{4,}\s+/g, ' ');

  // Final cleanup
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/**
 * Extract product name from a raw OCR line that may contain multiple elements
 * Example: "16|PRI CDM SILK FRUIT&NUT 51G R/18063200| 1K508301 110.0|PCS|"
 * Should extract: "PRI CDM SILK FRUIT&NUT 51G" or "PRI CDM SILK FRUIT&NUT"
 */
export function extractProductNameFromLine(line: string): string {
  if (!line || typeof line !== 'string') {
    return '';
  }

  // First, try to clean the entire line
  let cleaned = cleanProductName(line);
  
  // If cleaning produced a reasonable result, return it
  if (cleaned && cleaned.length >= 3 && /[A-Za-z]/.test(cleaned)) {
    // Ensure it starts with a letter
    const match = cleaned.match(/[A-Za-z].*/);
    if (match) {
      return match[0].trim();
    }
  }

  // If cleaning didn't work well, try splitting and finding the best part
  const parts = line.split(/[|\t]/).map(part => part.trim()).filter(Boolean);
  
  let bestMatch = '';
  let bestScore = 0;

  for (const part of parts) {
    // Skip pure numeric parts (likely prices or codes)
    if (/^\d+[,.]?\d*$/.test(part)) {
      continue;
    }

    // Skip pure alphanumeric codes without spaces (likely SKUs/barcodes)
    // But allow codes that are short and might be part of product names
    if (/^[A-Z0-9]{8,}$/i.test(part) && !/\s/.test(part)) {
      continue;
    }

    // Skip unit codes
    if (/^(PCS|PC|KG|G|ML|L|BOX|CARTON|PACK)$/i.test(part)) {
      continue;
    }

    // Score this part based on how much it looks like a product name
    let score = 0;
    const hasLetters = /[A-Za-z]/.test(part);
    const hasReasonableLength = part.length >= 3;
    const hasSpaces = /\s/.test(part);
    const hasMixedContent = /[A-Za-z].*[0-9]|[0-9].*[A-Za-z]/.test(part);
    const hasSpecialChars = /[&/]/.test(part); // Product names often have & or /
    const isLongEnough = part.length >= 5;

    if (hasLetters) score += 10;
    if (hasReasonableLength) score += 5;
    if (hasSpaces) score += 5; // Product names usually have spaces
    if (hasMixedContent) score += 3;
    if (hasSpecialChars) score += 2;
    if (isLongEnough) score += 3;

    // Penalize if it looks like a code
    if (/^[A-Z]\d{6,}$/i.test(part)) score -= 10;
    if (/^\d{8,}$/.test(part)) score -= 10;
    if (/^R\/\d+$/i.test(part)) score -= 10;

    if (score > bestScore && score >= 10) {
      bestScore = score;
      const cleanedPart = cleanProductName(part);
      if (cleanedPart.length >= 3) {
        bestMatch = cleanedPart;
      }
    }
  }

  // If we found a good match, return it
  if (bestMatch && bestMatch.length >= 3) {
    // Ensure it starts with a letter
    const match = bestMatch.match(/[A-Za-z].*/);
    if (match) {
      return match[0].trim();
    }
    return bestMatch;
  }

  // Final fallback: try cleaning the entire line again with stricter rules
  cleaned = cleanProductName(line);
  if (cleaned && cleaned.length >= 2 && /[A-Za-z]/.test(cleaned)) {
    const match = cleaned.match(/[A-Za-z].*/);
    if (match) {
      return match[0].trim();
    }
  }

  return '';
}

