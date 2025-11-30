-- Create product extraction corrections table for AI learning
CREATE TABLE IF NOT EXISTS product_extraction_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id TEXT,
  seller_id UUID,
  
  -- Extracted vs Corrected Data
  extracted_name TEXT NOT NULL,
  corrected_name TEXT NOT NULL,
  
  extracted_category TEXT,
  corrected_category TEXT,
  
  extracted_subcategory TEXT,
  corrected_subcategory TEXT,
  
  extracted_description TEXT,
  corrected_description TEXT,
  
  extracted_quantity DECIMAL,
  corrected_quantity DECIMAL,
  
  extracted_unit TEXT,
  corrected_unit TEXT,
  
  extracted_unit_price DECIMAL,
  corrected_unit_price DECIMAL,
  
  -- Metadata
  was_corrected BOOLEAN DEFAULT false,
  correction_type TEXT, -- 'name', 'category', 'description', 'quantity', 'multiple'
  confidence_before DECIMAL,
  confidence_after DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Only store if there was an actual correction
  CONSTRAINT different_values CHECK (
    extracted_name != corrected_name OR
    extracted_category != corrected_category OR
    extracted_subcategory != corrected_subcategory OR
    extracted_description != corrected_description OR
    extracted_quantity != corrected_quantity OR
    extracted_unit != corrected_unit
  )
);

-- Enable trigram extension for fuzzy text matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Indexes for fast lookup and similarity search
CREATE INDEX IF NOT EXISTS idx_corrections_seller 
  ON product_extraction_corrections(seller_id);

CREATE INDEX IF NOT EXISTS idx_corrections_name_trgm 
  ON product_extraction_corrections USING gin(extracted_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_corrections_category 
  ON product_extraction_corrections(extracted_category, corrected_category);

CREATE INDEX IF NOT EXISTS idx_corrections_created 
  ON product_extraction_corrections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_corrections_seller_name 
  ON product_extraction_corrections(seller_id, extracted_name);

-- Add comment
COMMENT ON TABLE product_extraction_corrections IS 
  'Stores AI extraction corrections for self-learning feedback loop. Used for few-shot learning to improve extraction accuracy over time.';
