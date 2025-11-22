/**
 * 移动计算模块单元测试
 * 
 * 测试：
 * - 正常移动的时间和电量消耗
 * - 途中没电的分段计算
 * - 推行模式
 * 
 * 需求：7.1-7.6
 */

import { describe, it, expect } from 'vitest';
import { MovementCalculator } from './movement-calculator.js';

describe('MovementCalculator', () => {
  describe('calculateSpeed', () => {
    it('should return pushing speed when battery is 0', () => {
      const speed = MovementCalculator.calculateSpeed(0.2, 0);
      expect(speed).toBe(10); // 推行速度
    });

    it('should return 30 km/h for normal congestion with battery', () => {
      const speed = MovementCalculator.calculateSpeed(0.2, 50);
      expect(speed).toBe(30);
    });

    it('should return 25 km/h for light congestion', () => {
      const speed = MovementCalculator.calculateSpeed(0.4, 50);
      expect(speed).toBe(25);
    });

    it('should return 20 km/h for moderate congestion', () => {
      const speed = MovementCalculator.calculateSpeed(0.6, 50);
      expect(speed).toBe(20);
    });

    it('should return 15 km/h for heavy congestion', () => {
      const speed = MovementCalculator.calculateSpeed(0.8, 50);
      expect(speed).toBe(15);
    });
  });

  describe('calculateBatteryRange', () => {
    it('should return 50 km for 100% battery', () => {
      const range = MovementCalculator.calculateBatteryRange(100);
      expect(range).toBe(50);
    });

    it('should return 25 km for 50% battery', () => {
      const range = MovementCalculator.calculateBatteryRange(50);
      expect(range).toBe(25);
    });

    it('should return 0 km for 0% battery', () => {
      const range = MovementCalculator.calculateBatteryRange(0);
      expect(range).toBe(0);
    });

    it('should return 10 km for 20% battery', () => {
      const range = MovementCalculator.calculateBatteryRange(20);
      expect(range).toBe(10);
    });
  });

  describe('calculateBatteryCost', () => {
    it('should consume 2% per km', () => {
      expect(MovementCalculator.calculateBatteryCost(1)).toBe(2);
      expect(MovementCalculator.calculateBatteryCost(5)).toBe(10);
      expect(MovementCalculator.calculateBatteryCost(10)).toBe(20);
    });
  });

  describe('calculateMovement - 正常移动', () => {
    it('should calculate time and battery cost for sufficient battery', () => {
      // 5km 移动，正常拥堵（30km/h），100% 电量
      const result = MovementCalculator.calculateMovement(5, 0.2, 100);

      // 时间 = 5km / 30km/h * 60 = 10 分钟
      expect(result.time).toBe(10);
      // 电量消耗 = 5km * 2% = 10%
      expect(result.batteryCost).toBe(10);
      // 没有推行
      expect(result.pushedDistance).toBe(0);
    });

    it('should calculate correctly with light congestion', () => {
      // 10km 移动，轻度拥堵（25km/h），100% 电量
      const result = MovementCalculator.calculateMovement(10, 0.4, 100);

      // 时间 = 10km / 25km/h * 60 = 24 分钟
      expect(result.time).toBe(24);
      // 电量消耗 = 10km * 2% = 20%
      expect(result.batteryCost).toBe(20);
      expect(result.pushedDistance).toBe(0);
    });

    it('should calculate correctly with moderate congestion', () => {
      // 6km 移动，中度拥堵（20km/h），60% 电量
      const result = MovementCalculator.calculateMovement(6, 0.6, 60);

      // 时间 = 6km / 20km/h * 60 = 18 分钟
      expect(result.time).toBe(18);
      // 电量消耗 = 6km * 2% = 12%
      expect(result.batteryCost).toBe(12);
      expect(result.pushedDistance).toBe(0);
    });

    it('should calculate correctly with heavy congestion', () => {
      // 3km 移动，重度拥堵（15km/h），50% 电量
      const result = MovementCalculator.calculateMovement(3, 0.8, 50);

      // 时间 = 3km / 15km/h * 60 = 12 分钟
      expect(result.time).toBe(12);
      // 电量消耗 = 3km * 2% = 6%
      expect(result.batteryCost).toBe(6);
      expect(result.pushedDistance).toBe(0);
    });
  });

  describe('calculateMovement - 途中没电', () => {
    it('should handle running out of battery mid-journey', () => {
      // 20km 移动，正常拥堵（30km/h），20% 电量（续航 10km）
      const result = MovementCalculator.calculateMovement(20, 0.2, 20);

      // 骑行阶段：10km / 30km/h * 60 = 20 分钟
      // 推行阶段：10km / 10km/h * 60 = 60 分钟
      // 总时间 = 80 分钟
      expect(result.time).toBe(80);
      // 电量消耗 = 20%（耗尽所有电量）
      expect(result.batteryCost).toBe(20);
      // 推行距离 = 10km
      expect(result.pushedDistance).toBe(10);
    });

    it('should handle battery running out with congestion', () => {
      // 15km 移动，轻度拥堵（25km/h），30% 电量（续航 15km）
      // 刚好耗尽电量
      const result = MovementCalculator.calculateMovement(15, 0.4, 30);

      // 骑行阶段：15km / 25km/h * 60 = 36 分钟
      expect(result.time).toBe(36);
      // 电量消耗 = 30%（耗尽所有电量）
      expect(result.batteryCost).toBe(30);
      // 没有推行（刚好用完）
      expect(result.pushedDistance).toBe(0);
    });

    it('should handle very low battery', () => {
      // 10km 移动，正常拥堵（30km/h），4% 电量（续航 2km）
      const result = MovementCalculator.calculateMovement(10, 0.2, 4);

      // 骑行阶段：2km / 30km/h * 60 = 4 分钟
      // 推行阶段：8km / 10km/h * 60 = 48 分钟
      // 总时间 = 52 分钟
      expect(result.time).toBe(52);
      // 电量消耗 = 4%（耗尽所有电量）
      expect(result.batteryCost).toBe(4);
      // 推行距离 = 8km
      expect(result.pushedDistance).toBe(8);
    });
  });

  describe('calculateMovement - 推行模式', () => {
    it('should use pushing speed when battery is 0', () => {
      // 5km 移动，正常拥堵，0% 电量
      const result = MovementCalculator.calculateMovement(5, 0.2, 0);

      // 全程推行：5km / 10km/h * 60 = 30 分钟
      expect(result.time).toBe(30);
      // 电量消耗 = 0%（已经没电）
      expect(result.batteryCost).toBe(0);
      // 推行距离 = 5km
      expect(result.pushedDistance).toBe(5);
    });

    it('should push entire distance with 0 battery regardless of congestion', () => {
      // 拥堵不影响推行速度
      const result1 = MovementCalculator.calculateMovement(10, 0.2, 0);
      const result2 = MovementCalculator.calculateMovement(10, 0.8, 0);

      // 两者时间应该相同：10km / 10km/h * 60 = 60 分钟
      expect(result1.time).toBe(60);
      expect(result2.time).toBe(60);
      expect(result1.pushedDistance).toBe(10);
      expect(result2.pushedDistance).toBe(10);
    });
  });

  describe('calculateMovement - 边界情况', () => {
    it('should handle 0 distance', () => {
      const result = MovementCalculator.calculateMovement(0, 0.2, 50);

      expect(result.time).toBe(0);
      expect(result.batteryCost).toBe(0);
      expect(result.pushedDistance).toBe(0);
    });

    it('should handle very short distance', () => {
      // 0.1km 移动
      const result = MovementCalculator.calculateMovement(0.1, 0.2, 50);

      // 时间 = 0.1km / 30km/h * 60 = 0.2 分钟
      expect(result.time).toBeCloseTo(0.2, 5);
      // 电量消耗 = 0.1km * 2% = 0.2%
      expect(result.batteryCost).toBeCloseTo(0.2, 5);
      expect(result.pushedDistance).toBe(0);
    });

    it('should handle maximum distance with full battery', () => {
      // 50km 移动（满电续航），正常拥堵
      const result = MovementCalculator.calculateMovement(50, 0.2, 100);

      // 时间 = 50km / 30km/h * 60 = 100 分钟
      expect(result.time).toBe(100);
      // 电量消耗 = 50km * 2% = 100%
      expect(result.batteryCost).toBe(100);
      expect(result.pushedDistance).toBe(0);
    });
  });
});

// ============================================================================
// 属性测试（Property-Based Tests）
// ============================================================================

import * as fc from 'fast-check';

describe('MovementCalculator - Property-Based Tests', () => {
  /**
   * Feature: silicon-rider-bench, Property 13: 电量消耗比例
   * 
   * 对于任意移动距离 d（km），当电量充足时，电量消耗应该等于 d × 2%
   * 
   * 验证：需求 7.3
   */
  describe('Property 13: 电量消耗比例', () => {
    it('should consume 2% battery per km when battery is sufficient', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.1), max: 25, noNaN: true }), // 距离（确保电量充足）
          fc.float({ min: 0, max: 1, noNaN: true }),    // 拥堵程度
          (distance, congestion) => {
            // 确保电量充足（至少是所需电量的 1.5 倍）
            const requiredBattery = distance * 2;
            const battery = Math.min(100, requiredBattery * 1.5);

            const result = MovementCalculator.calculateMovement(distance, congestion, battery);

            // 验证：电量消耗应该等于距离 × 2%
            const expectedBatteryCost = distance * 2;
            expect(result.batteryCost).toBeCloseTo(expectedBatteryCost, 5);

            // 验证：没有推行
            expect(result.pushedDistance).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: silicon-rider-bench, Property 14: 移动时间计算
   * 
   * 对于任意移动，当电量充足时，通行时间应该等于 (距离 / 速度) × 60 分钟，
   * 其中速度由拥堵程度决定
   * 
   * 验证：需求 7.2, 2.8
   */
  describe('Property 14: 移动时间计算', () => {
    it('should calculate time as (distance / speed) * 60 when battery is sufficient', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.1), max: 25, noNaN: true }), // 距离
          fc.float({ min: 0, max: 1, noNaN: true }),    // 拥堵程度
          (distance, congestion) => {
            // 确保电量充足
            const requiredBattery = distance * 2;
            const battery = Math.min(100, requiredBattery * 1.5);

            const result = MovementCalculator.calculateMovement(distance, congestion, battery);

            // 计算预期速度
            const speed = MovementCalculator.calculateSpeed(congestion, battery);

            // 验证：时间 = (距离 / 速度) × 60
            const expectedTime = (distance / speed) * 60;
            expect(result.time).toBeCloseTo(expectedTime, 5);

            // 验证：没有推行
            expect(result.pushedDistance).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use correct speed based on congestion level', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }), // 距离
          fc.constantFrom(0.1, 0.35, 0.55, 0.75),       // 不同拥堵级别
          (distance, congestion) => {
            const battery = 100; // 满电

            const result = MovementCalculator.calculateMovement(distance, congestion, battery);

            // 根据拥堵程度确定预期速度
            let expectedSpeed: number;
            if (congestion < 0.3) {
              expectedSpeed = 30;
            } else if (congestion < 0.5) {
              expectedSpeed = 25;
            } else if (congestion < 0.7) {
              expectedSpeed = 20;
            } else {
              expectedSpeed = 15;
            }

            // 验证：时间应该基于正确的速度计算
            const expectedTime = (distance / expectedSpeed) * 60;
            expect(result.time).toBeCloseTo(expectedTime, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Feature: silicon-rider-bench, Property 21: 电池续航计算
   * 
   * 对于任意电量百分比 b，剩余续航应该等于 b × 0.5 km（满电 50km）
   * 
   * 验证：需求 10.5
   */
  describe('Property 21: 电池续航计算', () => {
    it('should calculate battery range as battery * 0.5 km', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }), // 电量百分比
          (battery) => {
            const range = MovementCalculator.calculateBatteryRange(battery);

            // 验证：续航 = 电量 × 0.5 km
            const expectedRange = (battery / 100) * 50;
            expect(range).toBeCloseTo(expectedRange, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have 50km range at 100% battery', () => {
      fc.assert(
        fc.property(
          fc.constant(100), // 满电
          (battery) => {
            const range = MovementCalculator.calculateBatteryRange(battery);
            expect(range).toBe(50);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have 0km range at 0% battery', () => {
      fc.assert(
        fc.property(
          fc.constant(0), // 没电
          (battery) => {
            const range = MovementCalculator.calculateBatteryRange(battery);
            expect(range).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性测试：途中没电的分段计算
   */
  describe('Property: 途中没电的分段计算', () => {
    it('should correctly split journey when battery runs out mid-way', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 10, max: 50, noNaN: true }),  // 距离
          fc.float({ min: 0, max: 1, noNaN: true }),    // 拥堵程度
          fc.integer({ min: 1, max: 50 }),              // 电量（确保不足）
          (distance, congestion, battery) => {
            const batteryRange = MovementCalculator.calculateBatteryRange(battery);

            // 只测试电量不足的情况
            if (batteryRange >= distance) {
              return true; // 跳过电量充足的情况
            }

            const result = MovementCalculator.calculateMovement(distance, congestion, battery);

            // 验证：推行距离 = 总距离 - 电池续航
            const expectedPushedDistance = distance - batteryRange;
            expect(result.pushedDistance).toBeCloseTo(expectedPushedDistance, 5);

            // 验证：电量应该耗尽
            expect(result.batteryCost).toBe(battery);

            // 验证：时间应该是骑行时间 + 推行时间
            const ridingSpeed = MovementCalculator.calculateSpeed(congestion, battery);
            const ridingTime = (batteryRange / ridingSpeed) * 60;
            const pushingTime = (expectedPushedDistance / 10) * 60;
            const expectedTime = ridingTime + pushingTime;
            expect(result.time).toBeCloseTo(expectedTime, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性测试：推行模式
   */
  describe('Property: 推行模式', () => {
    it('should use pushing speed when battery is 0', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.1), max: 20, noNaN: true }), // 距离
          fc.float({ min: 0, max: 1, noNaN: true }),    // 拥堵程度（不影响推行）
          (distance, congestion) => {
            const battery = 0;

            const result = MovementCalculator.calculateMovement(distance, congestion, battery);

            // 验证：全程推行
            expect(result.pushedDistance).toBeCloseTo(distance, 5);

            // 验证：电量消耗为 0
            expect(result.batteryCost).toBe(0);

            // 验证：时间 = 距离 / 10km/h * 60
            const expectedTime = (distance / 10) * 60;
            expect(result.time).toBeCloseTo(expectedTime, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性测试：时间和电量的单调性
   */
  describe('Property: 单调性', () => {
    it('should have time increase monotonically with distance', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 20, noNaN: true }),  // 距离1
          fc.float({ min: 0, max: 1, noNaN: true }),   // 拥堵程度
          fc.integer({ min: 50, max: 100 }),           // 电量
          (distance1, congestion, battery) => {
            const distance2 = distance1 + 1; // 更长的距离

            const result1 = MovementCalculator.calculateMovement(distance1, congestion, battery);
            const result2 = MovementCalculator.calculateMovement(distance2, congestion, battery);

            // 验证：距离更长，时间应该更长
            expect(result2.time).toBeGreaterThan(result1.time);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should have battery cost increase monotonically with distance when sufficient', () => {
      fc.assert(
        fc.property(
          fc.float({ min: 1, max: 10, noNaN: true }),  // 距离1
          fc.float({ min: 0, max: 1, noNaN: true }),   // 拥堵程度
          (distance1, congestion) => {
            const distance2 = distance1 + 1; // 更长的距离
            const battery = 100; // 满电

            const result1 = MovementCalculator.calculateMovement(distance1, congestion, battery);
            const result2 = MovementCalculator.calculateMovement(distance2, congestion, battery);

            // 验证：距离更长，电量消耗应该更多
            expect(result2.batteryCost).toBeGreaterThan(result1.batteryCost);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
