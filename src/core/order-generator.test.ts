/**
 * 订单生成系统属性测试
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { OrderGenerator } from './order-generator';
import { Node, OrderType } from '../types';

describe('OrderGenerator Property Tests', () => {
  // 辅助函数：创建测试节点
  function createTestNodes(): { pickupNodes: Node[]; deliveryNodes: Node[] } {
    const pickupNodes: Node[] = [
      { id: 'r1', type: 'restaurant', position: { x: 0, y: 0 }, name: 'Restaurant 1' },
      { id: 'r2', type: 'restaurant', position: { x: 1, y: 1 }, name: 'Restaurant 2' },
      { id: 's1', type: 'supermarket', position: { x: 2, y: 2 }, name: 'Supermarket 1' },
      { id: 'p1', type: 'pharmacy', position: { x: 3, y: 3 }, name: 'Pharmacy 1' },
    ];
    
    const deliveryNodes: Node[] = [
      { id: 'd1', type: 'residential', position: { x: 4, y: 4 }, name: 'Residential 1' },
      { id: 'd2', type: 'residential', position: { x: 5, y: 5 }, name: 'Residential 2' },
      { id: 'd3', type: 'office', position: { x: 6, y: 6 }, name: 'Office 1' },
    ];
    
    return { pickupNodes, deliveryNodes };
  }

  // 辅助函数：简单的距离计算器
  function simpleDistanceCalculator(from: string, to: string): number {
    // 返回固定距离用于测试
    return 2.5;
  }

  /**
   * Feature: silicon-rider-bench, Property 23: 配送时限计算
   * Validates: Requirements 21.1, 21.2
   * 
   * 对于任意订单距离 d（km），配送时限应该等于：
   * d < 3 时为 20 分钟，d >= 3 时为 20 + (d - 3) × 3 分钟
   */
  it('Property 23: 配送时限计算', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }), // seed
        fc.float({ min: 0.5, max: 10, noNaN: true }), // distance
        (seed, distance) => {
          const generator = new OrderGenerator(seed);
          const { pickupNodes, deliveryNodes } = createTestNodes();
          
          // 创建返回指定距离的距离计算器
          const distanceCalculator = () => distance;
          
          const order = generator.generateOrder(
            0,
            pickupNodes,
            deliveryNodes,
            distanceCalculator
          );
          
          // 验证配送时限计算
          let expectedTimeLimit: number;
          if (distance < 3) {
            expectedTimeLimit = 20;
          } else {
            expectedTimeLimit = 20 + (distance - 3) * 3;
          }
          
          // 允许小的浮点误差
          expect(Math.abs(order.timeLimit - expectedTimeLimit)).toBeLessThan(0.01);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: silicon-rider-bench, Property 28: 订单类型重量范围
   * Validates: Requirements 19.1, 19.2, 19.4
   * 
   * 对于任意生成的订单，重量应该在类型对应的范围内：
   * 餐饮(0.5-1kg)，超市(5-10kg)，药店(0.05-0.2kg)
   */
  it('Property 28: 订单类型重量范围', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }), // seed
        fc.integer({ min: 0, max: 1439 }), // currentTime (0-1439 minutes in a day)
        (seed, currentTime) => {
          const generator = new OrderGenerator(seed);
          const { pickupNodes, deliveryNodes } = createTestNodes();
          
          // 生成多个订单以覆盖不同类型
          const orders = generator.generateOrders(
            10,
            currentTime,
            pickupNodes,
            deliveryNodes,
            simpleDistanceCalculator
          );
          
          // 验证每个订单的重量在其类型对应的范围内
          for (const order of orders) {
            switch (order.type) {
              case 'food':
                expect(order.weight).toBeGreaterThanOrEqual(0.5);
                expect(order.weight).toBeLessThanOrEqual(1);
                break;
              case 'supermarket':
                expect(order.weight).toBeGreaterThanOrEqual(5);
                expect(order.weight).toBeLessThanOrEqual(10);
                break;
              case 'pharmacy':
                expect(order.weight).toBeGreaterThanOrEqual(0.05);
                expect(order.weight).toBeLessThanOrEqual(0.2);
                break;
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: silicon-rider-bench, Property 29: 订单潮汐频率
   * Validates: Requirements 18.1-18.6
   * 
   * 对于任意时段，订单生成频率应该符合潮汐规则：
   * 早高峰(6-9)餐饮×3，午高峰(10:30-12:30)餐饮×4，
   * 下午(15-17)超市×3，晚高峰(18-20)餐饮×4，
   * 夜宵(21-24)餐饮×2，深夜(0-6)药店×2
   * 
   * 测试策略：验证潮汐时段的订单类型分布与非潮汐时段有显著差异
   */
  it('Property 29: 订单潮汐频率', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 999999 }), // seed
        (seed) => {
          const generator1 = new OrderGenerator(seed);
          const generator2 = new OrderGenerator(seed + 1);
          const { pickupNodes, deliveryNodes } = createTestNodes();
          
          // 测试深夜时段（0-6点）：药店订单应该占比最高
          const nightOrders = generator1.generateOrders(
            200,
            180, // 3:00 AM
            pickupNodes,
            deliveryNodes,
            simpleDistanceCalculator
          );
          
          const nightCounts: Record<OrderType, number> = {
            food: 0,
            supermarket: 0,
            pharmacy: 0,
          };
          
          for (const order of nightOrders) {
            nightCounts[order.type]++;
          }
          
          // 深夜时段药店订单应该是最多的
          expect(nightCounts.pharmacy).toBeGreaterThan(nightCounts.food);
          expect(nightCounts.pharmacy).toBeGreaterThan(nightCounts.supermarket);
          
          // 测试午高峰（11:00）：餐饮订单应该占比最高
          const lunchOrders = generator2.generateOrders(
            200,
            660, // 11:00 AM
            pickupNodes,
            deliveryNodes,
            simpleDistanceCalculator
          );
          
          const lunchCounts: Record<OrderType, number> = {
            food: 0,
            supermarket: 0,
            pharmacy: 0,
          };
          
          for (const order of lunchOrders) {
            lunchCounts[order.type]++;
          }
          
          // 午高峰餐饮订单应该是最多的，且占比应该很高
          expect(lunchCounts.food).toBeGreaterThan(lunchCounts.supermarket);
          expect(lunchCounts.food).toBeGreaterThan(lunchCounts.pharmacy);
          expect(lunchCounts.food / lunchOrders.length).toBeGreaterThan(0.6);
        }
      ),
      { numRuns: 100 }
    );
  });

  // 额外的单元测试以确保基本功能正常
  describe('Basic Functionality', () => {
    it('should generate orders with valid IDs', () => {
      const generator = new OrderGenerator(12345);
      const { pickupNodes, deliveryNodes } = createTestNodes();
      
      const order = generator.generateOrder(
        0,
        pickupNodes,
        deliveryNodes,
        simpleDistanceCalculator
      );
      
      expect(order.id).toMatch(/^order_\d+$/);
    });

    it('should accept orders and remove from available pool', () => {
      const generator = new OrderGenerator(12345);
      const { pickupNodes, deliveryNodes } = createTestNodes();
      
      const order = generator.generateOrder(
        0,
        pickupNodes,
        deliveryNodes,
        simpleDistanceCalculator
      );
      
      const availableBefore = generator.getAvailableOrders().length;
      const acceptedOrder = generator.acceptOrder(order.id, 60);
      const availableAfter = generator.getAvailableOrders().length;
      
      expect(acceptedOrder).toBeDefined();
      expect(acceptedOrder?.acceptedAt).toBe(60);
      expect(availableAfter).toBe(availableBefore - 1);
    });

    it('should search nearby orders within radius', () => {
      const generator = new OrderGenerator(12345);
      const { pickupNodes, deliveryNodes } = createTestNodes();
      
      // 生成一些订单
      generator.generateOrders(5, 0, pickupNodes, deliveryNodes, simpleDistanceCalculator);
      
      // 搜索附近订单（使用简单的距离计算器，所有订单都在范围内）
      const nearbyOrders = generator.searchNearbyOrders(
        'r1',
        5,
        simpleDistanceCalculator
      );
      
      expect(nearbyOrders.length).toBeGreaterThan(0);
    });
  });
});
