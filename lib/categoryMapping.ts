/**
 * Category Mapping Helper for AI Extraction
 * 
 * Enables AI to automatically map extracted products to correct categories and subcategories
 * from the database, with automatic creation of new categories when needed.
 */

import { adminQueries } from './supabase-browser';

export interface CategoryData {
    categories: Array<{ id: string; name: string }>;
    subcategories: Array<{ id: string; category_id: string; name: string }>;
}

export interface ProductWithCategory {
    name: string;
    category?: string;
    subcategory?: string;
    [key: string]: any;
}

/**
 * Fetch all available categories and subcategories from database
 */
export async function getAvailableCategoriesForAI(): Promise<{
    data: CategoryData | null;
    formattedPrompt: string;
}> {
    try {
        const data = await adminQueries.getCategories();

        if (!data || !data.categories) {
            console.warn('⚠️ No categories found in database');
            return { data: null, formattedPrompt: '' };
        }

        console.log(`📂 Loaded ${data.categories.length} categories and ${data.subcategories.length} subcategories for AI`);
        console.log('Categories:', data.categories.map(c => c.name).join(', '));

        const formattedPrompt = formatCategoriesForPrompt(data);
        console.log('📋 Formatted prompt preview:', formattedPrompt.substring(0, 300));

        return { data, formattedPrompt };
    } catch (error) {
        console.error('❌ Error fetching categories for AI:', error);
        return { data: null, formattedPrompt: '' };
    }
}

/**
 * Format categories and subcategories for AI prompt
 */
export function formatCategoriesForPrompt(data: CategoryData): string {
    if (!data.categories || data.categories.length === 0) {
        return 'No categories available in database.';
    }

    const categoriesWithSubs = data.categories.map(category => {
        const subs = data.subcategories
            .filter(sub => sub.category_id === category.id)
            .map(sub => `   └─ ${sub.name}`)
            .join('\n');

        return `${category.name}${subs ? '\n' + subs : ''}`;
    });

    return `
AVAILABLE CATEGORIES & SUBCATEGORIES (Total: ${data.categories.length} categories, ${data.subcategories.length} subcategories):

${categoriesWithSubs.map((cat, i) => `${i + 1}. ${cat}`).join('\n\n')}
`.trim();
}

/**
 * Calculate similarity between two strings (0-1 score)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    // Exact match
    if (s1 === s2) return 1.0;

    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) return 0.8;

    // Word-based similarity
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    const commonWords = words1.filter(w => words2.includes(w));

    if (commonWords.length > 0) {
        return commonWords.length / Math.max(words1.length, words2.length);
    }

    // Character-based similarity
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    let matches = 0;
    const minLen = Math.min(s1.length, s2.length);
    for (let i = 0; i < minLen; i++) {
        if (s1[i] === s2[i]) matches++;
    }

    return matches / maxLen;
}

/**
 * Validate and correct category mappings after AI extraction
 * Auto-creates missing categories/subcategories with fuzzy matching
 */
export async function validateAndCorrectCategories<T extends ProductWithCategory>(
    products: T[]
): Promise<T[]> {
    try {
        const dbCategories = await adminQueries.getCategories();

        if (!dbCategories) {
            console.warn('Could not load categories for validation');
            return products;
        }

        for (const product of products) {
            if (!product.category) continue;

            // Try exact match first
            let category = dbCategories.categories.find(
                c => c.name.toLowerCase().trim() === product.category?.toLowerCase().trim()
            );

            // If no exact match, try fuzzy matching
            if (!category) {
                const similarities = dbCategories.categories.map(c => ({
                    category: c,
                    score: calculateStringSimilarity(c.name, product.category!)
                }));

                // Sort by similarity
                similarities.sort((a, b) => b.score - a.score);

                // Use best match if similarity > 0.6 (60%)
                if (similarities[0] && similarities[0].score > 0.6) {
                    category = similarities[0].category;
                    console.log(`📍 Fuzzy matched "${product.category}" → "${category.name}" (${(similarities[0].score * 100).toFixed(0)}% similarity)`);
                    product.category = category.name;
                }
            }

            // If still no match, create new category
            if (!category && product.category) {
                console.log(`➕ Creating new category: ${product.category}`);
                const result = await adminQueries.createCategory(product.category.trim());

                if (result.success && result.data) {
                    category = result.data as { id: string; name: string };
                    // Update local cache
                    dbCategories.categories.push(category);
                    product.category = category.name;
                }
            } else {
                // Ensure consistent casing
                product.category = category.name;
            }

            // Find or create subcategory
            if (product.subcategory && category) {
                // Try exact match first
                let subcategory = dbCategories.subcategories.find(
                    s => s.name.toLowerCase().trim() === product.subcategory?.toLowerCase().trim()
                        && s.category_id === category!.id
                );

                // If no exact match, try fuzzy matching within this category
                if (!subcategory) {
                    const categorySubs = dbCategories.subcategories.filter(s => s.category_id === category!.id);
                    const similarities = categorySubs.map(s => ({
                        subcategory: s,
                        score: calculateStringSimilarity(s.name, product.subcategory!)
                    }));

                    similarities.sort((a, b) => b.score - a.score);

                    // Use best match if similarity > 0.6 (60%)
                    if (similarities[0] && similarities[0].score > 0.6) {
                        subcategory = similarities[0].subcategory;
                        console.log(`📍 Fuzzy matched "${product.subcategory}" → "${subcategory.name}" (${(similarities[0].score * 100).toFixed(0)}% similarity)`);
                        product.subcategory = subcategory.name;
                    }
                }

                // If still no match, create new subcategory
                if (!subcategory && product.subcategory) {
                    console.log(`➕ Creating new subcategory: ${product.subcategory} under ${category.name}`);
                    const result = await adminQueries.createSubcategory(
                        product.subcategory.trim(),
                        category.id
                    );

                    if (result.success && result.data) {
                        subcategory = result.data as { id: string; category_id: string; name: string };
                        // Update local cache
                        dbCategories.subcategories.push(subcategory);
                        product.subcategory = subcategory.name;
                    }
                } else {
                    // Ensure consistent casing
                    product.subcategory = subcategory.name;
                }
            }
        }

        return products;
    } catch (error) {
        console.error('Error validating categories:', error);
        return products; // Return original products if validation fails
    }
}

/**
 * Build category mapping section for AI prompt
 */
export function buildCategoryMappingPrompt(formattedCategories: string): string {
    if (!formattedCategories) {
        return '';
    }

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📂 CATEGORY & SUBCATEGORY MAPPING (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${formattedCategories}

🎯 FOR EACH PRODUCT, MAP TO THE MOST APPROPRIATE CATEGORY & SUBCATEGORY:

⚠️ CRITICAL RULES:
  1. Use EXACT category/subcategory names from the list above
  2. Copy names EXACTLY as written (including spaces, capitalization, punctuation)
  3. DO NOT create variations or shortened forms
  4. If unsure between two categories, pick the closest match from the list
  
❌ WRONG Examples:
  • "Confectionery" when list has "Sweets & Confectionaries"
  • "Chocolate" when list has "Chocolates"  
  • "Biscuit" when list has "Biscuits"
  
✅ CORRECT Examples:
  Product: "Cadbury Dairy Milk 40G"
  → category: "Sweets & Confectionaries" (exact from list)
  → subcategory: "Chocolates" (exact from list)
  
  Product: "Parle-G Biscuits 100G"
  → category: "Biscuits" (exact from list)
  → subcategory: "Parle-G" (exact from list)

💡 If a product truly doesn't fit any existing category:
  • Only then create a new descriptive category name
  • This should be rare - try to fit products into existing categories first

⚠️ IMPORTANT: Include "category" and "subcategory" in EVERY product's JSON output!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
}
