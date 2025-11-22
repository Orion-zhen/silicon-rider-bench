import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SeededRNG } from './seeded-rng';

describe('SeededRNG', () => {
  describe('Property Tests', () => {
    // Feature: silicon-rider-bench, Property 1: 种子确定性
    // Validates: Requirements 1.2
    it('should generate identical sequences for the same seed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999 }), // seed
          fc.integer({ min: 10, max: 100 }), // number of values to generate
          (seed, count) => {
            const rng1 = new SeededRNG(seed);
            const rng2 = new SeededRNG(seed);

            // Generate sequences from both RNGs
            const sequence1: number[] = [];
            const sequence2: number[] = [];

            for (let i = 0; i < count; i++) {
              sequence1.push(rng1.nextFloat());
              sequence2.push(rng2.nextFloat());
            }

            // Sequences should be identical
            expect(sequence1).toEqual(sequence2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate identical integer sequences for the same seed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999 }), // seed
          fc.integer({ min: 10, max: 50 }), // number of values to generate
          fc.integer({ min: 0, max: 100 }), // min value
          fc.integer({ min: 101, max: 1000 }), // max value
          (seed, count, min, max) => {
            const rng1 = new SeededRNG(seed);
            const rng2 = new SeededRNG(seed);

            const sequence1: number[] = [];
            const sequence2: number[] = [];

            for (let i = 0; i < count; i++) {
              sequence1.push(rng1.nextInt(min, max));
              sequence2.push(rng2.nextInt(min, max));
            }

            expect(sequence1).toEqual(sequence2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should generate identical shuffled arrays for the same seed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999999 }), // seed
          fc.array(fc.integer(), { minLength: 5, maxLength: 20 }), // array to shuffle
          (seed, array) => {
            const rng1 = new SeededRNG(seed);
            const rng2 = new SeededRNG(seed);

            const shuffled1 = rng1.shuffle(array);
            const shuffled2 = rng2.shuffle(array);

            expect(shuffled1).toEqual(shuffled2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Unit Tests', () => {
    it('should generate values between 0 and 1', () => {
      const rng = new SeededRNG(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.nextFloat();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should generate integers within specified range', () => {
      const rng = new SeededRNG(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.nextInt(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    it('should throw error when min > max for nextInt', () => {
      const rng = new SeededRNG(12345);
      expect(() => rng.nextInt(20, 10)).toThrow('min must be less than or equal to max');
    });

    it('should throw error when min > max for nextFloatRange', () => {
      const rng = new SeededRNG(12345);
      expect(() => rng.nextFloatRange(20, 10)).toThrow('min must be less than or equal to max');
    });

    it('should shuffle array without losing elements', () => {
      const rng = new SeededRNG(12345);
      const original = [1, 2, 3, 4, 5];
      const shuffled = rng.shuffle(original);
      
      expect(shuffled.length).toBe(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    it('should not modify original array when shuffling', () => {
      const rng = new SeededRNG(12345);
      const original = [1, 2, 3, 4, 5];
      const originalCopy = [...original];
      rng.shuffle(original);
      
      expect(original).toEqual(originalCopy);
    });

    it('should pick element from array', () => {
      const rng = new SeededRNG(12345);
      const array = [1, 2, 3, 4, 5];
      const choice = rng.choice(array);
      
      expect(array).toContain(choice);
    });

    it('should throw error when picking from empty array', () => {
      const rng = new SeededRNG(12345);
      expect(() => rng.choice([])).toThrow('Cannot pick from empty array');
    });

    it('should generate boolean values', () => {
      const rng = new SeededRNG(12345);
      const values = Array.from({ length: 100 }, () => rng.nextBoolean());
      
      // Should have both true and false values (with high probability)
      expect(values.some(v => v === true)).toBe(true);
      expect(values.some(v => v === false)).toBe(true);
    });

    it('should generate floats within specified range', () => {
      const rng = new SeededRNG(12345);
      for (let i = 0; i < 100; i++) {
        const value = rng.nextFloatRange(10.5, 20.5);
        expect(value).toBeGreaterThanOrEqual(10.5);
        expect(value).toBeLessThan(20.5);
      }
    });
  });
});
