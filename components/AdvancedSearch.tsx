'use client';

import React, { useState } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  Button,
  Paper,
  IconButton,
  Collapse,
  Typography,
} from '@mui/material';
import {
  Search,
  FilterList,
  ExpandMore,
  ExpandLess,
  Clear,
} from '@mui/icons-material';

export interface SearchFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in';
  value: string | number | string[];
  label?: string;
}

interface AdvancedSearchProps {
  onSearch: (query: string, filters: SearchFilter[]) => void;
  searchFields?: Array<{ field: string; label: string; type: 'text' | 'number' | 'date' | 'select'; options?: string[] }>;
  placeholder?: string;
  defaultFilters?: SearchFilter[];
}

export default function AdvancedSearch({
  onSearch,
  searchFields = [],
  placeholder = 'Search...',
  defaultFilters = [],
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilter[]>(defaultFilters);
  const [expanded, setExpanded] = useState(false);
  const [newFilter, setNewFilter] = useState<Partial<SearchFilter>>({
    field: searchFields[0]?.field || '',
    operator: 'equals',
    value: '',
  });

  const handleAddFilter = () => {
    if (newFilter.field && newFilter.value) {
      const field = searchFields.find((f) => f.field === newFilter.field);
      setFilters([
        ...filters,
        {
          field: newFilter.field!,
          operator: newFilter.operator || 'equals',
          value: newFilter.value,
          label: field?.label || newFilter.field,
        },
      ]);
      setNewFilter({
        field: searchFields[0]?.field || '',
        operator: 'equals',
        value: '',
      });
    }
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleSearch = () => {
    onSearch(query, filters);
  };

  const handleClear = () => {
    setQuery('');
    setFilters([]);
    onSearch('', []);
  };

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'startsWith', label: 'Starts With' },
    { value: 'endsWith', label: 'Ends With' },
    { value: 'greaterThan', label: 'Greater Than' },
    { value: 'lessThan', label: 'Less Than' },
    { value: 'between', label: 'Between' },
    { value: 'in', label: 'In (comma-separated)' },
  ];

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack spacing={2}>
        {/* Basic Search */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            fullWidth
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            InputProps={{
              startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
          <Button variant="contained" onClick={handleSearch}>
            Search
          </Button>
          <Button variant="outlined" onClick={handleClear} startIcon={<Clear />}>
            Clear
          </Button>
          <IconButton onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>

        {/* Active Filters */}
        {filters.length > 0 && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Active Filters:
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {filters.map((filter, index) => (
                <Chip
                  key={index}
                  label={`${filter.label || filter.field} ${filter.operator} ${Array.isArray(filter.value) ? filter.value.join(', ') : filter.value}`}
                  onDelete={() => handleRemoveFilter(index)}
                  size="small"
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Advanced Filters */}
        <Collapse in={expanded}>
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Add Filter
            </Typography>
            <Stack direction="row" spacing={1} alignItems="flex-end">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Field</InputLabel>
                <Select
                  value={newFilter.field}
                  label="Field"
                  onChange={(e) => setNewFilter({ ...newFilter, field: e.target.value })}
                >
                  {searchFields.map((field) => (
                    <MenuItem key={field.field} value={field.field}>
                      {field.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Operator</InputLabel>
                <Select
                  value={newFilter.operator}
                  label="Operator"
                  onChange={(e) => setNewFilter({ ...newFilter, operator: e.target.value as any })}
                >
                  {operators.map((op) => (
                    <MenuItem key={op.value} value={op.value}>
                      {op.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {newFilter.field && (
                <>
                  {searchFields.find((f) => f.field === newFilter.field)?.type === 'select' ? (
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel>Value</InputLabel>
                      <Select
                        value={newFilter.value}
                        label="Value"
                        onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
                      >
                        {searchFields
                          .find((f) => f.field === newFilter.field)
                          ?.options?.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField
                      size="small"
                      label="Value"
                      value={newFilter.value || ''}
                      onChange={(e) => setNewFilter({ ...newFilter, value: e.target.value })}
                      type={
                        searchFields.find((f) => f.field === newFilter.field)?.type === 'number'
                          ? 'number'
                          : searchFields.find((f) => f.field === newFilter.field)?.type === 'date'
                          ? 'date'
                          : 'text'
                      }
                      sx={{ minWidth: 200 }}
                    />
                  )}
                </>
              )}

              <Button variant="outlined" onClick={handleAddFilter} startIcon={<FilterList />}>
                Add Filter
              </Button>
            </Stack>
          </Box>
        </Collapse>
      </Stack>
    </Paper>
  );
}

