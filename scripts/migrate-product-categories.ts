/**
 * Migration Script: Backfill category_id and subcategory_id for existing products
 * 
 * This script updates all products that have category/subcategory text fields
 * but are missing the corresponding category_id/subcategory_id foreign keys.
 * 
 * Usage:
 *   npx tsx scripts/migrate-product-categories.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper function to generate slug from name
function generateSlug(name: string, existingSlugs: string[] = []): string {
    let slug = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (existingSlugs.includes(slug)) {
        let counter = 1;
        let newSlug = `${slug}-${counter}`;
        while (existingSlugs.includes(newSlug)) {
            counter++;
            newSlug = `${slug}-${counter}`;
        }
        return newSlug;
    }

    return slug;
}

// Get or create category and subcategory IDs
async function getCategoryAndSubcategoryIds(
    categoryName: string,
    subcategoryName?: string
): Promise<{ category_id: string | null; subcategory_id: string | null }> {
    let categoryId: string | null = null;
    let subcategoryId: string | null = null;

    // Get category ID by name (case-insensitive)
    if (categoryName && categoryName.trim()) {
        const normalizedCategoryName = categoryName.trim();

        const { data: categoryData, error: categoryError } = await supabase
            .from('categories')
            .select('id')
            .ilike('name', normalizedCategoryName)
            .limit(1)
            .maybeSingle();

        if (!categoryError && categoryData) {
            categoryId = categoryData.id;
            console.log(`  ✓ Found existing category "${categoryName}" (ID: ${categoryId})`);
        } else if (categoryError) {
            console.warn(`  ⚠ Error finding category "${categoryName}":`, categoryError.message);
        } else {
            // Category not found, create it
            console.log(`  → Creating new category "${categoryName}"...`);

            const { data: existingCategories } = await supabase
                .from('categories')
                .select('slug');

            const existingSlugs = (existingCategories || []).map((cat: any) => cat.slug);
            const newSlug = generateSlug(normalizedCategoryName, existingSlugs);

            const { data: newCategory, error: insertError } = await supabase
                .from('categories')
                .insert({
                    name: normalizedCategoryName,
                    slug: newSlug,
                    description: `Auto-created category for ${normalizedCategoryName}`,
                    is_active: true
                })
                .select('id')
                .single();

            if (insertError) {
                if (insertError.code === '23505') {
                    // Race condition - fetch existing
                    const { data: existingCategory } = await supabase
                        .from('categories')
                        .select('id')
                        .ilike('name', normalizedCategoryName)
                        .limit(1)
                        .maybeSingle();

                    if (existingCategory) {
                        categoryId = existingCategory.id;
                        console.log(`  ✓ Using existing category "${categoryName}" (ID: ${categoryId})`);
                    }
                } else {
                    console.error(`  ✗ Error creating category "${categoryName}":`, insertError);
                }
            } else if (newCategory) {
                categoryId = newCategory.id;
                console.log(`  ✓ Created new category "${categoryName}" (ID: ${categoryId})`);
            }
        }
    }

    // Get subcategory ID by name and category_id (case-insensitive)
    if (subcategoryName && subcategoryName.trim() && categoryId) {
        const normalizedSubcategoryName = subcategoryName.trim();

        const { data: subcategoryData, error: subcategoryError } = await supabase
            .from('subcategories')
            .select('id')
            .eq('category_id', categoryId)
            .ilike('name', normalizedSubcategoryName)
            .limit(1)
            .maybeSingle();

        if (!subcategoryError && subcategoryData) {
            subcategoryId = subcategoryData.id;
            console.log(`  ✓ Found existing subcategory "${subcategoryName}" (ID: ${subcategoryId})`);
        } else if (subcategoryError) {
            console.warn(`  ⚠ Error finding subcategory "${subcategoryName}":`, subcategoryError.message);
        } else {
            // Subcategory not found, create it
            console.log(`  → Creating new subcategory "${subcategoryName}"...`);

            const { data: existingSubcategories } = await supabase
                .from('subcategories')
                .select('slug')
                .eq('category_id', categoryId);

            const existingSlugs = (existingSubcategories || []).map((sub: any) => sub.slug);
            const newSlug = generateSlug(normalizedSubcategoryName, existingSlugs);

            const { data: newSubcategory, error: insertError } = await supabase
                .from('subcategories')
                .insert({
                    category_id: categoryId,
                    name: normalizedSubcategoryName,
                    slug: newSlug,
                    description: `Auto-created subcategory for ${normalizedSubcategoryName}`,
                    is_active: true
                })
                .select('id')
                .single();

            if (insertError) {
                if (insertError.code === '23505') {
                    // Race condition - fetch existing
                    const { data: existingSubcategory } = await supabase
                        .from('subcategories')
                        .select('id')
                        .eq('category_id', categoryId)
                        .ilike('name', normalizedSubcategoryName)
                        .limit(1)
                        .maybeSingle();

                    if (existingSubcategory) {
                        subcategoryId = existingSubcategory.id;
                        console.log(`  ✓ Using existing subcategory "${subcategoryName}" (ID: ${subcategoryId})`);
                    }
                } else {
                    console.error(`  ✗ Error creating subcategory "${subcategoryName}":`, insertError);
                }
            } else if (newSubcategory) {
                subcategoryId = newSubcategory.id;
                console.log(`  ✓ Created new subcategory "${subcategoryName}" (ID: ${subcategoryId})`);
            }
        }
    }

    return { category_id: categoryId, subcategory_id: subcategoryId };
}

// Main migration function
async function migrateProductCategories() {
    console.log('🔄 Starting product category migration...\n');

    try {
        // Fetch all products that need migration
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, category, subcategory, category_id, subcategory_id')
            .or('category_id.is.null,subcategory_id.is.null')
            .not('category', 'is', null);

        if (error) {
            throw error;
        }

        if (!products || products.length === 0) {
            console.log('✅ No products need migration. All products already have category_id and subcategory_id set.');
            return;
        }

        console.log(`📦 Found ${products.length} product(s) that need migration\n`);

        let updatedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            console.log(`\n[${i + 1}/${products.length}] Processing: "${product.name}"`);
            console.log(`  Category: "${product.category}"${product.subcategory ? `, Subcategory: "${product.subcategory}"` : ''}`);

            try {
                // Get or create category and subcategory IDs
                const { category_id, subcategory_id } = await getCategoryAndSubcategoryIds(
                    product.category,
                    product.subcategory
                );

                // Update the product
                const updateData: any = {};

                if (category_id && !product.category_id) {
                    updateData.category_id = category_id;
                }

                if (subcategory_id && !product.subcategory_id) {
                    updateData.subcategory_id = subcategory_id;
                }

                if (Object.keys(updateData).length > 0) {
                    const { error: updateError } = await supabase
                        .from('products')
                        .update(updateData)
                        .eq('id', product.id);

                    if (updateError) {
                        console.error(`  ✗ Error updating product:`, updateError);
                        errorCount++;
                    } else {
                        console.log(`  ✓ Updated product with category_id: ${category_id}, subcategory_id: ${subcategory_id}`);
                        updatedCount++;
                    }
                } else {
                    console.log(`  → No updates needed for this product`);
                }
            } catch (err) {
                console.error(`  ✗ Error processing product:`, err);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`   Total products processed: ${products.length}`);
        console.log(`   ✅ Successfully updated: ${updatedCount}`);
        console.log(`   ✗ Errors: ${errorCount}`);
        console.log('='.repeat(60));

        if (errorCount === 0) {
            console.log('\n✅ Migration completed successfully!');
        } else {
            console.log(`\n⚠️  Migration completed with ${errorCount} error(s). Please review the logs above.`);
        }
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
migrateProductCategories()
    .then(() => {
        console.log('\n✨ Migration script finished.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
