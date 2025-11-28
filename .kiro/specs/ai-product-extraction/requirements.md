# Requirements Document

## Introduction

This document outlines the requirements for enhancing the product extraction and categorization system with AI capabilities. The improvements focus on five key areas:
1. AI-powered text extraction from product images using AWS Textract OCR combined with AWS Bedrock AI models for intelligent parsing
2. Automated category and subcategory tagging using AI classification
3. Intelligent processing of product name lists (images containing only product names)
4. AI-based brand/company identification from extracted product details
5. Python-based web image scraping for automatic product image retrieval

## Glossary

- **AWS Textract**: Amazon's OCR service for extracting text and structured data from images
- **AWS Bedrock**: Amazon's managed service for foundation AI models (Claude, Titan, etc.)
- **OCR (Optical Character Recognition)**: Technology to extract text from images
- **Product Extraction**: The process of identifying and parsing product information from images or documents
- **Category Tagging**: Automatic assignment of product categories based on product attributes
- **Brand Identification**: AI-based recognition of product brand/manufacturer from product names and descriptions
- **Web Scraping**: Automated retrieval of product images from the internet
- **ExtractedProductEditor**: The dialog component for reviewing and editing extracted products
- **BulkImportDialog**: The dialog component for uploading files for bulk product import
- **Seller Inventory Page**: The admin page for managing seller product inventory

## Requirements

### Requirement 1: AI-Enhanced Text Extraction from Product Images

**User Story:** As an admin, I want the system to intelligently extract product details from images using AI, so that I get accurate and properly formatted product information even from handwritten or poorly structured images.

#### Acceptance Criteria

1. WHEN an image is uploaded for product extraction THEN the System SHALL use AWS Textract to perform OCR and extract raw text from the image
2. WHEN raw text is extracted from an image THEN the System SHALL send the text to AWS Bedrock AI model for intelligent parsing into structured product data
3. WHEN the AI model parses product text THEN the System SHALL extract product name, price, quantity, and unit information in a standardized format
4. WHEN the extracted text contains ambiguous or incomplete data THEN the AI model SHALL make intelligent inferences based on context
5. WHEN the AI model returns parsed products THEN the System SHALL display confidence scores for each extracted field
6. WHEN extraction confidence is below 70% for any field THEN the System SHALL highlight that field for user review
7. WHEN the AI extraction fails THEN the System SHALL fall back to rule-based extraction and notify the user

### Requirement 2: Automated Category and Subcategory Tagging

**User Story:** As an admin, I want the system to automatically suggest categories and subcategories for extracted products, so that I can quickly categorize products without manual selection.

#### Acceptance Criteria

1. WHEN products are extracted from an image or file THEN the System SHALL analyze each product name and description to suggest appropriate categories
2. WHEN suggesting categories THEN the System SHALL use AWS Bedrock AI to match products against existing database categories
3. WHEN a product matches an existing category THEN the System SHALL auto-populate the category field with the matched value
4. WHEN a product matches an existing subcategory THEN the System SHALL auto-populate the subcategory field with the matched value
5. WHEN no matching subcategory exists for a product THEN the System SHALL suggest a new subcategory name based on the product
6. WHEN a suggested subcategory does not exist in the database THEN the System SHALL provide an option to add the new subcategory
7. WHEN adding a new subcategory THEN the System SHALL insert it into the subcategories table with the correct category_id and generated slug
8. WHEN multiple category matches are possible THEN the System SHALL display the top 3 suggestions ranked by confidence

### Requirement 3: Intelligent Product Name List Processing

**User Story:** As an admin, I want the system to intelligently process images containing only product names, so that I can import products even from simple name lists.

#### Acceptance Criteria

1. WHEN an image contains only product names without prices THEN the System SHALL extract and process the product names
2. WHEN processing product names only THEN the System SHALL set default values for price (0) and quantity (1)
3. WHEN product names are extracted THEN the System SHALL attempt to identify the brand from the product name
4. WHEN product names are extracted THEN the System SHALL attempt to match against master_products table for additional details
5. WHEN a product name matches a master product THEN the System SHALL pre-populate price and description from the master product
6. WHEN displaying extracted name-only products THEN the System SHALL clearly indicate which fields need user input
7. WHEN the image format is unclear THEN the AI model SHALL determine if it contains a product list, receipt, or other format

### Requirement 4: AI-Based Brand Identification

**User Story:** As an admin, I want the system to automatically identify and populate the brand/company name for extracted products, so that product records are complete and searchable.

#### Acceptance Criteria

1. WHEN products are extracted THEN the System SHALL analyze the product name to identify the brand
2. WHEN identifying brands THEN the System SHALL use AWS Bedrock AI to recognize brand names from product text
3. WHEN a brand is identified THEN the System SHALL populate the brand field in the product review page
4. WHEN the identified brand exists in the master_products table THEN the System SHALL use the existing brand name format
5. WHEN the identified brand is new THEN the System SHALL suggest adding it to the brand list
6. WHEN brand identification confidence is below 60% THEN the System SHALL leave the brand field empty for manual entry
7. WHEN multiple brand candidates are detected THEN the System SHALL display the top suggestion with alternatives available

### Requirement 5: Python Web Image Scraping for Products

**User Story:** As an admin, I want to automatically download product images from the internet, so that I can quickly add product images without manual searching.

#### Acceptance Criteria

1. WHEN viewing extracted products THEN the System SHALL display a "Scrape Image" button for each product
2. WHEN the "Scrape Image" button is clicked THEN the System SHALL invoke a Python web scraper to search for the product image
3. WHEN searching for images THEN the Python scraper SHALL search multiple sources including Google Images, Bing Images, and e-commerce sites
4. WHEN an image is found THEN the Python scraper SHALL download the image to the server
5. WHEN the image is downloaded THEN the System SHALL upload it to the product image storage and update the product record
6. WHEN multiple images are found THEN the System SHALL select the highest quality image that matches the product
7. WHEN no suitable image is found THEN the System SHALL display a placeholder and notify the user
8. WHEN the scraping process completes THEN the System SHALL display the scraped image in the product preview
9. WHEN batch processing products THEN the System SHALL provide an option to scrape images for all products simultaneously

