/**
 * 评分计算器测试
 * Silicon Rider Bench - Agent 基准测试系统
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { ScoreCalculator, OrderCompletionRecord } from './score-calculator';

describe('ScoreCalculator', () => {
  let calculator: ScoreCalculator;

  beforeEach(() => {
    calculator = new ScoreCalculator();
  });

  describe('Basic Functionality', () => {
    it('should initialize with zero values', () => {
      const metrics = calculator.calculateMetrics();
      
      expect(metrics.totalProfit).toBe(0);
      expect(metrics.onTimeRate).toBe(0);
      expect(metrics.pathEfficiency).toBe(1.0);
      expect(metrics.apiViolationRate).toBe(0);
      expect(metrics.completedOrders).toBe(0);
    });

    it('should record order completion correctly', () => {
      const record: OrderCompletionRecord = {
        orderId: 'order-1',
        orderType: 'food',
        deliveryFee: 10,
        payment: 10,
        penalty: 0,
        overtime: 0,
        onTime: true,
        distance: 5,
        optimalDistance: 5,
      };

      calculator.recordOrderCompletion(record);
      const metrics = calculator.calculateMetrics();

      expect(metrics.completedOrders).toBe(1);
      expect(metrics.onTimeOrders).toBe(1);
      expect(metrics.totalRevenue).toBe(10);
    });

    it('should record tool calls correctly', () => {
      calculator.recordToolCall(true);
      calculator.recordToolCall(true);
      calculator.recordToolCall(false);

      const metrics = calculator.calculateMetrics();

      expect(metrics.totalToolCalls).toBe(3);
      expect(metrics.invalidToolCalls).toBe(1);
    });

    it('should record battery swaps correctly', () => {
      calculator.recordBatterySwap(0.5);
      calculator.recordBatterySwap(0.5);

      const metrics = calculator.calculateMetrics();

      expect(metrics.batterySwaps).toBe(2);
      expect(metrics.totalCost).toBe(1.0);
    });
  });

  describe('Profit Calculation', () => {
    it('should calculate profit as revenue minus costs', () => {
      calculator.recordOrderCompletion({
        orderId: 'order-1',
        orderType: 'food',
        deliveryFee: 10,
        payment: 10,
        penalty: 0,
        overtime: 0,
        onTime: true,
        distance: 5,
        optimalDistance: 5,
      });

      calculator.recordBatterySwap(0.5);

      const profit = calculator.calculateTotalProfit();
      expect(profit).toBe(9.5); // 10 - 0.5
    });

    it('should handle penalties in profit calculation', () => {
      calculator.recordOrderCompletion({
        orderId: 'order-1',
        orderType: 'food',
        deliveryFee: 10,
        payment: 7, // 30% penalty
        penalty: 3,
        overtime: 8,
        onTime: false,
        distance: 5,
        optimalDistance: 5,
      });

      const profit = calculator.calculateTotalProfit();
      expect(profit).toBe(7); // Payment already has penalty deducted
    });
  });

  describe('On-Time Rate Calculation', () => {
    it('should calculate on-time rate correctly', () => {
      calculator.recordOrderCompletion({
        orderId: 'order-1',
        orderType: 'food',
        deliveryFee: 10,
        payment: 10,
        penalty: 0,
        overtime: 0,
        onTime: true,
        distance: 5,
        optimalDistance: 5,
      });

      calculator.recordOrderCompletion({
        orderId: 'order-2',
        orderType: 'food',
        deliveryFee: 10,
        payment: 7,
        penalty: 3,
        overtime: 8,
        onTime: false,
        distance: 5,
        optimalDistance: 5,
      });

      const rate = calculator.calculateOnTimeRate();
      expect(rate).toBe(0.5); // 1 out of 2
    });

    it('should return 0 when no orders completed', () => {
      const rate = calculator.calculateOnTimeRate();
      expect(rate).toBe(0);
    });
  });

  describe('Path Efficiency Calculation', () => {
    it('should calculate path efficiency correctly', () => {
      calculator.recordOrderCompletion({
        orderId: 'order-1',
        orderType: 'food',
        deliveryFee: 10,
        payment: 10,
        penalty: 0,
        overtime: 0,
        onTime: true,
        distance: 6,
        optimalDistance: 5,
      });

      calculator.recordDistance(6);

      const efficiency = calculator.calculatePathEfficiency();
      expect(efficiency).toBe(1.2); // 6 / 5
    });

    it('should return 1.0 when optimal distance is 0', () => {
      const efficiency = calculator.calculatePathEfficiency();
      expect(efficiency).toBe(1.0);
    });
  });

  describe('API Violation Rate Calculation', () => {
    it('should calculate API violation rate correctly', () => {
      calculator.recordToolCall(true);
      calculator.recordToolCall(true);
      calculator.recordToolCall(false);
      calculator.recordToolCall(false);

      const rate = calculator.calculateApiViolationRate();
      expect(rate).toBe(0.5); // 2 out of 4
    });

    it('should return 0 when no tool calls made', () => {
      const rate = calculator.calculateApiViolationRate();
      expect(rate).toBe(0);
    });
  });

  describe('Order Type Distribution', () => {
    it('should track order types correctly', () => {
      calculator.recordOrderCompletion({
        orderId: 'order-1',
        orderType: 'food',
        deliveryFee: 10,
        payment: 10,
        penalty: 0,
        overtime: 0,
        onTime: true,
        distance: 5,
        optimalDistance: 5,
      });

      calculator.recordOrderCompletion({
        orderId: 'order-2',
        orderType: 'supermarket',
        deliveryFee: 15,
        payment: 15,
        penalty: 0,
        overtime: 0,
        onTime: true,
        distance: 5,
        optimalDistance: 5,
      });

      calculator.recordOrderCompletion({
        orderId: 'order-3',
        orderType: 'pharmacy',
        deliveryFee: 20,
        payment: 20,
        penalty: 0,
        overtime: 0,
        onTime: true,
        distance: 5,
        optimalDistance: 5,
      });

      const metrics = calculator.calculateMetrics();

      expect(metrics.foodOrders).toBe(1);
      expect(metrics.supermarketOrders).toBe(1);
      expect(metrics.pharmacyOrders).toBe(1);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all statistics', () => {
      calculator.recordOrderCompletion({
        orderId: 'order-1',
        orderType: 'food',
        deliveryFee: 10,
        payment: 10,
        penalty: 0,
        overtime: 0,
        onTime: true,
        distance: 5,
        optimalDistance: 5,
      });

      calculator.recordToolCall(true);
      calculator.recordBatterySwap(0.5);

      calculator.reset();

      const metrics = calculator.calculateMetrics();

      expect(metrics.completedOrders).toBe(0);
      expect(metrics.totalToolCalls).toBe(0);
      expect(metrics.batterySwaps).toBe(0);
      expect(metrics.totalProfit).toBe(0);
    });
  });
});

// Property-Based Tests
describe('ScoreCalculator - Property-Based Tests', () => {
  describe('Property 31: Score Metrics Calculation', () => {
    // Feature: silicon-rider-bench, Property 31: 评分指标计算
    it('should calculate total profit as sum of payments minus costs', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              orderId: fc.string(),
              orderType: fc.constantFrom('food', 'supermarket', 'pharmacy'),
              deliveryFee: fc.float({ min: Math.fround(3.65), max: 30, noNaN: true }),
              payment: fc.float({ min: 0, max: 30, noNaN: true }),
              penalty: fc.float({ min: 0, max: 21, noNaN: true }),
              overtime: fc.float({ min: 0, max: 60, noNaN: true }),
              onTime: fc.boolean(),
              distance: fc.float({ min: 0, max: 20, noNaN: true }),
              optimalDistance: fc.float({ min: 0, max: 20, noNaN: true }),
            }),
            { minLength: 0, maxLength: 50 }
          ),
          fc.array(
            fc.constant(0.5), // Battery swap cost
            { minLength: 0, maxLength: 10 }
          ),
          (orderRecords, swapCosts) => {
            const calculator = new ScoreCalculator();

            // Record all orders
            for (const record of orderRecords) {
              calculator.recordOrderCompletion(record);
            }

            // Record all battery swaps
            for (const cost of swapCosts) {
              calculator.recordBatterySwap(cost);
            }

            const metrics = calculator.calculateMetrics();

            // Calculate expected profit
            const totalRevenue = orderRecords.reduce(
              (sum, r) => sum + r.payment,
              0
            );
            const totalCost = swapCosts.reduce((sum, c) => sum + c, 0);
            const expectedProfit = totalRevenue - totalCost;

            // Verify: Total profit = sum of payments - costs
            expect(metrics.totalProfit).toBeCloseTo(expectedProfit, 2);

            // Verify: Total revenue matches sum of payments
            expect(metrics.totalRevenue).toBeCloseTo(totalRevenue, 2);

            // Verify: Total cost matches sum of costs
            expect(metrics.totalCost).toBeCloseTo(totalCost, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate on-time rate as ratio of on-time orders to total orders', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              orderId: fc.string(),
              orderType: fc.constantFrom('food', 'supermarket', 'pharmacy'),
              deliveryFee: fc.float({ min: Math.fround(3.65), max: 30, noNaN: true }),
              payment: fc.float({ min: 0, max: 30, noNaN: true }),
              penalty: fc.float({ min: 0, max: 21, noNaN: true }),
              overtime: fc.float({ min: 0, max: 60, noNaN: true }),
              onTime: fc.boolean(),
              distance: fc.float({ min: 0, max: 20, noNaN: true }),
              optimalDistance: fc.float({ min: 0, max: 20, noNaN: true }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (orderRecords) => {
            const calculator = new ScoreCalculator();

            for (const record of orderRecords) {
              calculator.recordOrderCompletion(record);
            }

            const metrics = calculator.calculateMetrics();

            // Calculate expected on-time rate
            const onTimeCount = orderRecords.filter(r => r.onTime).length;
            const expectedRate = onTimeCount / orderRecords.length;

            // Verify: On-time rate = on-time orders / total orders
            expect(metrics.onTimeRate).toBeCloseTo(expectedRate, 10);

            // Verify: On-time rate is between 0 and 1
            expect(metrics.onTimeRate).toBeGreaterThanOrEqual(0);
            expect(metrics.onTimeRate).toBeLessThanOrEqual(1);

            // Verify: Completed orders count matches
            expect(metrics.completedOrders).toBe(orderRecords.length);

            // Verify: On-time orders count matches
            expect(metrics.onTimeOrders).toBe(onTimeCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate path efficiency as actual distance over optimal distance', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              orderId: fc.string(),
              orderType: fc.constantFrom('food', 'supermarket', 'pharmacy'),
              deliveryFee: fc.float({ min: Math.fround(3.65), max: 30, noNaN: true }),
              payment: fc.float({ min: 0, max: 30, noNaN: true }),
              penalty: fc.float({ min: 0, max: 21, noNaN: true }),
              overtime: fc.float({ min: 0, max: 60, noNaN: true }),
              onTime: fc.boolean(),
              distance: fc.float({ min: Math.fround(0.1), max: 20, noNaN: true }),
              optimalDistance: fc.float({ min: Math.fround(0.1), max: 20, noNaN: true }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (orderRecords) => {
            const calculator = new ScoreCalculator();

            let totalActualDistance = 0;
            for (const record of orderRecords) {
              calculator.recordOrderCompletion(record);
              calculator.recordDistance(record.distance);
              totalActualDistance += record.distance;
            }

            const metrics = calculator.calculateMetrics();

            // Calculate expected path efficiency
            const totalOptimalDistance = orderRecords.reduce(
              (sum, r) => sum + r.optimalDistance,
              0
            );
            const expectedEfficiency = totalActualDistance / totalOptimalDistance;

            // Verify: Path efficiency = actual distance / optimal distance
            expect(metrics.pathEfficiency).toBeCloseTo(expectedEfficiency, 10);

            // Verify: Path efficiency is >= 1.0 (can't be better than optimal)
            // Note: In practice it could be < 1.0 if actual < optimal, but typically >= 1.0
            expect(metrics.pathEfficiency).toBeGreaterThan(0);

            // Verify: Distances match
            expect(metrics.totalDistance).toBeCloseTo(totalActualDistance, 2);
            expect(metrics.optimalDistance).toBeCloseTo(totalOptimalDistance, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should calculate API violation rate as invalid calls over total calls', () => {
      fc.assert(
        fc.property(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 100 }),
          (toolCallResults) => {
            const calculator = new ScoreCalculator();

            for (const isValid of toolCallResults) {
              calculator.recordToolCall(isValid);
            }

            const metrics = calculator.calculateMetrics();

            // Calculate expected violation rate
            const invalidCount = toolCallResults.filter(v => !v).length;
            const expectedRate = invalidCount / toolCallResults.length;

            // Verify: API violation rate = invalid calls / total calls
            expect(metrics.apiViolationRate).toBeCloseTo(expectedRate, 10);

            // Verify: Violation rate is between 0 and 1
            expect(metrics.apiViolationRate).toBeGreaterThanOrEqual(0);
            expect(metrics.apiViolationRate).toBeLessThanOrEqual(1);

            // Verify: Call counts match
            expect(metrics.totalToolCalls).toBe(toolCallResults.length);
            expect(metrics.invalidToolCalls).toBe(invalidCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain consistency across all metrics', () => {
      fc.assert(
        fc.property(
          fc.record({
            orders: fc.array(
              fc.record({
                orderId: fc.string(),
                orderType: fc.constantFrom('food', 'supermarket', 'pharmacy'),
                deliveryFee: fc.float({ min: Math.fround(3.65), max: 30, noNaN: true }),
                payment: fc.float({ min: 0, max: 30, noNaN: true }),
                penalty: fc.float({ min: 0, max: 21, noNaN: true }),
                overtime: fc.float({ min: 0, max: 60, noNaN: true }),
                onTime: fc.boolean(),
                distance: fc.float({ min: 0, max: 20, noNaN: true }),
                optimalDistance: fc.float({ min: 0, max: 20, noNaN: true }),
              }),
              { minLength: 0, maxLength: 30 }
            ),
            toolCalls: fc.array(fc.boolean(), { minLength: 0, maxLength: 50 }),
            batterySwaps: fc.integer({ min: 0, max: 10 }),
          }),
          ({ orders, toolCalls, batterySwaps }) => {
            const calculator = new ScoreCalculator();

            // Record all data
            for (const order of orders) {
              calculator.recordOrderCompletion(order);
              calculator.recordDistance(order.distance);
            }

            for (const isValid of toolCalls) {
              calculator.recordToolCall(isValid);
            }

            for (let i = 0; i < batterySwaps; i++) {
              calculator.recordBatterySwap(0.5);
            }

            const metrics = calculator.calculateMetrics();

            // Verify: Order type counts sum to total
            const typeSum = metrics.foodOrders + metrics.supermarketOrders + metrics.pharmacyOrders;
            expect(typeSum).toBe(metrics.completedOrders);

            // Verify: On-time + late orders = total orders
            const lateOrders = metrics.completedOrders - metrics.onTimeOrders;
            expect(metrics.onTimeOrders + lateOrders).toBe(metrics.completedOrders);

            // Verify: Average profit calculation
            if (metrics.completedOrders > 0) {
              const expectedAvgProfit = metrics.totalProfit / metrics.completedOrders;
              expect(metrics.averageProfit).toBeCloseTo(expectedAvgProfit, 2);
            } else {
              expect(metrics.averageProfit).toBe(0);
            }

            // Verify: Battery swap count and cost
            expect(metrics.batterySwaps).toBe(batterySwaps);
            expect(metrics.totalCost).toBeCloseTo(batterySwaps * 0.5, 2);

            // Verify: Profit = Revenue - Cost
            const calculatedProfit = metrics.totalRevenue - metrics.totalCost;
            expect(metrics.totalProfit).toBeCloseTo(calculatedProfit, 2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
