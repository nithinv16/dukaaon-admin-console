# Implementation Plan

- [x] 1. Set up AWS Bedrock Integration




  - [x] 1.1 Create AWS Bedrock client configuration


    - Create `lib/awsBedrock.ts` with Bedrock client initialization
    - Configure Claude 3 Haiku model for cost-effective AI processing
    - Add environment variables for AWS Bedrock credentials
    - _Requirements: 1.2, 2.2, 4.2_


  - [x] 1.2 Implement Bedrock service wrapper

    - Create `invokeModel` function for sending prompts to Bedrock
    - Implement retry logic with exponential backoff
    - Add response parsing and error handling
    - _Requirements: 1.2, 1.7_


  - [x] 1.3 Write property test for Bedrock response format

    - **Property 2: AI Parsed Product Format Consistency**
    - **Validates: Requirements 1.3, 1.5**

- [x] 2. Implement AI-Enhanced Text Extraction Service




  - [x] 2.1 Create AI extraction service


    - Create `lib/aiExtractionService.ts`
    - Implement `extractFromImage` function that calls Textract then Bedrock
    - Create product parsing prompt template
    - _Requirements: 1.1, 1.2, 1.3_



  - [ ] 2.2 Write property test for OCR to AI pipeline
    - **Property 1: OCR to AI Pipeline Integrity**


    - **Validates: Requirements 1.1, 1.2**

  - [ ] 2.3 Implement image type detection
    - Create `identifyImageType` function using AI


    - Support receipt, product_list, name_only_list, invoice types
    - Return confidence score for classification
    - _Requirements: 3.7_



  - [ ] 2.4 Implement confidence scoring and review flagging
    - Calculate confidence scores for each extracted field


    - Flag products with confidence < 0.7 for review
    - Add `needsReview` field to extracted products



    - _Requirements: 1.5, 1.6_



  - [ ] 2.5 Write property test for low confidence highlighting
    - **Property 3: Low Confidence Field Highlighting**
    - **Validates: Requirements 1.6**



  - [x] 2.6 Implement fallback to rule-based extraction


    - Detect AI extraction failures
    - Fall back to existing `parseReceiptTextAWS` function
    - Notify user of fallback mode
    - _Requirements: 1.7_






- [ ] 3. Implement Name-Only List Processing

  - [ ] 3.1 Create name-only list handler
    - Detect when image contains only product names
    - Set default values (price: 0, quantity: 1)
    - Mark fields that need user input
    - _Requirements: 3.1, 3.2, 3.6_

  - [ ] 3.2 Write property test for name-only defaults
    - **Property 7: Name-Only List Default Values**
    - **Validates: Requirements 3.1, 3.2**

  - [ ] 3.3 Implement master product matching
    - Query master_products table for matching products
    - Pre-populate price and description from matches
    - Calculate match confidence score
    - _Requirements: 3.4, 3.5_

  - [ ] 3.4 Write property test for master product matching
    - **Property 8: Master Product Matching**
    - **Validates: Requirements 3.4, 3.5**

- [ ] 4. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.



- [x] 5. Implement AI-Based Brand Identification


  - [ ] 5.1 Create brand identification service
    - Create `lib/brandIdentificationService.ts`
    - Implement `identifyBrand` function using Bedrock
    - Create brand identification prompt template


    - _Requirements: 4.1, 4.2_

  - [x] 5.2 Implement brand matching against existing brands


    - Fetch existing brands from master_products table
    - Match identified brands to existing format

    - Handle new brand suggestions
    - _Requirements: 4.4, 4.5_

  - [ ] 5.3 Write property test for brand identification
    - **Property 9: Brand Identification and Population**

    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 5.4 Implement confidence threshold for brands

    - Leave brand empty when confidence < 0.6
    - Provide alternatives when multiple candidates exist
    - _Requirements: 4.6, 4.7_

  - [ ] 5.5 Write property test for low confidence brand handling
    - **Property 10: Low Confidence Brand Handling**

    - **Validates: Requirements 4.6**










- [ ] 6. Implement Automated Category Tagging

  - [ ] 6.1 Create AI categorization service
    - Create `lib/aiCategorizationService.ts`


    - Implement `suggestCategories` function using Bedrock
    - Create category suggestion prompt template


    - _Requirements: 2.1, 2.2_

  - [ ] 6.2 Implement category auto-population
    - Auto-populate category when confidence >= 0.7


    - Auto-populate subcategory when match found
    - _Requirements: 2.3, 2.4_



  - [ ] 6.3 Write property test for category auto-population
    - **Property 4: Category Auto-Population**
    - **Validates: Requirements 2.3, 2.4**



  - [ ] 6.4 Implement category suggestion ranking
    - Return top 3 category suggestions
    - Sort by confidence descending



    - Include reason for each suggestion


    - _Requirements: 2.8_

  - [ ] 6.5 Write property test for category ranking
    - **Property 5: Category Suggestion Ranking**

    - **Validates: Requirements 2.8**

  - [ ] 6.6 Implement new subcategory suggestion
    - Suggest new subcategory when no match exists
    - Provide option to add new subcategory to database
    - Generate slug for new subcategory
    - _Requirements: 2.5, 2.6, 2.7_

  - [ ] 6.7 Write property test for subcategory slug generation
    - **Property 6: New Subcategory Slug Generation**
    - **Validates: Requirements 2.7**

- [ ] 7. Checkpoint - Ensure all tests pass

  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Create Python Web Image Scraper

  - [ ] 8.1 Create Python scraper script
    - Create `scripts/image_scraper.py`
    - Implement multi-source image search (Google, Bing, e-commerce)
    - Add image quality scoring
    - _Requirements: 5.2, 5.3_

  - [ ] 8.2 Write property test for multi-source search
    - **Property 12: Multi-Source Image Search**
    - **Validates: Requirements 5.3**

  - [ ] 8.3 Implement image download and validation
    - Download images to server
    - Validate image format and size
    - Select highest quality image
    - _Requirements: 5.4, 5.6_

  - [ ] 8.4 Write property test for image quality selection
    - **Property 13: Image Quality Selection**
    - **Validates: Requirements 5.6**

  - [ ] 8.5 Create API route for image scraping
    - Create `/api/admin/scrape-image/route.ts`
    - Invoke Python scraper via subprocess
    - Handle single and batch scraping requests
    - _Requirements: 5.2, 5.9_

  - [ ] 8.6 Implement image upload to storage
    - Upload scraped images to S3/storage
    - Update product record with image URL
    - Handle upload failures gracefully
    - _Requirements: 5.5, 5.8_

  - [ ] 8.7 Write property test for image round-trip
    - **Property 11: Image Scrape and Upload Round-Trip**
    - **Validates: Requirements 5.4, 5.5**

- [x] 9. Integrate AI Services into Frontend

  - [x] 9.1 Update BulkImportDialog to use AI extraction
    - Replace existing image parsing with AI extraction service
    - Display image type detection results
    - Show extraction confidence scores
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 9.2 Update BulkImportPreview with AI features

    - Display AI-suggested categories with confidence
    - Show brand identification results
    - Highlight fields needing review
    - _Requirements: 1.6, 2.3, 4.3_


  - [x] 9.3 Add "Scrape Image" button to ProductCard

    - Add button to trigger image scraping
    - Show loading state during scraping
    - Display scraped image on completion
    - _Requirements: 5.1, 5.8_


  - [x] 9.4 Implement batch image scraping

    - Add "Scrape All Images" button to preview
    - Process products in parallel with rate limiting
    - Show progress and results summary
    - _Requirements: 5.9_


  - [x] 9.5 Add new subcategory creation UI


    - Show "Add New Subcategory" option when suggested
    - Create dialog for confirming new subcategory
    - Save to database and refresh list
    - _Requirements: 2.6, 2.7_
- [x] 10. Create AI Extraction API Routes




- [ ] 10. Create AI Extraction API Routes

  - [x] 10.1 Create AI extraction API route


    - Create `/api/admin/ai-extract/route.ts`
    - Accept image buffer, return AI-extracted products
    - Include confidence scores and review flags
    - _Requirements: 1.1, 1.2, 1.3, 1.5_


  - [x] 10.2 Create AI categorization API route

    - Create `/api/admin/ai-categorize/route.ts`
    - Accept products, return category suggestions
    - Support batch categorization
    - _Requirements: 2.1, 2.2, 2.8_


  - [x] 10.3 Create brand identification API route

    - Create `/api/admin/ai-brand/route.ts`
    - Accept product names, return brand identifications
    - Support batch processing
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 11. Final Checkpoint - Ensure all tests pass




  - Ensure all tests pass, ask the user if questions arise.
