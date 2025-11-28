import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { TextField, TextFieldProps } from '@mui/material';
import debounce from 'lodash/debounce';

export interface DebouncedTextFieldProps extends Omit<TextFieldProps, 'onChange'> {
  /**
   * The external value from parent state
   */
  value: string | number;
  /**
   * Callback fired when the value changes (debounced)
   */
  onChange: (value: string | number) => void;
  /**
   * Debounce delay in milliseconds (default: 150ms)
   */
  debounceMs?: number;
  /**
   * Whether to parse the value as a number
   */
  parseAsNumber?: boolean;
}

/**
 * A TextField component with built-in debouncing for performance optimization.
 * Updates local state immediately for responsive typing, while debouncing
 * updates to parent state to prevent excessive re-renders.
 */
const DebouncedTextField: React.FC<DebouncedTextFieldProps> = memo(({
  value: externalValue,
  onChange,
  debounceMs = 150,
  parseAsNumber = false,
  ...textFieldProps
}) => {
  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState<string>(String(externalValue ?? ''));
  const isInternalUpdate = useRef(false);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync local value when external value changes from outside
  useEffect(() => {
    if (!isInternalUpdate.current) {
      setLocalValue(String(externalValue ?? ''));
    }
    isInternalUpdate.current = false;
  }, [externalValue]);

  // Create debounced update function
  const debouncedOnChange = useRef(
    debounce((value: string) => {
      isInternalUpdate.current = true;
      if (parseAsNumber) {
        const numValue = parseFloat(value);
        onChangeRef.current(isNaN(numValue) ? '' : numValue);
      } else {
        onChangeRef.current(value);
      }
    }, debounceMs)
  );

  // Cleanup on unmount
  useEffect(() => {
    const currentDebounced = debouncedOnChange.current;
    return () => {
      currentDebounced.cancel();
    };
  }, []);

  // Handle input change - update local state immediately, debounce parent update
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setLocalValue(newValue);
    debouncedOnChange.current(newValue);
  }, []);

  return (
    <TextField
      {...textFieldProps}
      value={localValue}
      onChange={handleChange}
    />
  );
});

DebouncedTextField.displayName = 'DebouncedTextField';

export default DebouncedTextField;
