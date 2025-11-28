'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Autocomplete,
  TextField,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Chip,
  Tooltip
} from '@mui/material';
import { Add, AutoAwesome } from '@mui/icons-material';
import { adminQueries } from '../lib/supabase-browser';

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
}

export interface CategorySelectorValue {
  category: string;
  categoryId?: string;
  subcategory: string;
  subcategoryId?: string;
}

export interface AISuggestion {
  name: string;
  confidence: number;
  reason?: string;
  isNew?: boolean;
}

export interface CategorySelectorProps {
  value: CategorySelectorValue;
  onChange: (value: CategorySelectorValue) => void;
  allowNew?: boolean;
  size?: 'small' | 'medium';
  disabled?: boolean;
  categoryLabel?: string;
  subcategoryLabel?: string;
  // AI suggestions - Requirements: 2.6, 2.7
  aiCategorySuggestions?: AISuggestion[];
  aiSubcategorySuggestions?: AISuggestion[];
  onNewSubcategoryCreated?: (subcategory: Subcategory) => void;
}

// Special option for adding new items
const ADD_NEW_CATEGORY_OPTION = '___ADD_NEW_CATEGORY___';
const ADD_NEW_SUBCATEGORY_OPTION = '___ADD_NEW_SUBCATEGORY___';

/**
 * Filter categories based on input string (case-insensitive substring match)
 * This is exported for testing purposes
 */
export function filterCategories(categories: Category[], inputValue: string): Category[] {
  if (!inputValue || inputValue.trim() === '') {
    return categories;
  }
  const searchTerm = inputValue.toLowerCase().trim();
  return categories.filter(cat => 
    cat.name.toLowerCase().includes(searchTerm)
  );
}

/**
 * Filter subcategories by category ID
 * This is exported for testing purposes
 */
export function filterSubcategoriesByCategory(
  subcategories: Subcategory[], 
  categoryId: string | undefined
): Subcategory[] {
  if (!categoryId) {
    return [];
  }
  return subcategories.filter(sub => sub.category_id === categoryId);
}


const CategorySelector: React.FC<CategorySelectorProps> = ({
  value,
  onChange,
  allowNew = true,
  size = 'small',
  disabled = false,
  categoryLabel = 'Category',
  subcategoryLabel = 'Subcategory',
  aiCategorySuggestions,
  aiSubcategorySuggestions,
  onNewSubcategoryCreated
}) => {
  // Data state
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Input state for filtering
  const [categoryInputValue, setCategoryInputValue] = useState('');
  const [subcategoryInputValue, setSubcategoryInputValue] = useState('');

  // Dialog state for adding new items
  const [addCategoryDialogOpen, setAddCategoryDialogOpen] = useState(false);
  const [addSubcategoryDialogOpen, setAddSubcategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [saving, setSaving] = useState(false);

  // Fetch categories and subcategories on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await adminQueries.getCategories();
        setCategories(data.categories || []);
        setSubcategories(data.subcategories || []);
      } catch (err: any) {
        console.error('Error fetching categories:', err);
        setError(err.message || 'Failed to fetch categories');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter categories based on input
  const filteredCategories = useMemo(() => {
    return filterCategories(categories, categoryInputValue);
  }, [categories, categoryInputValue]);

  // Get the selected category object
  const selectedCategory = useMemo(() => {
    if (value.categoryId) {
      return categories.find(c => c.id === value.categoryId);
    }
    return categories.find(c => c.name === value.category);
  }, [categories, value.category, value.categoryId]);

  // Filter subcategories by selected category
  const availableSubcategories = useMemo(() => {
    return filterSubcategoriesByCategory(subcategories, selectedCategory?.id);
  }, [subcategories, selectedCategory?.id]);

  // Filter subcategories based on input
  const filteredSubcategories = useMemo(() => {
    if (!subcategoryInputValue || subcategoryInputValue.trim() === '') {
      return availableSubcategories;
    }
    const searchTerm = subcategoryInputValue.toLowerCase().trim();
    return availableSubcategories.filter(sub => 
      sub.name.toLowerCase().includes(searchTerm)
    );
  }, [availableSubcategories, subcategoryInputValue]);

  // Build category options with "Add New" option
  const categoryOptions = useMemo(() => {
    const options = filteredCategories.map(c => c.name);
    if (allowNew && categoryInputValue.trim() && 
        !filteredCategories.some(c => c.name.toLowerCase() === categoryInputValue.toLowerCase())) {
      options.push(ADD_NEW_CATEGORY_OPTION);
    }
    return options;
  }, [filteredCategories, allowNew, categoryInputValue]);

  // Build subcategory options with "Add New" option and AI suggestions
  // Requirements: 2.6 - Show "Add New Subcategory" option when suggested
  const subcategoryOptions = useMemo(() => {
    const options = filteredSubcategories.map(s => s.name);
    
    // Add AI-suggested new subcategories at the top
    if (aiSubcategorySuggestions && selectedCategory) {
      aiSubcategorySuggestions
        .filter(s => s.isNew && s.confidence >= 0.5)
        .forEach(suggestion => {
          if (!options.includes(suggestion.name) && !options.includes(`AI: ${suggestion.name}`)) {
            options.unshift(`AI: ${suggestion.name}`);
          }
        });
    }
    
    if (allowNew && selectedCategory && subcategoryInputValue.trim() && 
        !filteredSubcategories.some(s => s.name.toLowerCase() === subcategoryInputValue.toLowerCase())) {
      options.push(ADD_NEW_SUBCATEGORY_OPTION);
    }
    return options;
  }, [filteredSubcategories, allowNew, selectedCategory, subcategoryInputValue, aiSubcategorySuggestions]);

  // Handle category change
  const handleCategoryChange = useCallback((event: any, newValue: string | null) => {
    if (newValue === ADD_NEW_CATEGORY_OPTION) {
      setNewCategoryName(categoryInputValue);
      setAddCategoryDialogOpen(true);
      return;
    }

    const category = categories.find(c => c.name === newValue);
    onChange({
      category: newValue || '',
      categoryId: category?.id,
      subcategory: '',
      subcategoryId: undefined
    });
    setSubcategoryInputValue('');
  }, [categories, categoryInputValue, onChange]);

  // Handle subcategory change
  // Requirements: 2.6 - Handle AI-suggested new subcategories
  const handleSubcategoryChange = useCallback((event: any, newValue: string | null) => {
    if (newValue === ADD_NEW_SUBCATEGORY_OPTION) {
      setNewSubcategoryName(subcategoryInputValue);
      setAddSubcategoryDialogOpen(true);
      return;
    }

    // Handle AI-suggested new subcategory
    if (newValue?.startsWith('AI: ')) {
      const suggestedName = newValue.replace('AI: ', '');
      setNewSubcategoryName(suggestedName);
      setAddSubcategoryDialogOpen(true);
      return;
    }

    const subcategory = availableSubcategories.find(s => s.name === newValue);
    onChange({
      ...value,
      subcategory: newValue || '',
      subcategoryId: subcategory?.id
    });
  }, [availableSubcategories, subcategoryInputValue, onChange, value]);


  // Handle adding new category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      setSaving(true);
      const result = await adminQueries.createCategory(newCategoryName.trim());
      
      if (result.success && result.data) {
        // Add to local state
        const newCategory = result.data as Category;
        setCategories(prev => [...prev, newCategory].sort((a, b) => a.name.localeCompare(b.name)));
        
        // Select the new category
        onChange({
          category: newCategory.name,
          categoryId: newCategory.id,
          subcategory: '',
          subcategoryId: undefined
        });
        
        setAddCategoryDialogOpen(false);
        setNewCategoryName('');
        setCategoryInputValue('');
      }
    } catch (err: any) {
      console.error('Error creating category:', err);
      setError(err.message || 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  // Handle adding new subcategory
  // Requirements: 2.6, 2.7 - Save to database and refresh list
  const handleAddSubcategory = async () => {
    if (!newSubcategoryName.trim() || !selectedCategory) return;

    try {
      setSaving(true);
      const result = await adminQueries.createSubcategory(newSubcategoryName.trim(), selectedCategory.id);
      
      if (result.success && result.data) {
        // Add to local state
        const newSubcategory = result.data as Subcategory;
        setSubcategories(prev => [...prev, newSubcategory].sort((a, b) => a.name.localeCompare(b.name)));
        
        // Select the new subcategory
        onChange({
          ...value,
          subcategory: newSubcategory.name,
          subcategoryId: newSubcategory.id
        });
        
        // Notify parent component about the new subcategory
        if (onNewSubcategoryCreated) {
          onNewSubcategoryCreated(newSubcategory);
        }
        
        setAddSubcategoryDialogOpen(false);
        setNewSubcategoryName('');
        setSubcategoryInputValue('');
      }
    } catch (err: any) {
      console.error('Error creating subcategory:', err);
      setError(err.message || 'Failed to create subcategory');
    } finally {
      setSaving(false);
    }
  };

  // Render option with special handling for "Add New" options
  const renderCategoryOption = (props: any, option: string) => {
    if (option === ADD_NEW_CATEGORY_OPTION) {
      return (
        <li {...props} key="add-new-category">
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
            <Add sx={{ mr: 1 }} />
            <Typography>Add "{categoryInputValue}" as new category</Typography>
          </Box>
        </li>
      );
    }
    return <li {...props} key={option}>{option}</li>;
  };

  const renderSubcategoryOption = (props: any, option: string) => {
    if (option === ADD_NEW_SUBCATEGORY_OPTION) {
      return (
        <li {...props} key="add-new-subcategory">
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'primary.main' }}>
            <Add sx={{ mr: 1 }} />
            <Typography>Add "{subcategoryInputValue}" as new subcategory</Typography>
          </Box>
        </li>
      );
    }
    
    // Render AI-suggested new subcategory with special styling
    // Requirements: 2.6 - Show "Add New Subcategory" option when suggested
    if (option.startsWith('AI: ')) {
      const suggestedName = option.replace('AI: ', '');
      const suggestion = aiSubcategorySuggestions?.find(s => s.name === suggestedName);
      return (
        <li {...props} key={`ai-${suggestedName}`}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', color: 'success.main' }}>
              <AutoAwesome sx={{ mr: 1, fontSize: 18 }} />
              <Typography>Add "{suggestedName}"</Typography>
            </Box>
            {suggestion && (
              <Tooltip title={suggestion.reason || 'AI suggested'}>
                <Chip 
                  label={`${Math.round(suggestion.confidence * 100)}%`}
                  size="small"
                  color="success"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              </Tooltip>
            )}
          </Box>
        </li>
      );
    }
    
    return <li {...props} key={option}>{option}</li>;
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
        {/* Category Autocomplete */}
        <Autocomplete
          fullWidth
          size={size}
          options={categoryOptions}
          value={value.category || null}
          onChange={handleCategoryChange}
          inputValue={categoryInputValue}
          onInputChange={(event, newInputValue) => setCategoryInputValue(newInputValue)}
          loading={loading}
          disabled={disabled}
          freeSolo
          renderOption={renderCategoryOption}
          filterOptions={(options) => options} // We handle filtering ourselves
          renderInput={(params) => (
            <TextField
              {...params}
              label={categoryLabel}
              placeholder="Select or type category"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />

        {/* Subcategory Autocomplete */}
        <Autocomplete
          fullWidth
          size={size}
          options={subcategoryOptions}
          value={value.subcategory || null}
          onChange={handleSubcategoryChange}
          inputValue={subcategoryInputValue}
          onInputChange={(event, newInputValue) => setSubcategoryInputValue(newInputValue)}
          loading={loading}
          disabled={disabled || !selectedCategory}
          freeSolo
          renderOption={renderSubcategoryOption}
          filterOptions={(options) => options} // We handle filtering ourselves
          renderInput={(params) => (
            <TextField
              {...params}
              label={subcategoryLabel}
              placeholder={selectedCategory ? "Select or type subcategory" : "Select a category first"}
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loading ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Box>


      {/* Add Category Dialog */}
      <Dialog open={addCategoryDialogOpen} onClose={() => setAddCategoryDialogOpen(false)}>
        <DialogTitle>Add New Category</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Category Name"
            fullWidth
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            disabled={saving}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddCategoryDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddCategory} 
            variant="contained" 
            disabled={saving || !newCategoryName.trim()}
          >
            {saving ? <CircularProgress size={20} /> : 'Add Category'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Subcategory Dialog */}
      <Dialog open={addSubcategoryDialogOpen} onClose={() => setAddSubcategoryDialogOpen(false)}>
        <DialogTitle>Add New Subcategory</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Adding subcategory to: {selectedCategory?.name}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Subcategory Name"
            fullWidth
            value={newSubcategoryName}
            onChange={(e) => setNewSubcategoryName(e.target.value)}
            disabled={saving}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSubcategoryDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleAddSubcategory} 
            variant="contained" 
            disabled={saving || !newSubcategoryName.trim()}
          >
            {saving ? <CircularProgress size={20} /> : 'Add Subcategory'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CategorySelector;
