import { describe, it, expect } from 'vitest';
import {
  calculateDistanceFee,
  calculatePriceFee,
  calculateTimeSlotFee,
  calculateTotalFee,
} from './fee-calculator';

describe('Fee Calculator', () => {
  describe('calculateDistanceFee', () => {
    it('should return 3.65 for distances <= 3km', () => {
      expect(calculateDistanceFee(0)).toBe(3.65);
      expect(calculateDistanceFee(1.5)).toBe(3.65);
      expect(calculateDistanceFee(3)).toBe(3.65);
    });

    it('should calculate correctly for distances between 3km and 4km', () => {
      // 3.5km: 3.65 + (3.5 - 3) * 10 * 0.15 = 3.65 + 0.75 = 4.40
      expect(calculateDistanceFee(3.5)).toBeCloseTo(4.40, 2);
      
      // 4km: 3.65 + (4 - 3) * 10 * 0.15 = 3.65 + 1.5 = 5.15
      expect(calculateDistanceFee(4)).toBeCloseTo(5.15, 2);
    });

    it('should calculate correctly for distances > 4km', () => {
      // 5km: 3.65 + 1.5 + (5 - 4) * 10 * 0.1 = 3.65 + 1.5 + 1.0 = 6.15
      expect(calculateDistanceFee(5)).toBeCloseTo(6.15, 2);
      
      // 6km: 3.65 + 1.5 + (6 - 4) * 10 * 0.1 = 3.65 + 1.5 + 2.0 = 7.15
      expect(calculateDistanceFee(6)).toBeCloseTo(7.15, 2);
    });

    it('should handle boundary values correctly', () => {
      // Boundary at 3km
      expect(calculateDistanceFee(3)).toBe(3.65);
      expect(calculateDistanceFee(3.01)).toBeCloseTo(3.65 + 0.01 * 10 * 0.15, 2);
      
      // Boundary at 4km
      expect(calculateDistanceFee(4)).toBeCloseTo(5.15, 2);
      expect(calculateDistanceFee(4.01)).toBeCloseTo(5.15 + 0.01 * 10 * 0.1, 2);
    });
  });

  describe('calculatePriceFee', () => {
    it('should return 0 for prices <= 25', () => {
      expect(calculatePriceFee(0)).toBe(0);
      expect(calculatePriceFee(10)).toBe(0);
      expect(calculatePriceFee(25)).toBe(0);
    });

    it('should calculate correctly for prices between 25 and 30', () => {
      // 27元: (27 - 25) * 0.19 = 0.38
      expect(calculatePriceFee(27)).toBeCloseTo(0.38, 2);
      
      // 30元: (30 - 25) * 0.19 = 0.95
      expect(calculatePriceFee(30)).toBeCloseTo(0.95, 2);
    });

    it('should calculate correctly for prices between 30 and 50', () => {
      // 40元: 5 * 0.19 + (40 - 30) * 0.18 = 0.95 + 1.8 = 2.75
      expect(calculatePriceFee(40)).toBeCloseTo(2.75, 2);
      
      // 50元: 5 * 0.19 + (50 - 30) * 0.18 = 0.95 + 3.6 = 4.55
      expect(calculatePriceFee(50)).toBeCloseTo(4.55, 2);
    });

    it('should calculate correctly for prices > 50', () => {
      // 60元: 5 * 0.19 + 20 * 0.18 + (60 - 50) * 0.17 = 0.95 + 3.6 + 1.7 = 6.25
      expect(calculatePriceFee(60)).toBeCloseTo(6.25, 2);
      
      // 100元: 5 * 0.19 + 20 * 0.18 + (100 - 50) * 0.17 = 0.95 + 3.6 + 8.5 = 13.05
      expect(calculatePriceFee(100)).toBeCloseTo(13.05, 2);
    });

    it('should handle boundary values correctly', () => {
      // Boundary at 25
      expect(calculatePriceFee(25)).toBe(0);
      expect(calculatePriceFee(25.01)).toBeCloseTo(0.01 * 0.19, 2);
      
      // Boundary at 30
      expect(calculatePriceFee(30)).toBeCloseTo(0.95, 2);
      expect(calculatePriceFee(30.01)).toBeCloseTo(0.95 + 0.01 * 0.18, 2);
      
      // Boundary at 50
      expect(calculatePriceFee(50)).toBeCloseTo(4.55, 2);
      expect(calculatePriceFee(50.01)).toBeCloseTo(4.55 + 0.01 * 0.17, 2);
    });
  });

  describe('calculateTimeSlotFee', () => {
    it('should return 0.5 for times between 00:00 (exclusive) and 02:00 (inclusive)', () => {
      // 01:00 = 60 minutes
      expect(calculateTimeSlotFee(60)).toBe(0.5);
      
      // 02:00 = 120 minutes
      expect(calculateTimeSlotFee(120)).toBe(0.5);
    });

    it('should return 1.0 for times between 02:00 (exclusive) and 06:00 (inclusive)', () => {
      // 03:00 = 180 minutes
      expect(calculateTimeSlotFee(180)).toBe(1.0);
      
      // 06:00 = 360 minutes
      expect(calculateTimeSlotFee(360)).toBe(1.0);
    });

    it('should return 0.3 for times between 22:00 (exclusive) and 24:00 (inclusive)', () => {
      // 23:00 = 1380 minutes
      expect(calculateTimeSlotFee(1380)).toBe(0.3);
      
      // 24:00 = 1440 minutes
      expect(calculateTimeSlotFee(1440)).toBe(0.3);
    });

    it('should return 0 for other time slots', () => {
      // 00:00 = 0 minutes (exclusive, so should be 0)
      expect(calculateTimeSlotFee(0)).toBe(0);
      
      // 07:00 = 420 minutes
      expect(calculateTimeSlotFee(420)).toBe(0);
      
      // 12:00 = 720 minutes
      expect(calculateTimeSlotFee(720)).toBe(0);
      
      // 18:00 = 1080 minutes
      expect(calculateTimeSlotFee(1080)).toBe(0);
      
      // 22:00 = 1320 minutes (exclusive, so should be 0)
      expect(calculateTimeSlotFee(1320)).toBe(0);
    });

    it('should handle boundary values correctly', () => {
      // Boundary at 02:00
      expect(calculateTimeSlotFee(120)).toBe(0.5); // 02:00 inclusive in first bracket
      expect(calculateTimeSlotFee(121)).toBe(0.5); // 02:01 still hour 2, in first bracket
      expect(calculateTimeSlotFee(180)).toBe(1.0); // 03:00 in second bracket
      
      // Boundary at 06:00
      expect(calculateTimeSlotFee(360)).toBe(1.0); // 06:00 inclusive
      expect(calculateTimeSlotFee(361)).toBe(1.0); // 06:01 still hour 6, in second bracket
      expect(calculateTimeSlotFee(420)).toBe(0);   // 07:00 no fee
      
      // Boundary at 22:00
      expect(calculateTimeSlotFee(1320)).toBe(0);   // 22:00 exclusive
      expect(calculateTimeSlotFee(1321)).toBe(0);   // 22:01 still hour 22, no fee
      expect(calculateTimeSlotFee(1380)).toBe(0.3); // 23:00 has fee
    });
  });

  describe('calculateTotalFee', () => {
    it('should sum all fee components correctly', () => {
      // Distance: 2km -> 3.65
      // Price: 20元 -> 0
      // Time: 12:00 (720 min) -> 0
      // Total: 3.65
      expect(calculateTotalFee(2, 20, 720)).toBeCloseTo(3.65, 2);
    });

    it('should calculate total fee with all components', () => {
      // Distance: 5km -> 6.15
      // Price: 40元 -> 2.75
      // Time: 01:00 (60 min) -> 0.5
      // Total: 9.40
      expect(calculateTotalFee(5, 40, 60)).toBeCloseTo(9.40, 2);
    });

    it('should handle maximum fee scenario', () => {
      // Distance: 10km -> 3.65 + 1.5 + 6.0 = 11.15
      // Price: 100元 -> 13.05
      // Time: 03:00 (180 min) -> 1.0
      // Total: 25.20
      expect(calculateTotalFee(10, 100, 180)).toBeCloseTo(25.20, 2);
    });

    it('should handle minimum fee scenario', () => {
      // Distance: 1km -> 3.65
      // Price: 10元 -> 0
      // Time: 12:00 (720 min) -> 0
      // Total: 3.65
      expect(calculateTotalFee(1, 10, 720)).toBeCloseTo(3.65, 2);
    });
  });
});


// Property-Based Tests
import * as fc from 'fast-check';

describe('Fee Calculator - Property-Based Tests', () => {
  describe('Property 24: Distance Fee Calculation', () => {
    // Feature: silicon-rider-bench, Property 24: 距离配送费计算
    it('should calculate distance fee correctly for all valid distances', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 20, noNaN: true }),
          (distance) => {
            const fee = calculateDistanceFee(distance);
            
            if (distance <= 3) {
              // 0-3km（含）：起步价 3.65 元
              expect(fee).toBeCloseTo(3.65, 2);
            } else if (distance <= 4) {
              // 3km（不含）-4km（含）：起步价 + 每 0.1km 加收 0.15 元
              const expected = 3.65 + (distance - 3) * 10 * 0.15;
              expect(fee).toBeCloseTo(expected, 2);
            } else {
              // 4km 以上：4km 费用 + 每 0.1km 加收 0.1 元
              const expected = 3.65 + 10 * 0.15 + (distance - 4) * 10 * 0.1;
              expect(fee).toBeCloseTo(expected, 2);
            }
            
            // Fee should always be >= base fee
            expect(fee).toBeGreaterThanOrEqual(3.65);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 25: Price Fee Calculation', () => {
    // Feature: silicon-rider-bench, Property 25: 价格配送费计算
    it('should calculate price fee correctly for all valid prices', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 200, noNaN: true }),
          (itemPrice) => {
            const fee = calculatePriceFee(itemPrice);
            
            if (itemPrice <= 25) {
              // 0-25元（含）：0 元
              expect(fee).toBeCloseTo(0, 2);
            } else if (itemPrice <= 30) {
              // 25元（不含）-30元（含）：25元以上部分每上涨 1 元加收 0.19 元
              const expected = (itemPrice - 25) * 0.19;
              expect(fee).toBeCloseTo(expected, 2);
            } else if (itemPrice <= 50) {
              // 30元（不含）-50元（含）：30元以上部分每上涨 1 元加收 0.18 元
              const expected = 5 * 0.19 + (itemPrice - 30) * 0.18;
              expect(fee).toBeCloseTo(expected, 2);
            } else {
              // 50元以上：50元以上部分每上涨 1 元加收 0.17 元
              const expected = 5 * 0.19 + 20 * 0.18 + (itemPrice - 50) * 0.17;
              expect(fee).toBeCloseTo(expected, 2);
            }
            
            // Fee should always be >= 0
            expect(fee).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 26: Time Slot Fee Calculation', () => {
    // Feature: silicon-rider-bench, Property 26: 时段配送费计算
    it('should calculate time slot fee correctly for all valid times', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1440 }),
          (acceptTime) => {
            const fee = calculateTimeSlotFee(acceptTime);
            const hour = Math.floor(acceptTime / 60);
            
            if (hour > 0 && hour <= 2) {
              // 00:00（不含）到 02:00（含）：加收 0.5 元
              expect(fee).toBe(0.5);
            } else if (hour > 2 && hour <= 6) {
              // 02:00（不含）到 06:00（含）：加收 1 元
              expect(fee).toBe(1.0);
            } else if (hour > 22 && hour <= 24) {
              // 22:00（不含）到 24:00（含）：加收 0.3 元
              expect(fee).toBe(0.3);
            } else {
              // 其他时段：不加收
              expect(fee).toBe(0);
            }
            
            // Fee should be one of the valid values
            expect([0, 0.3, 0.5, 1.0]).toContain(fee);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 27: Total Fee Calculation', () => {
    // Feature: silicon-rider-bench, Property 27: 总配送费计算
    it('should calculate total fee as sum of all components', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 0, max: 20, noNaN: true }),
          fc.float({ min: 0, max: 200, noNaN: true }),
          fc.integer({ min: 0, max: 1440 }),
          (distance, itemPrice, acceptTime) => {
            const totalFee = calculateTotalFee(distance, itemPrice, acceptTime);
            const distanceFee = calculateDistanceFee(distance);
            const priceFee = calculatePriceFee(itemPrice);
            const timeSlotFee = calculateTimeSlotFee(acceptTime);
            
            const expectedTotal = distanceFee + priceFee + timeSlotFee;
            
            // Total should equal sum of components
            expect(totalFee).toBeCloseTo(expectedTotal, 2);
            
            // Total should always be >= base distance fee
            expect(totalFee).toBeGreaterThanOrEqual(3.65);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
