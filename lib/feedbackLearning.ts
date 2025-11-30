/**
 * AI Feedback Learning Service
 * 
 * Captures user corrections to AI-extracted product data and uses few-shot learning
 * to progressively improve extraction accuracy.
 * 
 * Key Features:
 * - Capture corrections when user submits reviewed products
 * - Fetch similar past corrections for few-shot learning
 * - Build learning prompts with relevant examples
 * - Track accuracy improvements over time
 */

import { getSupabaseClient } from './supabase-browser';

export interface ProductCorrection {
    id: string;
    receipt_id: string | null;
    seller_id: string | null;

    extracted_name: string;
    corrected_name: string;

    extracted_category?: string | null;
    corrected_category?: string | null;

    extracted_subcategory?: string | null;
    corrected_subcategory?: string | null;

    extracted_description?: string | null;
    corrected_description?: string | null;

    extracted_quantity?: number | null;
    corrected_quantity?: number | null;

    extracted_unit?: string | null;
    corrected_unit?: string | null;

    extracted_unit_price?: number | null;
    corrected_unit_price?: number | null;

    was_corrected: boolean;
    correction_type?: string | null;
    confidence_before?: number | null;
    confidence_after?: number | null;
    created_at: string;
}

export interface ExtractedProduct {
    name: string;
    description?: string;
    category?: string;
    subcategory?: string;
    quantity?: number;
    unit?: string;
    unitPrice?: number;
    confidence?: number;
}

export interface FewShotExample {
    extracted_name: string;
    corrected_name: string;
    extracted_category?: string;
    corrected_category?: string;
    extracted_subcategory?: string;
    corrected_subcategory?: string;
    extracted_description?: string;
    corrected_description?: string;
    pattern_note: string;
    similarity_score: number;
}

/**
 * Capture corrections made by user to AI-extracted products
 * Compares extracted data vs submitted data and stores differences
 */
export async function captureProductCorrections(
    extractedProducts: ExtractedProduct[],
    submittedProducts: ExtractedProduct[],
    metadata: {
        receiptId?: string;
        sellerId?: string;
    }
): Promise<{ success: boolean; capturedCount: number; error?: string }> {
    try {
        const supabase = getSupabaseClient();
        const corrections: Omit<ProductCorrection, 'id' | 'created_at'>[] = [];

        // Compare each product
        for (let i = 0; i < Math.min(extractedProducts.length, submittedProducts.length); i++) {
            const extracted = extractedProducts[i];
            const submitted = submittedProducts[i];

            // Check if there are any differences
            const hasChanges =
                extracted.name !== submitted.name ||
                extracted.category !== submitted.category ||
                extracted.subcategory !== submitted.subcategory ||
                extracted.description !== submitted.description ||
                extracted.quantity !== submitted.quantity ||
                extracted.unit !== submitted.unit;

            if (hasChanges) {
                // Determine correction type
                const types: string[] = [];
                if (extracted.name !== submitted.name) types.push('name');
                if (extracted.category !== submitted.category) types.push('category');
                if (extracted.subcategory !== submitted.subcategory) types.push('subcategory');
                if (extracted.description !== submitted.description) types.push('description');
                if (extracted.quantity !== submitted.quantity) types.push('quantity');
                if (extracted.unit !== submitted.unit) types.push('unit');

                corrections.push({
                    receipt_id: metadata.receiptId || null,
                    seller_id: metadata.sellerId || null,
                    extracted_name: extracted.name,
                    corrected_name: submitted.name,
                    extracted_category: extracted.category || null,
                    corrected_category: submitted.category || null,
                    extracted_subcategory: extracted.subcategory || null,
                    corrected_subcategory: submitted.subcategory || null,
                    extracted_description: extracted.description || null,
                    corrected_description: submitted.description || null,
                    extracted_quantity: extracted.quantity || null,
                    corrected_quantity: submitted.quantity || null,
                    extracted_unit: extracted.unit || null,
                    corrected_unit: submitted.unit || null,
                    extracted_unit_price: extracted.unitPrice || null,
                    corrected_unit_price: submitted.unitPrice || null,
                    was_corrected: true,
                    correction_type: types.length > 1 ? 'multiple' : types[0] || 'other',
                    confidence_before: extracted.confidence || null,
                    confidence_after: 1.0, // User correction is 100% confident
                });
            }
        }

        // Store corrections in database
        if (corrections.length > 0) {
            const { error } = await supabase
                .from('product_extraction_corrections')
                .insert(corrections);

            if (error) {
                console.error('Error storing corrections:', error);
                return { success: false, capturedCount: 0, error: error.message };
            }

            console.log(`✅ Captured ${corrections.length} product corrections for learning`);
            return { success: true, capturedCount: corrections.length };
        }

        return { success: true, capturedCount: 0 };
    } catch (error: any) {
        console.error('Error in captureProductCorrections:', error);
        return { success: false, capturedCount: 0, error: error.message };
    }
}

/**
 * Fetch few-shot learning examples based on similarity to current product name
 * Uses PostgreSQL trigram similarity for fuzzy matching
 */
export async function getFewShotExamples(
    productName: string,
    options: {
        sellerId?: string;
        limit?: number;
        minSimilarity?: number;
    } = {}
): Promise<FewShotExample[]> {
    try {
        const supabase = getSupabaseClient();
        const { sellerId, limit = 5, minSimilarity = 0.3 } = options;

        // Build query with similarity search
        let query = supabase
            .from('product_extraction_corrections')
            .select('*')
            .order('created_at', { ascending: false });

        // Filter by seller if provided
        if (sellerId) {
            query = query.eq('seller_id', sellerId);
        }

        const { data, error } = await query.limit(limit * 3); // Fetch more for filtering

        if (error) {
            console.error('Error fetching few-shot examples:', error);
            return [];
        }

        if (!data || data.length === 0) {
            return [];
        }

        // Calculate similarity and filter
        const examples: FewShotExample[] = data
            .map((correction: any) => {
                // Simple similarity score (can be improved with actual trigram similarity)
                const similarity = calculateSimilarity(
                    productName.toLowerCase(),
                    correction.extracted_name.toLowerCase()
                );

                return {
                    extracted_name: correction.extracted_name,
                    corrected_name: correction.corrected_name,
                    extracted_category: correction.extracted_category || undefined,
                    corrected_category: correction.corrected_category || undefined,
                    extracted_subcategory: correction.extracted_subcategory || undefined,
                    corrected_subcategory: correction.corrected_subcategory || undefined,
                    extracted_description: correction.extracted_description || undefined,
                    corrected_description: correction.corrected_description || undefined,
                    pattern_note: generatePatternNote(correction),
                    similarity_score: similarity,
                };
            })
            .filter((ex: FewShotExample) => ex.similarity_score >= minSimilarity)
            .sort((a: FewShotExample, b: FewShotExample) => b.similarity_score - a.similarity_score)
            .slice(0, limit);

        return examples;
    } catch (error) {
        console.error('Error in getFewShotExamples:', error);
        return [];
    }
}

/**
 * Build learning prompt section with few-shot examples
 */
export function buildLearningPrompt(examples: FewShotExample[]): string {
    if (examples.length === 0) {
        return '';
    }

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 LEARN FROM PAST CORRECTIONS (${examples.length} examples)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The user has previously corrected your extractions. Apply these learnings:

${examples.map((ex: FewShotExample, i: number) => `
Example ${i + 1}: (Similarity: ${(ex.similarity_score * 100).toFixed(0)}%)
  ❌ You extracted: "${ex.extracted_name}"
     ${ex.extracted_category ? `Category: "${ex.extracted_category}" → Subcategory: "${ex.extracted_subcategory}"` : ''}
     ${ex.extracted_description ? `Description: "${ex.extracted_description}"` : ''}
     
  ✅ User corrected to: "${ex.corrected_name}"
     ${ex.corrected_category ? `Category: "${ex.corrected_category}" → Subcategory: "${ex.corrected_subcategory}"` : ''}
     ${ex.corrected_description ? `Description: "${ex.corrected_description}"` : ''}
     
  📝 Pattern: ${ex.pattern_note}
`).join('\n')}

⚠️ Apply these correction patterns to similar products in the current receipt!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}

// Helper: Calculate simple similarity score
function calculateSimilarity(str1: string, str2: string): number {
    // Simple word-based similarity (can be enhanced with Levenshtein distance)
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);

    const intersection = words1.filter(w => words2.includes(w));
    const union = Array.from(new Set([...words1, ...words2]));

    return intersection.length / union.length;
}

// Helper: Generate pattern note from correction
function generatePatternNote(correction: any): string {
    const notes: string[] = [];

    if (correction.extracted_name !== correction.corrected_name) {
        notes.push('Name expanded/clarified');
    }
    if (correction.extracted_category !== correction.corrected_category) {
        notes.push('Category corrected');
    }
    if (correction.extracted_description !== correction.corrected_description) {
        notes.push('Description improved');
    }

    return notes.join(', ') || 'General correction';
}
