# Design Document

## Overview

This design document outlines the technical implementation for three improvements to the admin console:
1. Database-driven category selection across all product-related screens
2. Performance optimization for the ExtractedProductEditor dialog
3. Bulk import feature for seller inventory with Excel/CSV/image support

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend Components"
        A[Products Page] --> D[CategorySelector Component]
        B[Add From Master Page] --> D
        C[ExtractedProductEditor] --> D
        E[Seller Inventory Page] --> F[BulkImportDialog]
        F --> G[BulkImportPreview]
    end
    
    subgraph "API Layer"
        D --> H[/api/admin/categories]
        F --> I[/api/admin/bulk/import]
        G --> J[/api/admin/products]
    end
    
    subgraph "Services"
        I --> K[FileParserService]
        I --> L[AWS Textract OCR]
        G --> M[ImageSearcher]
        G --> N[CategoryMatcher]
    end
    
    subgraph "Database"
        H --> O[(categories)]
        H --> P[(subcategories)]
        J --> Q[(products)]
    end
```

### Component Architecture

```mermaid
graph LR
    subgraph "Shared Components"
        CS[CategorySelector]
        CS --> |fetches| API[Categories API]
        CS --> |caches| Cache[React Query Cache]
    end
    
    subgraph "Bulk Import Flow"
        BI[BulkImportDialog] --> |file| FP[FileParser]
        BI --> |image| OCR[AWS Textract]
        FP --> Preview[BulkImportPreview]
        OCR --> Preview
        Preview --> |auto-tag| CM[CategoryMatcher]
        Preview --> |fetch images| IS[ImageSearcher]
    end
```

## Components and Interfaces

### 1. CategorySelector Component

A reusable component for database-driven category/subcategory selection.

```typescript
interface CategorySelectorProps {
  value: { category: string; subcategory: string };
  onChange: (value: { category: string; subcategory: string }) => void;
  allowNew?: boolean;
  size?: 'small' | 'medium';
  disabled?: boolean;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
}
```

### 2. Categories API Route

```typescript
// GET /api/admin/categories
interface GetCategoriesResponse {
  categories: Category[];
  subcategories: Subcategory[];
}

// POST /api/admin/categories
interface CreateCategoryRequest {
  name: string;
  type: 'category' | 'subcategory';
  category_id?: string; // Required for subcategory
}

interface CreateCategoryResponse {
  success: boolean;
  data?: Category | Subcategory;
  error?: string;
}
```

### 3. BulkImportDialog Component

```typescript
interface BulkImportDialogProps {
  open: boolean;
  onClose: () => void;
  sellerId: string;
  onImportComplete: (results: ImportResult) => void;
}

interface ParsedProduct {
  name: string;
  price: number;
  min_order_quantity: number;
  description?: string;
  category?: string;
  subcategory?: string;
  imageUrl?: string;
  stock_level: number; // Default 100
}

interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{ product: string; error: string }>;
}
```

### 4. BulkImportPreview Component

```typescript
interface BulkImportPreviewProps {
  products: ParsedProduct[];
  sellerId: string;
  onConfirm: (products: ParsedProduct[]) => Promise<void>;
  onCancel: () => void;
  categories: Category[];
  subcategories: Subcategory[];
}
```

### 5. File Parser Service

```typescript
interface FileParserService {
  parseExcel(file: File): Promise<ParsedProduct[]>;
  parseCSV(file: File): Promise<ParsedProduct[]>;
  parseImage(file: File): Promise<ParsedProduct[]>;
}
```

### 6. Category Matcher Service

```typescript
interface CategoryMatcherService {
  matchCategory(productName: string, categories: Category[]): Category | null;
  matchSubcategory(
    productName: string, 
    categoryId: string, 
    subcategories: Subcategory[]
  ): Subcategory | null;
}
```

### 7. Product Selection Toolbar Component

```typescript
interface ProductSelectionToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onMove: (categoryId: string, subcategoryId?: string) => Promise<void>;
  onCopy: (categoryId: string, subcategoryId?: string) => Promise<void>;
  categories: Category[];
  subcategories: Subcategory[];
}
```

### 8. Uncategorized Products Section

```typescript
interface UncategorizedProduct {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  stock_available: number;
  previous_category?: string;
  previous_subcategory?: string;
}

interface UncategorizedSectionProps {
  products: UncategorizedProduct[];
  onDragStart: (productId: string) => void;
  onAssignCategory: (productIds: string[], category: string, subcategory?: string) => Promise<void>;
}
```

### 9. Category Deletion Service

```typescript
interface CategoryDeletionService {
  deleteCategory(categoryId: string): Promise<{ 
    success: boolean; 
    orphanedProducts: number;
  }>;
  deleteSubcategory(subcategoryId: string): Promise<{ 
    success: boolean; 
    orphanedProducts: number;
  }>;
}
```

### 10. Bulk Product Operations API

```typescript
// POST /api/admin/products/bulk-move
interface BulkMoveRequest {
  productIds: string[];
  targetCategory: string;
  targetSubcategory?: string;
}

interface BulkMoveResponse {
  success: boolean;
  movedCount: number;
  failedProducts: Array<{ id: string; error: string }>;
}

// POST /api/admin/products/bulk-copy
interface BulkCopyRequest {
  productIds: string[];
  targetCategory: string;
  targetSubcategory?: string;
}

interface BulkCopyResponse {
  success: boolean;
  copiedCount: number;
  failedProducts: Array<{ id: string; error: string }>;
}

## Data Models

### Database Tables

```sql
-- Existing categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE
);

-- Existing subcategories table
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  UNIQUE(category_id, slug)
);
```

### Expected File Formats

**CSV Format:**
```csv
product_name,price,min_order_quantity
Product A,100.00,5
Product B,250.50,10
```

**Excel Format:**
Same columns as CSV, first row as headers.

**Image Format:**
Handwritten or printed list with product name, price, and quantity in tabular format.

</text>
</invoke>

## C
orrectness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Category Filtering Correctness
*For any* input string typed in the category field, the filtered results SHALL only contain categories whose names include the input string as a substring (case-insensitive), and SHALL NOT display incremental typing characters.
**Validates: Requirements 1.3**

### Property 2: Subcategory Filtering by Category
*For any* selected category, the subcategory dropdown SHALL only display subcategories where the `category_id` matches the selected category's `id`.
**Validates: Requirements 1.2**

### Property 3: Slug Generation Consistency
*For any* category or subcategory name, the generated slug SHALL be a lowercase, hyphen-separated version of the name with special characters removed, and SHALL be unique within its table.
**Validates: Requirements 1.5, 1.6**

### Property 4: Debounced State Updates
*For any* sequence of rapid text input events (within 100ms), the component SHALL batch these into a single state update rather than updating on each keystroke.
**Validates: Requirements 2.3**

### Property 5: CSV/Excel Parsing Round-Trip
*For any* valid CSV or Excel file with columns (product_name, price, min_order_quantity), parsing the file SHALL produce an array of ParsedProduct objects where each object's fields match the corresponding row values.
**Validates: Requirements 3.3**

### Property 6: Preview Completeness
*For any* set of extracted products, the preview page SHALL display all products with editable fields for: name, price, min_order_quantity, image, description, category, subcategory, and stock_level (defaulting to 100).
**Validates: Requirements 3.5, 3.6**

### Property 7: Category Auto-Matching
*For any* product name containing keywords that match existing category names, the auto-tag function SHALL assign the matching category and attempt to find a matching subcategory.
**Validates: Requirements 3.7**

### Property 8: Import Result Accuracy
*For any* bulk import operation, the result summary SHALL accurately report the count of successful imports plus failed imports equaling the total products attempted, and SHALL list specific errors for each failed product.
**Validates: Requirements 3.10, 3.11**

### Property 9: Partial Import Resilience
*For any* bulk import where some products fail validation, the system SHALL successfully import all valid products and continue processing after each failure.
**Validates: Requirements 3.9, 3.10**

### Property 10: Category Deletion Orphan Handling
*For any* category with products, when the category is deleted, all products from that category SHALL be moved to "Uncategorized" with null category and subcategory values.
**Validates: Requirements 4.1**

### Property 11: Subcategory Deletion Parent Preservation
*For any* subcategory with products, when the subcategory is deleted, all products SHALL retain their parent category assignment but have null subcategory values.
**Validates: Requirements 4.2**

### Property 12: Drag and Drop Uncategorized Products
*For any* product in the "Uncategorized" section, the product SHALL have functional drag handlers that allow it to be dropped into any category or subcategory.
**Validates: Requirements 4.5**

### Property 13: Delete Operation Count Accuracy
*For any* delete operation on a category or subcategory, the system SHALL recalculate and display accurate product counts for all affected categories after the operation completes.
**Validates: Requirements 4.8**

### Property 14: Selection Count Accuracy
*For any* set of selected products, the selection toolbar SHALL display a count that exactly matches the number of selected products.
**Validates: Requirements 5.2**

### Property 15: Context Menu Category Completeness
*For any* "Move to" or "Copy to" submenu, the submenu SHALL contain all active categories and their subcategories from the database.
**Validates: Requirements 5.4, 5.5**

### Property 16: Bulk Move Operation Correctness
*For any* set of selected products and target category/subcategory, after a move operation, all selected products SHALL have the target category and subcategory assignments and SHALL NOT appear in the original location.
**Validates: Requirements 5.6, 5.7**

### Property 17: Bulk Copy Operation Correctness
*For any* set of selected products and target category/subcategory, after a copy operation, the system SHALL create exact duplicates with the target category assignment while preserving the originals in their current location.
**Validates: Requirements 5.8, 5.9**

### Property 18: Multi-Product Operation Result Accuracy
*For any* bulk operation (move or copy), the success message SHALL display a count that equals the number of successfully processed products, and the failure list SHALL contain exactly those products that failed.
**Validates: Requirements 5.10, 5.11**

### Property 19: Clear Selection Completeness
*For any* selection state with one or more products selected, clicking "Clear Selection" SHALL result in zero products being selected.
**Validates: Requirements 5.12**

## Error Handling

### Category API Errors
- **Network Failure**: Display cached categories if available, show error toast, retry with exponential backoff
- **Empty Response**: Fall back to default category list from `categoryUtils.ts`
- **Invalid Data**: Log error, filter out invalid entries, continue with valid data

### File Parsing Errors
- **Invalid File Format**: Display clear error message indicating expected format
- **Missing Required Columns**: Highlight missing columns, allow user to map columns manually
- **Invalid Data Types**: Mark rows with errors, allow user to fix or skip

### OCR Extraction Errors
- **AWS Textract Failure**: Fall back to manual entry mode, display error message
- **Low Confidence Results**: Flag products with confidence < 0.7 for user review
- **No Products Found**: Suggest retaking photo with better lighting/angle

### Import Errors
- **Database Constraint Violation**: Log specific error, continue with next product
- **Duplicate Product**: Offer to update existing or skip
- **Invalid Seller**: Prevent import, require seller selection

### Category Deletion Errors
- **Category Has Subcategories**: Prevent deletion, display error message listing subcategories
- **Database Error During Orphan Migration**: Rollback deletion, display error, keep products in original category
- **Concurrent Modification**: Retry operation, refresh category list

### Bulk Product Operation Errors
- **Product Not Found**: Skip product, add to failed list with error message
- **Invalid Target Category**: Prevent operation, display error
- **Partial Failure**: Complete successful operations, display summary with failed products
- **Database Transaction Failure**: Rollback all changes, display error, maintain original state
- **Concurrent Product Modification**: Retry operation for affected products

## Testing Strategy

### Unit Testing
Unit tests will verify specific examples and edge cases:
- CategorySelector renders with empty categories
- CategorySelector filters categories correctly
- Slug generation handles special characters
- File parser handles empty files
- File parser handles malformed data
- Category matcher handles no matches

### Property-Based Testing
Property-based tests will use **fast-check** library to verify universal properties:

1. **Category Filtering Property Test**
   - Generate random category lists and search strings
   - Verify filtered results always match the search criteria
   - Verify no incremental characters appear

2. **Slug Generation Property Test**
   - Generate random category names
   - Verify slugs are always lowercase, hyphenated, and unique

3. **CSV Parsing Property Test**
   - Generate random valid CSV content
   - Verify parsing produces correct ParsedProduct objects

4. **Import Result Property Test**
   - Generate random product lists with some invalid entries
   - Verify result counts are accurate

### Integration Testing
- End-to-end test of category selection flow
- End-to-end test of bulk import flow
- Performance test of ExtractedProductEditor with 50+ products

### Test Configuration
- Property-based tests: minimum 100 iterations per property
- Each property test tagged with: `**Feature: category-inventory-improvements, Property {number}: {property_text}**`
