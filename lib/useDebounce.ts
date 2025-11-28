import { useState, useEffect, useRef, useCallback } from 'react';
import debounce from 'lodash/debounce';

/**
 * Custom hook that returns a debounced value.
 * The value will only update after the specified delay has passed without changes.
 * 
 * @param value - The value to debounce
 * @param delay - The debounce delay in milliseconds (default: 150ms)
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delay: number = 150): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Custom hook that returns a debounced callback function.
 * Useful for debouncing event handlers like onChange.
 * 
 * @param callback - The callback function to debounce
 * @param delay - The debounce delay in milliseconds (default: 150ms)
 * @returns A debounced version of the callback
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 150
): T {
  const callbackRef = useRef(callback);
  
  // Update the ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Create the debounced function once
  const debouncedFn = useRef(
    debounce((...args: Parameters<T>) => {
      callbackRef.current(...args);
    }, delay)
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedFn.current.cancel();
    };
  }, []);

  return debouncedFn.current as unknown as T;
}

/**
 * Custom hook for managing local input state with debounced updates to parent.
 * This allows immediate UI feedback while batching state updates.
 * 
 * @param externalValue - The value from parent state
 * @param onExternalChange - Callback to update parent state (will be debounced)
 * @param delay - The debounce delay in milliseconds (default: 150ms)
 * @returns [localValue, setLocalValue] - Local state and setter for immediate updates
 */
export function useDebouncedInput<T>(
  externalValue: T,
  onExternalChange: (value: T) => void,
  delay: number = 150
): [T, (value: T) => void] {
  const [localValue, setLocalValue] = useState<T>(externalValue);
  const isInternalUpdate = useRef(false);

  // Sync local value when external value changes (but not from our own updates)
  useEffect(() => {
    if (!isInternalUpdate.current) {
      setLocalValue(externalValue);
    }
    isInternalUpdate.current = false;
  }, [externalValue]);

  // Create debounced update function
  const debouncedUpdate = useRef(
    debounce((value: T) => {
      isInternalUpdate.current = true;
      onExternalChange(value);
    }, delay)
  );

  // Update debounced function when callback changes
  useEffect(() => {
    debouncedUpdate.current = debounce((value: T) => {
      isInternalUpdate.current = true;
      onExternalChange(value);
    }, delay);

    return () => {
      debouncedUpdate.current.cancel();
    };
  }, [onExternalChange, delay]);

  // Handler that updates local state immediately and debounces external update
  const handleChange = useCallback((value: T) => {
    setLocalValue(value);
    debouncedUpdate.current(value);
  }, []);

  return [localValue, handleChange];
}

export default useDebouncedValue;
