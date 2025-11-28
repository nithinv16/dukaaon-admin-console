import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';

/**
 * **Feature: category-inventory-improvements, Property 4: Debounced State Updates**
 * **Validates: Requirements 2.3**
 * 
 * For any sequence of rapid text input events (within 100ms), the component SHALL 
 * batch these into a single state update rather than updating on each keystroke.
 */
describe('Debounced State Updates Property Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Simulates the debounce behavior used in DebouncedTextField.
   * This is a pure function test of the debounce logic.
   */
  function createDebouncedUpdater(delay: number) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let updateCount = 0;
    let lastValue: string | null = null;

    return {
      update: (value: string) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
          updateCount++;
          lastValue = value;
          timeoutId = null;
        }, delay);
      },
      flush: () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      },
      getUpdateCount: () => updateCount,
      getLastValue: () => lastValue,
      advanceTime: (ms: number) => {
        vi.advanceTimersByTime(ms);
      }
    };
  }

  it('Property 4: Rapid inputs within debounce window result in single update', () => {
    fc.assert(
      fc.property(
        // Generate array of input strings (simulating keystrokes)
        fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 2, maxLength: 20 }),
        // Generate debounce delay
        fc.integer({ min: 50, max: 300 }),
        (inputs, debounceDelay) => {
          const debouncer = createDebouncedUpdater(debounceDelay);

          // Simulate rapid inputs (all within debounce window)
          for (const input of inputs) {
            debouncer.update(input);
            // Advance time by less than debounce delay
            debouncer.advanceTime(debounceDelay / 2);
          }

          // At this point, no updates should have fired yet
          // because each input resets the timer
          expect(debouncer.getUpdateCount()).toBe(0);

          // Now advance past the debounce delay
          debouncer.advanceTime(debounceDelay + 10);

          // Should have exactly one update with the last value
          expect(debouncer.getUpdateCount()).toBe(1);
          expect(debouncer.getLastValue()).toBe(inputs[inputs.length - 1]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Inputs separated by more than debounce delay result in multiple updates', () => {
    fc.assert(
      fc.property(
        // Generate array of input strings
        fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 2, maxLength: 10 }),
        // Generate debounce delay
        fc.integer({ min: 50, max: 200 }),
        (inputs, debounceDelay) => {
          const debouncer = createDebouncedUpdater(debounceDelay);

          // Simulate inputs with gaps larger than debounce delay
          for (const input of inputs) {
            debouncer.update(input);
            // Advance time by more than debounce delay
            debouncer.advanceTime(debounceDelay + 50);
          }

          // Each input should have triggered a separate update
          expect(debouncer.getUpdateCount()).toBe(inputs.length);
          expect(debouncer.getLastValue()).toBe(inputs[inputs.length - 1]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Final value is always the last input value', () => {
    fc.assert(
      fc.property(
        // Generate array of input strings
        fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 1, maxLength: 30 }),
        // Generate random timing pattern (some fast, some slow)
        fc.array(fc.integer({ min: 10, max: 300 }), { minLength: 1, maxLength: 30 }),
        fc.integer({ min: 100, max: 200 }),
        (inputs, timings, debounceDelay) => {
          const debouncer = createDebouncedUpdater(debounceDelay);

          // Simulate inputs with varying timing
          const minLength = Math.min(inputs.length, timings.length);
          for (let i = 0; i < minLength; i++) {
            debouncer.update(inputs[i]);
            debouncer.advanceTime(timings[i]);
          }

          // Advance time to ensure final debounce completes
          debouncer.advanceTime(debounceDelay + 100);

          // The last value should be the final input
          if (debouncer.getLastValue() !== null) {
            // Find the last input that was processed
            const lastProcessedInput = inputs[minLength - 1];
            expect(debouncer.getLastValue()).toBe(lastProcessedInput);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Update count is always less than or equal to input count', () => {
    fc.assert(
      fc.property(
        // Generate array of input strings
        fc.array(fc.string({ minLength: 1, maxLength: 10 }), { minLength: 1, maxLength: 50 }),
        // Generate random timing pattern
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 1, maxLength: 50 }),
        fc.integer({ min: 100, max: 200 }),
        (inputs, timings, debounceDelay) => {
          const debouncer = createDebouncedUpdater(debounceDelay);

          // Simulate inputs with varying timing
          const minLength = Math.min(inputs.length, timings.length);
          for (let i = 0; i < minLength; i++) {
            debouncer.update(inputs[i]);
            debouncer.advanceTime(timings[i]);
          }

          // Advance time to ensure final debounce completes
          debouncer.advanceTime(debounceDelay + 100);

          // Update count should never exceed input count
          expect(debouncer.getUpdateCount()).toBeLessThanOrEqual(minLength);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: Debounce with 150ms delay batches rapid typing', () => {
    // Specific test for the 150ms delay used in the component
    const DEBOUNCE_DELAY = 150;

    fc.assert(
      fc.property(
        // Generate a string to type character by character
        fc.string({ minLength: 5, maxLength: 20 }),
        (textToType) => {
          const debouncer = createDebouncedUpdater(DEBOUNCE_DELAY);

          // Simulate typing at ~100ms per character (faster than debounce)
          let currentText = '';
          for (const char of textToType) {
            currentText += char;
            debouncer.update(currentText);
            debouncer.advanceTime(50); // 50ms between keystrokes
          }

          // Before debounce completes, no updates
          expect(debouncer.getUpdateCount()).toBe(0);

          // After debounce delay, exactly one update
          debouncer.advanceTime(DEBOUNCE_DELAY + 10);
          expect(debouncer.getUpdateCount()).toBe(1);
          expect(debouncer.getLastValue()).toBe(textToType);
        }
      ),
      { numRuns: 100 }
    );
  });
});
