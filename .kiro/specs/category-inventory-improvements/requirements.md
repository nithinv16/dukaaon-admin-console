# Requirements Document

## Introduction

This document outlines the requirements for three key improvements to the admin console:
1. Fix category selection to fetch from database tables (categories and subcategories) instead of showing incremental typing
2. Fix performance lag in the scan receipt popup screen while editing/adding product details
3. Add bulk import feature to seller inventory page supporting Excel/CSV files and photo extraction with AWS OCR

## Glossary

- **Admin Console**: The administrative interface for managing products, sellers, and inventory
- **Category**: A top-level product classification stored in the `categories` table (columns: id, name, slug)
- **Subcategory**: A secondary product classification linked to a category, stored in the `subcategories` table (columns: id, category_id, name, slug)
- **Seller Inventory**: Products associated with a specific seller
- **OCR (Optical Character Recognition)**: Technology to extract text from images using AWS Textract
- **Bulk Import**: The process of adding multiple products at once from a file or image
- **ExtractedProductEditor**: The dialog component for editing products extracted from receipts/images

## Requirements

### Requirement 1: Database-Driven Category Selection

**User Story:** As an admin, I want to select categories and subcategories from the database when adding products, so that I have consistent and accurate category options across all screens.

#### Acceptance Criteria

1. WHEN the Add Product dialog opens THEN the Admin Console SHALL fetch categories from the `categories` database table and display them in the category dropdown
2. WHEN a category is selected THEN the Admin Console SHALL fetch subcategories from the `subcategories` database table filtered by the selected category_id
3. WHEN a user types in the category field THEN the Admin Console SHALL filter the existing database categories to match the input instead of showing incremental typing characters
4. WHEN a user wants to add a new category THEN the Admin Console SHALL provide an "Add New Category" option that saves to the database
5. WHEN a new category is added THEN the Admin Console SHALL insert the category into the `categories` table with a generated slug
6. WHEN a new subcategory is added THEN the Admin Console SHALL insert the subcategory into the `subcategories` table with the correct category_id and generated slug
7. WHEN the Quick Add from Master dialog opens THEN the Admin Console SHALL use the same database-driven category selection
8. WHEN the Scan Receipt editor opens THEN the Admin Console SHALL use the same database-driven category selection

### Requirement 2: Receipt Scan Dialog Performance Optimization

**User Story:** As an admin, I want the scan receipt popup to respond quickly while typing, so that I can efficiently edit extracted product details without frustrating delays.

#### Acceptance Criteria

1. WHEN a user types in any text field in the ExtractedProductEditor THEN the Admin Console SHALL update the field value within 50 milliseconds
2. WHEN multiple products are displayed in the editor THEN the Admin Console SHALL render updates without blocking the main thread
3. WHEN the user updates a product field THEN the Admin Console SHALL use debounced state updates to prevent excessive re-renders
4. WHEN the dialog contains many products THEN the Admin Console SHALL use virtualization or lazy rendering for products outside the viewport
5. WHEN image search is triggered THEN the Admin Console SHALL not block text input in other fields

### Requirement 3: Bulk Import Feature for Seller Inventory

**User Story:** As an admin, I want to import products to a seller's inventory from Excel/CSV files or photos, so that I can quickly add multiple products without manual entry.

#### Acceptance Criteria

1. WHEN the Seller Inventory page loads THEN the Admin Console SHALL display a "Bulk Import" button
2. WHEN the Bulk Import button is clicked THEN the Admin Console SHALL open a dialog with options to upload Excel, CSV, or image files
3. WHEN an Excel or CSV file is uploaded THEN the Admin Console SHALL parse columns for product name, price, and min order quantity
4. WHEN an image file is uploaded THEN the Admin Console SHALL use AWS Textract to extract product information in the same format
5. WHEN products are extracted THEN the Admin Console SHALL display an editable preview page showing all products
6. WHEN displaying the preview THEN the Admin Console SHALL show fields for: product name, price, min order quantity, image, description, category, subcategory, and stock level (default 100)
7. WHEN displaying the preview THEN the Admin Console SHALL attempt to auto-tag categories and subcategories based on product name matching
8. WHEN displaying the preview THEN the Admin Console SHALL attempt to fetch product images from the internet using web scraping
9. WHEN the user confirms the import THEN the Admin Console SHALL add all products to the selected seller's inventory
10. WHEN a product fails to import THEN the Admin Console SHALL display an error message and continue with remaining products
11. WHEN the import completes THEN the Admin Console SHALL display a summary of successful and failed imports
