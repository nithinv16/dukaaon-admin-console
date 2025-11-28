# Implementation Plan

- [x] 1. Create Categories API and Database Integration





  - [x] 1.1 Create API route for fetching categories and subcategories

    - Create `/api/admin/categories/route.ts` with GET handler
    - Query `categories` table and `subcategories` table from Supabase
    - Return structured response with both categories and subcategories
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Add POST handler for creating new categories/subcategories

    - Implement slug generation from name (lowercase, hyphenated)
    - Insert into appropriate table based on type parameter
    - Handle category_id for subcategories

    - _Requirements: 1.4, 1.5, 1.6_
  - [x] 1.3 Write property test for slug generation

    - **Property 3: Slug Generation Consistency**
    - **Validates: Requirements 1.5, 1.6**
  - [x] 1.4 Add category API methods to adminQueries in supabase-browser.ts


    - Add `getCategories()` method to fetch from API
    - Add `createCategory()` method for new categories
    - Add `createSubcategory()` method for new subcategories
    - _Requirements: 1.1, 1.4_

- [x] 2. Create Reusable CategorySelector Component





  - [x] 2.1 Create CategorySelector component with database fetching


    - Create `components/CategorySelector.tsx`
    - Implement Autocomplete with freeSolo for category selection
    - Fetch categories from API on mount using React Query for caching
    - Filter categories based on user input (not incremental typing)
    - _Requirements: 1.1, 1.3_
  - [x] 2.2 Write property test for category filtering


    - **Property 1: Category Filtering Correctness**
    - **Validates: Requirements 1.3**
  - [x] 2.3 Implement subcategory selection with category filtering


    - Fetch subcategories filtered by selected category_id
    - Update subcategory options when category changes
    - Clear subcategory when category changes
    - _Requirements: 1.2_

  - [x] 2.4 Write property test for subcategory filtering

    - **Property 2: Subcategory Filtering by Category**
    - **Validates: Requirements 1.2**
  - [x] 2.5 Add "Add New" option for categories and subcategories


    - Show "Add New Category" option when no match found
    - Open dialog to create new category/subcategory
    - Save to database and refresh list
    - _Requirements: 1.4, 1.5, 1.6_
- [x] 3. Integrate CategorySelector into Product Pages







- [ ] 3. Integrate CategorySelector into Product Pages

  - [x] 3.1 Replace category selection in Products page (Add Product dialog)




    - Import and use CategorySelector component
    - Remove hardcoded category arrays
    - Connect to newProduct state
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 3.2 Replace category selection in Add From Master page

    - Update category/subcategory selection to use CategorySelector
    - Remove local category state management
    - _Requirements: 1.7_

  - [x] 3.3 Replace category selection in ExtractedProductEditor

    - Update Autocomplete components to use CategorySelector
    - Remove customCategories and customSubcategories state
    - _Requirements: 1.8_
-

- [x] 4. Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Optimize ExtractedProductEditor Performance





  - [x] 5.1 Implement debounced state updates for text fields


    - Create useDebounce hook or use lodash debounce
    - Apply to all TextField onChange handlers
    - Set debounce delay to 150ms for smooth typing
    - _Requirements: 2.1, 2.3_

  - [x] 5.2 Write property test for debounced updates

    - **Property 4: Debounced State Updates**
    - **Validates: Requirements 2.3**
  - [x] 5.3 Optimize product card rendering





    - Use React.memo for product cards
    - Move updateProduct function to useCallback
    - Prevent unnecessary re-renders of sibling products
    - _Requirements: 2.2_
  - [x] 5.4 Implement virtualization for large product lists




    - Add react-window or similar virtualization library
    - Render only visible products in viewport
    - Maintain scroll position during updates
    - _Requirements: 2.4_
  - [x] 5.5 Make image search non-blocking



    - Ensure image search runs in background
    - Use separate loading state per product
    - Don't block text input during search
    - _Requirements: 2.5_

- [x] 6. Create Bulk Import Dialog Component




  - [x] 6.1 Create BulkImportDialog component structure


    - Create `components/BulkImportDialog.tsx`
    - Add file upload area supporting Excel, CSV, and images
    - Add drag-and-drop support
    - Display file type icons and validation
    - _Requirements: 3.1, 3.2_

  - [x] 6.2 Implement CSV file parser
    - Parse CSV using PapaParse library
    - Map columns: product_name, price, min_order_quantity
    - Handle header row detection
    - Validate required columns exist
    - _Requirements: 3.3_

  - [x] 6.3 Write property test for CSV parsing

    - **Property 5: CSV/Excel Parsing Round-Trip**
    - **Validates: Requirements 3.3**

  - [x] 6.4 Implement Excel file parser
    - Parse Excel using xlsx library
    - Support .xlsx and .xls formats
    - Map same columns as CSV
    - _Requirements: 3.3_
  - [x] 6.5 Implement image extraction using AWS Textract
    - Reuse existing AWS Textract integration
    - Parse extracted text for product format
    - Handle handwritten and printed text
    - _Requirements: 3.4_
  - [x] 6.6 Write property test for extraction output format


    - **Property 6: Preview Completeness**
    - **Validates: Requirements 3.5, 3.6**

- [x] 7. Create Bulk Import Preview Component


  - [x] 7.1 Create BulkImportPreview component


    - Create `components/BulkImportPreview.tsx`
    - Display editable grid/cards for all extracted products
    - Include all required fields with defaults (stock_level: 100)
    - _Requirements: 3.5, 3.6_

  - [x] 7.2 Implement category auto-tagging
    - Create CategoryMatcher utility function
    - Match product names against category keywords
    - Auto-populate category and subcategory fields
    - _Requirements: 3.7_
  - [x] 7.3 Write property test for category auto-matching


    - **Property 7: Category Auto-Matching**
    - **Validates: Requirements 3.7**

  - [x] 7.4 Implement automatic image fetching
    - Use existing ImageSearcher for each product
    - Run searches in parallel with rate limiting
    - Display loading state per product
    - _Requirements: 3.8_

  - [x] 7.5 Implement bulk import confirmation
    - Add products to seller inventory on confirm
    - Handle partial failures gracefully
    - Continue processing after individual failures
    - _Requirements: 3.9, 3.10_
  - [x] 7.6 Write property test for import resilience


    - **Property 9: Partial Import Resilience**
    - **Validates: Requirements 3.9, 3.10**

  - [x] 7.7 Display import results summary
    - Show count of successful and failed imports
    - List specific errors for failed products
    - Provide option to retry failed items
    - _Requirements: 3.11_
  - [x] 7.8 Write property test for result accuracy



    - **Property 8: Import Result Accuracy**
    - **Validates: Requirements 3.10, 3.11**

- [x] 8. Integrate Bulk Import into Seller Inventory Page




  - [x] 8.1 Add Bulk Import button to Seller Inventory page


    - Add button next to existing controls
    - Only enable when seller is selected
    - _Requirements: 3.1_

  - [x] 8.2 Connect BulkImportDialog to page

    - Pass selected seller ID to dialog
    - Handle import completion callback
    - Refresh product list after import
    - _Requirements: 3.2, 3.9_

- [x] 9. Final Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.
