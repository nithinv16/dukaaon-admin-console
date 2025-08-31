// Shared category management utilities

export interface CategorySubcategoryMap {
  [category: string]: string[];
}

// Default category-subcategory mapping
export const defaultCategorySubcategoryMap: CategorySubcategoryMap = {
  'electronics': ['smartphones', 'laptops', 'tablets', 'headphones', 'cameras'],
  'clothing': ["men's wear", "women's wear", 'shoes', 'accessories'],
  'home & garden': ['furniture', 'decor', 'garden tools', 'lighting'],
  'home care': [
    'laundry detergent',
    'laundry detergent bar',
    'fabric softener',
    'dishwashing liquid',
    'floor cleaner',
    'dishwash'
  ],
  'personal care': [
    'soap',
    'handwash',
    'body wash',
    'shampoo',
    'conditioner',
    'toothpaste',
    'toothbrush',
    'face wash',
    'moisturizer',
    'deodorant',
    'perfume',
    'lotion',
    'face cream',
    'talcum powder',
    'body lotion'
  ],
  'beauty & cosmetics': [
    'face cream',
    'eye makeup',
    'lip care',
    'foundation',
    'mascara',
    'lipstick',
    'nail polish'
  ],
  'foods & beverages': [
    'snacks',
    'beverages',
    'dairy',
    'frozen foods',
    'canned goods',
    'bakery',
    'meat',
    'seafood',
    'fruits',
    'vegetables'
  ]
};

// Function to merge new categories with existing ones
export const mergeCategoriesFromCsv = (
  existingMap: CategorySubcategoryMap,
  csvData: any[]
): {
  updatedMap: CategorySubcategoryMap;
  newCategories: string[];
  newSubcategories: number;
} => {
  const newCategoriesMap: CategorySubcategoryMap = {};
  
  // Collect all categories and subcategories from CSV
  csvData.forEach((row) => {
    if (row.category) {
      const category = row.category.toLowerCase().trim();
      if (!newCategoriesMap[category]) {
        newCategoriesMap[category] = [];
      }
      
      if (row.subcategory) {
        const subcategory = row.subcategory.toLowerCase().trim();
        if (!newCategoriesMap[category].includes(subcategory)) {
          newCategoriesMap[category].push(subcategory);
        }
      }
    }
  });
  
  // Check for new categories/subcategories before merging
  const newCategories = Object.keys(newCategoriesMap).filter(cat => 
    !existingMap[cat]
  );
  
  const newSubcategories = Object.keys(newCategoriesMap).reduce((acc, cat) => {
    const existingSubcategories = existingMap[cat] || [];
    const newSubs = newCategoriesMap[cat].filter(sub => 
      !existingSubcategories.includes(sub)
    );
    return acc + newSubs.length;
  }, 0);
  
  // Create updated map
  const updatedMap = { ...existingMap };
  
  Object.keys(newCategoriesMap).forEach(category => {
    if (!updatedMap[category]) {
      updatedMap[category] = [];
    }
    
    newCategoriesMap[category].forEach(subcategory => {
      if (!updatedMap[category].includes(subcategory)) {
        updatedMap[category].push(subcategory);
      }
    });
  });
  
  return {
    updatedMap,
    newCategories,
    newSubcategories
  };
};

// Function to generate mock category data from category map
export const generateMockCategoryData = (categoryMap: CategorySubcategoryMap) => {
  const categories = Object.keys(categoryMap).map((categoryName, index) => {
    const subcategories = categoryMap[categoryName].map((subName, subIndex) => ({
      id: `${index + 1}-${subIndex + 1}`,
      name: subName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      description: `${subName.charAt(0).toUpperCase() + subName.slice(1)} products`,
      parent_id: `${index + 1}`,
      status: 'active' as const,
      product_count: Math.floor(Math.random() * 50) + 10,
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    }));
    
    return {
      id: `${index + 1}`,
      name: categoryName.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' '),
      description: `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} products and accessories`,
      status: 'active' as const,
      product_count: subcategories.reduce((sum, sub) => sum + sub.product_count, 0),
      created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      subcategories,
    };
  });
  
  return categories;
};

// Function to calculate category statistics
export const calculateCategoryStats = (categories: any[]) => {
  const totalCategories = categories.length;
  const activeCategories = categories.filter(cat => cat.status === 'active').length;
  const totalSubcategories = categories.reduce((sum, cat) => 
    sum + (cat.subcategories?.length || 0), 0
  );
  const totalProducts = categories.reduce((sum, cat) => sum + cat.product_count, 0);
  
  return {
    totalCategories,
    activeCategories,
    totalSubcategories,
    totalProducts,
  };
};