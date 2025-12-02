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

- [x] 10. Implement Category Deletion with Orphan Management





  - [x] 10.1 Update category deletion API to handle orphaned products

    - Modify DELETE handler in `/api/admin/categories/route.ts`
    - When deleting category, set category and subcategory to null for all products
    - Return count of orphaned products in response
    - _Requirements: 4.1, 4.3_


  - [x] 10.2 Update subcategory deletion API to preserve parent category
    - Modify DELETE handler for subcategories
    - When deleting subcategory, set only subcategory to null, keep category
    - Return count of affected products
    - _Requirements: 4.2_


  - [x] 10.3 Write property test for category deletion orphan handling

    - **Property 10: Category Deletion Orphan Handling**
    - **Validates: Requirements 4.1**


  - [x] 10.4 Write property test for subcategory deletion
    - **Property 11: Subcategory Deletion Parent Preservation**
    - **Validates: Requirements 4.2**


  - [x] 10.5 Add database methods for orphan management

    - Add `deleteCategory()` method with orphan handling to supabase-browser.ts
    - Add `deleteSubcategory()` method with orphan handling
    - Add `getUncategorizedProducts()` method
    - _Requirements: 4.1, 4.2, 4.4_


  - [x] 10.6 Write property test for delete operation count accuracy


    - **Property 13: Delete Operation Count Accuracy**
    - **Validates: Requirements 4.8**
-

- [x] 11. Create Uncategorized Products Section





  - [x] 11.1 Add Uncategorized section to Categories page


    - Add new card/section at top of category tree
    - Display count of uncategorized products
    - Load uncategorized products when section is clicked
    - _Requirements: 4.4_


  - [x] 11.2 Implement drag and drop for uncategorized products

    - Make uncategorized products draggable
    - Allow dropping into any category or subcategory
    - Update product category on drop
    - _Requirements: 4.5_


  - [x] 11.3 Write property test for uncategorized drag and drop

    - **Property 12: Drag and Drop Uncategorized Products**
    - **Validates: Requirements 4.5**

  - [x] 11.4 Update context menu for category/subcategory deletion


    - Enhance existing context menu to include delete option
    - Show confirmation dialog before deletion
    - Display count of products that will be orphaned
    - _Requirements: 4.6, 4.7_

- [x] 12. Implement Multi-Select Product Operations










  - [x] 12.1 Add checkbox selection to products panel





    - Add checkbox to each product item
    - Implement select all / deselect all functionality
    - Track selected product IDs in state
    - _Requirements: 5.1_

  - [x] 12.2 Create ProductSelectionToolbar component





    - Create `components/ProductSelectionToolbar.tsx`
    - Display count of selected products
    - Add "Clear Selection" button
    - Show when products are selected
    - _Requirements: 5.2, 5.12_

  - [x] 12.3 Write property test for selection count accuracy


    - **Property 14: Selection Count Accuracy**
    - **Validates: Requirements 5.2**

  - [x] 12.4 Write property test for clear selection

    - **Property 19: Clear Selection Completeness**
    - **Validates: Requirements 5.12**


  - [x] 12.5 Enhance context menu for multi-select operations




    - Update ContextMenu component to support nested submenus
    - Add "Move to" option with category/subcategory submenu
    - Add "Copy to" option with category/subcategory submenu
    - Disable menu when no products selected
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 12.6 Write property test for context menu completeness



    - **Property 15: Context Menu Category Completeness**
    - **Validates: Requirements 5.4, 5.5**

-

- [x] 13. Create Bulk Product Operations API






  - [x] 13.1 Create bulk move API endpoint



    - Create `/api/admin/products/bulk-move/route.ts`
    - Accept array of product IDs and target category/subcategory
    - Update all products in a transaction
    - Return success count and failed products list
    - _Requirements: 5.6, 5.7_


  - [x] 13.2 Create bulk copy API endpoint


    - Create `/api/admin/products/bulk-copy/route.ts`
    - Accept array of product IDs and target category/subcategory
    - Duplicate products with new category assignments
    - Return success count and failed products list
    - _Requirements: 5.8, 5.9_


  - [x] 13.3 Write property test for bulk move operation

    - **Property 16: Bulk Move Operation Correctness**
    - **Validates: Requirements 5.6, 5.7**


  - [x] 13.4 Write property test for bulk copy operation
    - **Property 17: Bulk Copy Operation Correctness**
    - **Validates: Requirements 5.8, 5.9**


  - [x] 13.5 Add database methods for bulk operations


    - Add `bulkMoveProducts()` method to supabase-browser.ts
    - Add `bulkCopyProducts()` method
    - Implement transaction handling for atomicity
    - _Requirements: 5.6, 5.7, 5.8, 5.9_

  - [ ]* 13.6 Write property test for operation result accuracy
    - **Property 18: Multi-Product Operation Result Accuracy**
    - **Validates: Requirements 5.10, 5.11**

- [x] 14. Integrate Multi-Select Operations into Categories Page











  - [x] 14.1 Connect ProductSelectionToolbar to page




    - Add toolbar above products list when products selected
    - Wire up clear selection handler
    - _Requirements: 5.2, 5.12_


  - [x] 14.2 Implement right-click context menu for selected products



    - Detect right-click on selected products
    - Show context menu with Move/Copy options
    - Build category/subcategory submenu dynamically
    - _Requirements: 5.3, 5.4, 5.5_



  - [x] 14.3 Implement move operation handler


    - Call bulk move API with selected product IDs
    - Show loading state during operation
    - Display success/error messages
    - Refresh products list after operation
    - _Requirements: 5.6, 5.7, 5.10, 5.11_



  - [x] 14.4 Implement copy operation handler


    - Call bulk copy API with selected product IDs
    - Show loading state during operation
    - Display success/error messages
    - Refresh products list after operation
    - _Requirements: 5.8, 5.9, 5.10, 5.11_

- [x] 15. Final Checkpoint - Ensure all tests pass







  - Ensure all tests pass, ask the user if questions arise.
