/**
 * Product Category Mapping
 * 
 * Comprehensive mapping of product keywords to categories and subcategories
 * for accurate AI-based categorization
 */

export interface ProductCategoryRule {
  keywords: string[];
  brands?: string[];
  category: string;
  subcategory: string;
  priority: number; // Higher priority rules are checked first
}

/**
 * Product category mapping rules
 * Priority: 1 (highest) to 10 (lowest)
 */
export const PRODUCT_CATEGORY_RULES: ProductCategoryRule[] = [
  // Biscuits & Cookies (Priority 1-2)
  {
    keywords: ['biscuit', 'biscuits', 'cookie', 'cookies', 'choco bakes', 'bourbon', 'cream biscuit', 'digestive', 'marie', 'glucose'],
    brands: ['Unibic', 'Parle', 'Britannia', 'Cadbury', 'Sunfeast', 'Malkist', 'Bournvita', 'Horlicks'],
    category: 'Food',
    subcategory: 'Biscuits & Cookies',
    priority: 1
  },
  
  // Breakfast Cereals (Priority 2)
  {
    keywords: ['chocos', 'cornflakes', 'cereal', 'muesli', 'oats', 'breakfast'],
    brands: ['Kellogg\'s', 'Quaker', 'Bagrry\'s'],
    category: 'Food',
    subcategory: 'Breakfast Cereals',
    priority: 2
  },
  
  // Instant Food/Noodles (Priority 2)
  {
    keywords: ['maggi', 'noodles', 'pasta', 'instant', 'yippee', 'top ramen'],
    brands: ['Maggi', 'Nestle', 'Yippee', 'Top Ramen'],
    category: 'Food',
    subcategory: 'Instant Food',
    priority: 2
  },
  
  // Dairy Products (Priority 2)
  {
    keywords: ['milk', 'cream', 'butter', 'ghee', 'cheese', 'paneer', 'curd', 'yogurt', 'whitener', 'dairy'],
    brands: ['Amul', 'Amulya', 'Mother Dairy', 'Nestle', 'Britannia'],
    category: 'Dairy',
    subcategory: 'Dairy Products',
    priority: 2
  },
  
  // Bath Soaps (Priority 1)
  {
    keywords: ['soap', 'bathing bar', 'bath soap', 'body soap'],
    brands: ['Lux', 'Dove', 'Pears', 'Lifebuoy', 'Santoor', 'Chandrika', 'Vivel', 'Medimix', 'Cutee', 'Fiama', 'Dettol'],
    category: 'Personal Care',
    subcategory: 'Bath Soaps',
    priority: 1
  },
  
  // Hair Care (Priority 2)
  {
    keywords: ['shampoo', 'conditioner', 'hair oil', 'hair dye', 'hair color', 'black rose'],
    brands: ['Pantene', 'Head & Shoulders', 'Dove', 'Clinic Plus', 'Parachute', 'Dabur'],
    category: 'Personal Care',
    subcategory: 'Hair Care',
    priority: 2
  },
  
  // Health & Hygiene (Priority 2)
  {
    keywords: ['dettol', 'antiseptic', 'sanitizer', 'hand wash', 'disinfectant'],
    brands: ['Dettol', 'Savlon', 'Lifebuoy'],
    category: 'Personal Care',
    subcategory: 'Health & Hygiene',
    priority: 2
  },
  
  // Home Care - Air Fresheners (Priority 1)
  {
    keywords: ['air freshener', 'room freshener', 'aer', 'odonil', 'ambi pur'],
    brands: ['Aer', 'Odonil', 'Ambi Pur'],
    category: 'Home Care',
    subcategory: 'Air Fresheners',
    priority: 1
  },
  
  // Home Care - Cleaning (Priority 3)
  {
    keywords: ['detergent', 'washing powder', 'liquid detergent', 'dishwash', 'floor cleaner', 'toilet cleaner', 'surf', 'rin', 'vim'],
    brands: ['Surf Excel', 'Ariel', 'Tide', 'Rin', 'Vim', 'Harpic', 'Lizol'],
    category: 'Home Care',
    subcategory: 'Cleaning Products',
    priority: 3
  },
  
  // Hardware - Adhesives (Priority 1)
  {
    keywords: ['m-seal', 'mseal', 'adhesive', 'glue', 'fevicol', 'epoxy'],
    brands: ['M-Seal', 'Fevicol', 'Pidilite'],
    category: 'Hardware',
    subcategory: 'Adhesives',
    priority: 1
  },
  
  // Pest Control (Priority 2)
  {
    keywords: ['mosquito', 'repellent', 'coil', 'liquid vaporizer', 'maxo', 'good knight', 'all out'],
    brands: ['Maxo', 'Good Knight', 'All Out', 'Mortein'],
    category: 'Home Care',
    subcategory: 'Pest Control',
    priority: 2
  },
  
  // Beverages (Priority 3)
  {
    keywords: ['tea', 'coffee', 'juice', 'cold drink', 'soft drink', 'water', 'beverage'],
    brands: ['Tata Tea', 'Lipton', 'Nescafe', 'Bru', 'Coca Cola', 'Pepsi', 'Real', 'Tropicana'],
    category: 'Beverages',
    subcategory: 'Hot Beverages',
    priority: 3
  },
  
  // Snacks (Priority 3)
  {
    keywords: ['chips', 'namkeen', 'mixture', 'bhujia', 'sev', 'snack', 'kurkure', 'lays'],
    brands: ['Lays', 'Kurkure', 'Haldiram\'s', 'Bikaji', 'Balaji'],
    category: 'Food',
    subcategory: 'Snacks',
    priority: 3
  },
  
  // Chocolates & Confectionery (Priority 3)
  {
    keywords: ['chocolate', 'candy', 'toffee', 'lollipop', 'chewing gum'],
    brands: ['Cadbury', 'Nestle', 'Amul', 'Ferrero', 'Mars'],
    category: 'Food',
    subcategory: 'Chocolates',
    priority: 3
  }
];

/**
 * Match a product name to a category rule
 */
export function matchProductToRule(productName: string): ProductCategoryRule | null {
  const nameLower = productName.toLowerCase();
  
  // Sort rules by priority (highest first)
  const sortedRules = [...PRODUCT_CATEGORY_RULES].sort((a, b) => a.priority - b.priority);
  
  for (const rule of sortedRules) {
    // Check if any keyword matches
    const keywordMatch = rule.keywords.some(keyword => nameLower.includes(keyword.toLowerCase()));
    
    // Check if brand matches (if brands are specified)
    const brandMatch = !rule.brands || rule.brands.some(brand => 
      nameLower.includes(brand.toLowerCase())
    );
    
    if (keywordMatch && brandMatch) {
      return rule;
    }
  }
  
  return null;
}

/**
 * Get category and subcategory for a product
 */
export function getCategoryForProduct(productName: string): {
  category: string;
  subcategory: string;
  confidence: number;
} | null {
  const rule = matchProductToRule(productName);
  
  if (rule) {
    // Higher priority rules get higher confidence
    const confidence = Math.max(0.7, 1 - (rule.priority * 0.05));
    
    return {
      category: rule.category,
      subcategory: rule.subcategory,
      confidence
    };
  }
  
  return null;
}

/**
 * Batch categorize products using rules
 */
export function batchCategorizeWithRules(productNames: string[]): Array<{
  productName: string;
  category: string;
  subcategory: string;
  confidence: number;
}> {
  return productNames.map(name => {
    const result = getCategoryForProduct(name);
    
    if (result) {
      return {
        productName: name,
        ...result
      };
    }
    
    return {
      productName: name,
      category: '',
      subcategory: '',
      confidence: 0
    };
  });
}
