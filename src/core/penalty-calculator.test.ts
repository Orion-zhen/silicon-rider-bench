/**
 * 超时惩罚计算模块单元测试
 */

import { describe, it, expect } from 'vitest';
import { calculatePayment } from './penalty-calculator';

describe('calculatePayment', () => {
  const deliveryFee = 10; // 使用 10 元作为基准配送费
  const deadline = 100; // 假设截止时间为游戏时间 100 分钟

  describe('准时或轻微超时（0-5分钟）', () => {
    it('准时送达（0分钟超时）应该不扣款', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline);
      
      expect(result.overtime).toBe(0);
      expect(result.penalty).toBe(0);
      expect(result.payment).toBe(deliveryFee);
    });

    it('提前送达应该不扣款', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline - 5);
      
      expect(result.overtime).toBe(0);
      expect(result.penalty).toBe(0);
      expect(result.payment).toBe(deliveryFee);
    });

    it('超时 5 分钟（边界值）应该不扣款', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 5);
      
      expect(result.overtime).toBe(5);
      expect(result.penalty).toBe(0);
      expect(result.payment).toBe(deliveryFee);
    });

    it('超时 3 分钟应该不扣款', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 3);
      
      expect(result.overtime).toBe(3);
      expect(result.penalty).toBe(0);
      expect(result.payment).toBe(deliveryFee);
    });
  });

  describe('轻度超时（5-10分钟）', () => {
    it('超时 5.1 分钟应该扣除 30%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 5.1);
      
      expect(result.overtime).toBeCloseTo(5.1);
      expect(result.penalty).toBeCloseTo(3); // 10 * 0.3
      expect(result.payment).toBeCloseTo(7); // 10 - 3
    });

    it('超时 7 分钟应该扣除 30%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 7);
      
      expect(result.overtime).toBe(7);
      expect(result.penalty).toBe(3); // 10 * 0.3
      expect(result.payment).toBe(7); // 10 - 3
    });

    it('超时 10 分钟（边界值）应该扣除 30%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 10);
      
      expect(result.overtime).toBe(10);
      expect(result.penalty).toBe(3); // 10 * 0.3
      expect(result.payment).toBe(7); // 10 - 3
    });
  });

  describe('中度超时（10-15分钟）', () => {
    it('超时 10.1 分钟应该扣除 50%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 10.1);
      
      expect(result.overtime).toBeCloseTo(10.1);
      expect(result.penalty).toBeCloseTo(5); // 10 * 0.5
      expect(result.payment).toBeCloseTo(5); // 10 - 5
    });

    it('超时 12 分钟应该扣除 50%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 12);
      
      expect(result.overtime).toBe(12);
      expect(result.penalty).toBe(5); // 10 * 0.5
      expect(result.payment).toBe(5); // 10 - 5
    });

    it('超时 15 分钟（边界值）应该扣除 50%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 15);
      
      expect(result.overtime).toBe(15);
      expect(result.penalty).toBe(5); // 10 * 0.5
      expect(result.payment).toBe(5); // 10 - 5
    });
  });

  describe('严重超时（15分钟以上）', () => {
    it('超时 15.1 分钟应该扣除 70%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 15.1);
      
      expect(result.overtime).toBeCloseTo(15.1);
      expect(result.penalty).toBeCloseTo(7); // 10 * 0.7
      expect(result.payment).toBeCloseTo(3); // 10 - 7
    });

    it('超时 20 分钟应该扣除 70%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 20);
      
      expect(result.overtime).toBe(20);
      expect(result.penalty).toBe(7); // 10 * 0.7
      expect(result.payment).toBe(3); // 10 - 7
    });

    it('超时 30 分钟应该扣除 70%', () => {
      const result = calculatePayment(deliveryFee, deadline, deadline + 30);
      
      expect(result.overtime).toBe(30);
      expect(result.penalty).toBe(7); // 10 * 0.7
      expect(result.payment).toBe(3); // 10 - 7
    });
  });

  describe('不同配送费金额', () => {
    it('配送费 20 元，超时 8 分钟应该扣除 30%', () => {
      const result = calculatePayment(20, deadline, deadline + 8);
      
      expect(result.overtime).toBe(8);
      expect(result.penalty).toBe(6); // 20 * 0.3
      expect(result.payment).toBe(14); // 20 - 6
    });

    it('配送费 15.5 元，超时 12 分钟应该扣除 50%', () => {
      const result = calculatePayment(15.5, deadline, deadline + 12);
      
      expect(result.overtime).toBe(12);
      expect(result.penalty).toBe(7.75); // 15.5 * 0.5
      expect(result.payment).toBe(7.75); // 15.5 - 7.75
    });

    it('配送费 8.3 元，超时 18 分钟应该扣除 70%', () => {
      const result = calculatePayment(8.3, deadline, deadline + 18);
      
      expect(result.overtime).toBe(18);
      expect(result.penalty).toBeCloseTo(5.81); // 8.3 * 0.7
      expect(result.payment).toBeCloseTo(2.49); // 8.3 - 5.81
    });
  });
});


// Property-Based Tests
import * as fc from 'fast-check';

describe('Penalty Calculator - Property-Based Tests', () => {
  describe('Property 18: Overtime Penalty Calculation', () => {
    // Feature: silicon-rider-bench, Property 18: 超时惩罚计算
    it('should calculate payment correctly based on overtime for all valid inputs', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 100, noNaN: true }), // deliveryFee
          fc.integer({ min: 0, max: 1440 }), // deadline
          fc.integer({ min: -60, max: 120 }), // overtime offset (can be negative for early delivery)
          (deliveryFee, deadline, overtimeOffset) => {
            const deliveryTime = deadline + overtimeOffset;
            const result = calculatePayment(deliveryFee, deadline, deliveryTime);
            
            // Calculate expected values
            const overtime = Math.max(0, deliveryTime - deadline);
            let expectedPenaltyRate = 0;
            
            if (overtime <= 5) {
              // 0-5分钟（含）：不扣款（0%）
              expectedPenaltyRate = 0;
            } else if (overtime <= 10) {
              // 5分钟（不含）-10分钟（含）：扣除 30%
              expectedPenaltyRate = 0.3;
            } else if (overtime <= 15) {
              // 10分钟（不含）-15分钟（含）：扣除 50%
              expectedPenaltyRate = 0.5;
            } else {
              // 15分钟以上：扣除 70%
              expectedPenaltyRate = 0.7;
            }
            
            const expectedPenalty = deliveryFee * expectedPenaltyRate;
            const expectedPayment = deliveryFee - expectedPenalty;
            
            // Verify overtime calculation
            expect(result.overtime).toBe(overtime);
            
            // Verify penalty calculation
            expect(result.penalty).toBeCloseTo(expectedPenalty, 2);
            
            // Verify payment calculation
            expect(result.payment).toBeCloseTo(expectedPayment, 2);
            
            // Verify payment is always non-negative
            expect(result.payment).toBeGreaterThanOrEqual(0);
            
            // Verify payment + penalty = deliveryFee
            expect(result.payment + result.penalty).toBeCloseTo(deliveryFee, 2);
            
            // Verify penalty rate is one of the valid values
            const actualPenaltyRate = result.penalty / deliveryFee;
            expect([0, 0.3, 0.5, 0.7]).toContain(Math.round(actualPenaltyRate * 10) / 10);
            
            // Verify payment is always <= deliveryFee
            expect(result.payment).toBeLessThanOrEqual(deliveryFee);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    it('should handle edge cases at penalty boundaries', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 100, noNaN: true }), // deliveryFee
          fc.integer({ min: 0, max: 1440 }), // deadline
          (deliveryFee, deadline) => {
            // Test boundary at 5 minutes
            const result5 = calculatePayment(deliveryFee, deadline, deadline + 5);
            expect(result5.penalty).toBe(0);
            
            const result5_1 = calculatePayment(deliveryFee, deadline, deadline + 5.1);
            expect(result5_1.penalty).toBeCloseTo(deliveryFee * 0.3, 2);
            
            // Test boundary at 10 minutes
            const result10 = calculatePayment(deliveryFee, deadline, deadline + 10);
            expect(result10.penalty).toBeCloseTo(deliveryFee * 0.3, 2);
            
            const result10_1 = calculatePayment(deliveryFee, deadline, deadline + 10.1);
            expect(result10_1.penalty).toBeCloseTo(deliveryFee * 0.5, 2);
            
            // Test boundary at 15 minutes
            const result15 = calculatePayment(deliveryFee, deadline, deadline + 15);
            expect(result15.penalty).toBeCloseTo(deliveryFee * 0.5, 2);
            
            const result15_1 = calculatePayment(deliveryFee, deadline, deadline + 15.1);
            expect(result15_1.penalty).toBeCloseTo(deliveryFee * 0.7, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
