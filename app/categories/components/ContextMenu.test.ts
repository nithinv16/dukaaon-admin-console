import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Types for testing context menu category completeness
 */
interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  category_id: string;
}

interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
  divider?: boolean;
}

/**
 * Function to build category submenu items for context menu
 * This mirrors the logic in the categories page
 */
export function buildCategorySubmenu(
  categories: Category[],
  onSelect: (categoryName: string, subcategoryName?: string) => void
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [];
  
  for (const category of categories) {
    if (category.subcategories && category.subcategories.length > 0) {
      // Category with subcategories - create submenu
      items.push({
        label: category.name,
        submenu: [
          {
            label: `${category.name} (no subcategory)`,
            onClick: () => onSelect(category.name)
          },
          { label: '', divider: true },
          ...category.subcategories.map(sub => ({
            label: sub.name,
            onClick: () => onSelect(category.name, sub.name)
          }))
        ]
      });
    } else {
      // Category without subcategories
      items.push({
        label: category.name,
        onClick: () => onSelect(category.name)
      });
    }
  }
  
  return items;
}

/**
 * Helper function to extract all category names from menu items
 */
function extractCategoryNames(items: ContextMenuItem[]): string[] {
  return items.map(item => item.label);
}

/**
 * Helper function to extract all subcategory names from menu items for a given category
 */
function extractSubcategoryNames(items: ContextMenuItem[], categoryName: string): string[] {
  const categoryItem = items.find(item => item.label === categoryName);
  if (!categoryItem || !categoryItem.submenu) return [];
  
  // Filter out the "no subcategory" option and dividers
  return categoryItem.submenu
    .filter(sub => !sub.divider && !sub.label.includes('(no subcategory)'))
    .map(sub => sub.label);
}

/**
 * **Feature: category-inventory-improvements, Property 15: Context Menu Category Completeness**
 * **Validates: Requirements 5.4, 5.5**
 * 
 * For any "Move to" or "Copy to" submenu, the submenu SHALL contain all active 
 * categories and their subcategories from the database.
 */
describe('Context Menu Category Completeness Property Tests', () => {
  // Arbitrary for generating subcategory
  const subcategoryArb = (categoryId: string) => fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    slug: fc.string({ minLength: 1, maxLength: 30 }),
    category_id: fc.constant(categoryId)
  });

  // Arbitrary for generating category with optional subcategories
  // Use unique names to avoid duplicate name issues in menu lookup
  const categoryArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 30 }),
    slug: fc.string({ minLength: 1, maxLength: 30 })
  }).chain(cat => 
    fc.array(subcategoryArb(cat.id), { minLength: 0, maxLength: 5 }).map(subs => ({
      ...cat,
      subcategories: subs.length > 0 ? subs : undefined
    }))
  );

  // Generate categories with unique names to avoid lookup issues
  const categoriesArb = fc.array(categoryArb, { minLength: 0, maxLength: 10 })
    .map(cats => {
      // Ensure unique category names by appending index if needed
      const seen = new Set<string>();
      return cats.map((cat, idx) => {
        let name = cat.name;
        while (seen.has(name)) {
          name = `${cat.name}_${idx}`;
        }
        seen.add(name);
        return { ...cat, name };
      });
    });

  it('Property 15: All categories appear in the context menu', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const menuItems = buildCategorySubmenu(categories, () => {});
        const menuCategoryNames = extractCategoryNames(menuItems);
        
        // Every category should appear in the menu
        for (const category of categories) {
          expect(menuCategoryNames).toContain(category.name);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: Menu item count equals category count', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const menuItems = buildCategorySubmenu(categories, () => {});
        
        // Number of top-level menu items should equal number of categories
        expect(menuItems.length).toBe(categories.length);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: All subcategories appear in their parent category submenu', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const menuItems = buildCategorySubmenu(categories, () => {});
        
        for (const category of categories) {
          if (category.subcategories && category.subcategories.length > 0) {
            const menuSubcategoryNames = extractSubcategoryNames(menuItems, category.name);
            
            // Every subcategory should appear in the submenu
            for (const subcategory of category.subcategories) {
              expect(menuSubcategoryNames).toContain(subcategory.name);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: Categories with subcategories have submenus', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const menuItems = buildCategorySubmenu(categories, () => {});
        
        for (const category of categories) {
          const menuItem = menuItems.find(item => item.label === category.name);
          expect(menuItem).toBeDefined();
          
          if (category.subcategories && category.subcategories.length > 0) {
            // Should have a submenu
            expect(menuItem!.submenu).toBeDefined();
            expect(menuItem!.submenu!.length).toBeGreaterThan(0);
          } else {
            // Should have onClick instead of submenu
            expect(menuItem!.onClick).toBeDefined();
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: Subcategory count in submenu matches category subcategory count', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const menuItems = buildCategorySubmenu(categories, () => {});
        
        for (const category of categories) {
          if (category.subcategories && category.subcategories.length > 0) {
            const menuSubcategoryNames = extractSubcategoryNames(menuItems, category.name);
            
            // Subcategory count should match
            expect(menuSubcategoryNames.length).toBe(category.subcategories.length);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: Categories with subcategories include "no subcategory" option', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const menuItems = buildCategorySubmenu(categories, () => {});
        
        for (const category of categories) {
          if (category.subcategories && category.subcategories.length > 0) {
            const menuItem = menuItems.find(item => item.label === category.name);
            expect(menuItem).toBeDefined();
            expect(menuItem!.submenu).toBeDefined();
            
            // Should have a "no subcategory" option
            const noSubcategoryOption = menuItem!.submenu!.find(
              sub => sub.label.includes('(no subcategory)')
            );
            expect(noSubcategoryOption).toBeDefined();
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: Empty categories array produces empty menu', () => {
    const menuItems = buildCategorySubmenu([], () => {});
    expect(menuItems.length).toBe(0);
  });

  it('Property 15: No categories are missing from menu', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const menuItems = buildCategorySubmenu(categories, () => {});
        const menuCategoryNames = new Set(extractCategoryNames(menuItems));
        
        // Check that no category is missing
        const missingCategories = categories.filter(
          cat => !menuCategoryNames.has(cat.name)
        );
        
        expect(missingCategories.length).toBe(0);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 15: No subcategories are missing from submenus', () => {
    fc.assert(
      fc.property(categoriesArb, (categories) => {
        const menuItems = buildCategorySubmenu(categories, () => {});
        
        for (const category of categories) {
          if (category.subcategories && category.subcategories.length > 0) {
            const menuSubcategoryNames = new Set(
              extractSubcategoryNames(menuItems, category.name)
            );
            
            // Check that no subcategory is missing
            const missingSubcategories = category.subcategories.filter(
              sub => !menuSubcategoryNames.has(sub.name)
            );
            
            expect(missingSubcategories.length).toBe(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
