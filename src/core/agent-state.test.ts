/**
 * 智能体状态管理测试
 * Silicon Rider Bench - Agent 基准测试系统
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AgentState } from './agent-state';
import { Order } from '../types';

describe('AgentState', () => {
  // ============================================================================
  // 单元测试
  // ============================================================================

  describe('基本功能', () => {
    it('应该正确初始化状态', () => {
      const agent = new AgentState('node1');
      
      expect(agent.getPosition()).toBe('node1');
      expect(agent.getBattery()).toBe(100);
      expect(agent.getCarriedOrders()).toEqual([]);
      expect(agent.getTotalWeight()).toBe(0);
      expect(agent.getRemainingCapacity()).toBe(10);
      expect(agent.getProfit()).toBe(0);
      expect(agent.getCompletedOrders()).toBe(0);
      expect(agent.getTotalDistance()).toBe(0);
    });

    it('应该正确更新位置', () => {
      const agent = new AgentState('node1');
      agent.updatePosition('node2');
      expect(agent.getPosition()).toBe('node2');
    });

    it('应该正确更新电量', () => {
      const agent = new AgentState('node1');
      agent.updateBattery(50);
      expect(agent.getBattery()).toBe(50);
    });

    it('应该正确消耗电量', () => {
      const agent = new AgentState('node1');
      agent.consumeBattery(30);
      expect(agent.getBattery()).toBe(70);
    });

    it('电量不应该低于0', () => {
      const agent = new AgentState('node1');
      agent.consumeBattery(150);
      expect(agent.getBattery()).toBe(0);
    });

    it('电量不应该高于100', () => {
      const agent = new AgentState('node1');
      agent.updateBattery(150);
      expect(agent.getBattery()).toBe(100);
    });

    it('应该正确计算电池续航', () => {
      const agent = new AgentState('node1');
      expect(agent.getBatteryRange()).toBe(50); // 100% * 50km
      
      agent.updateBattery(50);
      expect(agent.getBatteryRange()).toBe(25); // 50% * 50km
    });

    it('应该正确添加订单', () => {
      const agent = new AgentState('node1');
      const order: Order = {
        id: 'order1',
        type: 'food',
        pickupLocation: 'node2',
        deliveryLocation: 'node3',
        distance: 2,
        itemPrice: 30,
        deliveryFee: 5,
        weight: 0.8,
        timeLimit: 20,
        createdAt: 360,
        pickedUp: false,
        delivered: false,
      };

      agent.addOrder(order);
      expect(agent.getCarriedOrders()).toHaveLength(1);
      expect(agent.getTotalWeight()).toBe(0.8);
      expect(agent.getRemainingCapacity()).toBe(9.2);
    });

    it('应该正确移除订单', () => {
      const agent = new AgentState('node1');
      const order: Order = {
        id: 'order1',
        type: 'food',
        pickupLocation: 'node2',
        deliveryLocation: 'node3',
        distance: 2,
        itemPrice: 30,
        deliveryFee: 5,
        weight: 0.8,
        timeLimit: 20,
        createdAt: 360,
        pickedUp: false,
        delivered: false,
      };

      agent.addOrder(order);
      const removed = agent.removeOrder('order1');
      
      expect(removed).toBeDefined();
      expect(removed?.id).toBe('order1');
      expect(agent.getCarriedOrders()).toHaveLength(0);
      expect(agent.getTotalWeight()).toBe(0);
    });

    it('应该正确标记订单为已取餐', () => {
      const agent = new AgentState('node1');
      const order: Order = {
        id: 'order1',
        type: 'food',
        pickupLocation: 'node2',
        deliveryLocation: 'node3',
        distance: 2,
        itemPrice: 30,
        deliveryFee: 5,
        weight: 0.8,
        timeLimit: 20,
        createdAt: 360,
        pickedUp: false,
        delivered: false,
      };

      agent.addOrder(order);
      const success = agent.markOrderPickedUp('order1');
      
      expect(success).toBe(true);
      expect(agent.getCarriedOrders()[0].pickedUp).toBe(true);
    });

    it('应该正确处理利润', () => {
      const agent = new AgentState('node1');
      agent.addProfit(10);
      expect(agent.getProfit()).toBe(10);
      
      agent.deductCost(3);
      expect(agent.getProfit()).toBe(7);
    });

    it('应该正确增加完成订单数', () => {
      const agent = new AgentState('node1');
      agent.incrementCompletedOrders();
      agent.incrementCompletedOrders();
      expect(agent.getCompletedOrders()).toBe(2);
    });

    it('应该正确累计行驶距离', () => {
      const agent = new AgentState('node1');
      agent.addDistance(5.5);
      agent.addDistance(3.2);
      expect(agent.getTotalDistance()).toBeCloseTo(8.7);
    });
  });

  describe('承载能力检查', () => {
    it('应该在订单数量达到5单时拒绝新订单', () => {
      const agent = new AgentState('node1');
      
      // 添加5个订单
      for (let i = 0; i < 5; i++) {
        const order: Order = {
          id: `order${i}`,
          type: 'food',
          pickupLocation: 'node2',
          deliveryLocation: 'node3',
          distance: 2,
          itemPrice: 30,
          deliveryFee: 5,
          weight: 0.5,
          timeLimit: 20,
          createdAt: 360,
          pickedUp: false,
          delivered: false,
        };
        agent.addOrder(order);
      }

      expect(agent.canAcceptOrderByCount()).toBe(false);
      const result = agent.canAcceptOrder(0.5);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toContain('订单数量已达上限');
    });

    it('应该在重量超过10kg时拒绝新订单', () => {
      const agent = new AgentState('node1');
      const order: Order = {
        id: 'order1',
        type: 'supermarket',
        pickupLocation: 'node2',
        deliveryLocation: 'node3',
        distance: 2,
        itemPrice: 50,
        deliveryFee: 8,
        weight: 8,
        timeLimit: 30,
        createdAt: 360,
        pickedUp: false,
        delivered: false,
      };

      agent.addOrder(order);
      expect(agent.canAcceptOrderByWeight(3)).toBe(false);
      
      const result = agent.canAcceptOrder(3);
      expect(result.canAccept).toBe(false);
      expect(result.reason).toContain('承载重量将超过限制');
    });

    it('应该在条件满足时允许接受订单', () => {
      const agent = new AgentState('node1');
      const result = agent.canAcceptOrder(5);
      expect(result.canAccept).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  // ============================================================================
  // 属性测试
  // ============================================================================

  describe('属性测试', () => {
    /**
     * Feature: silicon-rider-bench, Property 5: 状态查询完整性
     * 验证：需求 4.1-4.5
     * 
     * 对于任意游戏状态，调用 get_my_status 应该返回包含位置、电量、
     * 订单列表、重量、承载能力和当前时间的完整信息
     */
    it('属性 5: 状态查询完整性', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // position
          fc.integer({ min: 0, max: 100 }), // battery
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1 }),
              type: fc.constantFrom('food', 'supermarket', 'pharmacy'),
              pickupLocation: fc.string({ minLength: 1 }),
              deliveryLocation: fc.string({ minLength: 1 }),
              distance: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
              itemPrice: fc.float({ min: Math.fround(5), max: Math.fround(100), noNaN: true }),
              deliveryFee: fc.float({ min: Math.fround(3), max: Math.fround(20), noNaN: true }),
              weight: fc.float({ min: Math.fround(0.05), max: Math.fround(2), noNaN: true }),
              timeLimit: fc.integer({ min: 10, max: 60 }),
              pickedUp: fc.boolean(),
              delivered: fc.boolean(),
            }),
            { maxLength: 5 }
          ), // orders
          fc.float({ min: 0, max: 100, noNaN: true }), // profit
          fc.integer({ min: 0, max: 100 }), // completedOrders
          fc.float({ min: 0, max: 500, noNaN: true }), // totalDistance
          (position, battery, orders, profit, completedOrders, totalDistance) => {
            // 确保订单总重量不超过10kg
            const validOrders: Order[] = [];
            let totalWeight = 0;
            for (const order of orders) {
              if (totalWeight + order.weight <= 10) {
                validOrders.push(order as Order);
                totalWeight += order.weight;
              }
            }

            const agent = new AgentState(position);
            agent.updateBattery(battery);
            
            for (const order of validOrders) {
              agent.addOrder(order);
            }
            
            agent.addProfit(profit);
            for (let i = 0; i < completedOrders; i++) {
              agent.incrementCompletedOrders();
            }
            agent.addDistance(totalDistance);

            const state = agent.getState();

            // 验证所有必需字段都存在
            expect(state).toHaveProperty('position');
            expect(state).toHaveProperty('battery');
            expect(state).toHaveProperty('carriedOrders');
            expect(state).toHaveProperty('totalWeight');
            expect(state).toHaveProperty('profit');
            expect(state).toHaveProperty('completedOrders');
            expect(state).toHaveProperty('totalDistance');

            // 验证值的正确性
            expect(state.position).toBe(position);
            expect(state.battery).toBe(battery);
            expect(state.carriedOrders).toHaveLength(validOrders.length);
            expect(state.totalWeight).toBeCloseTo(totalWeight, 2);
            expect(state.profit).toBeCloseTo(profit, 2);
            expect(state.completedOrders).toBe(completedOrders);
            expect(state.totalDistance).toBeCloseTo(totalDistance, 2);

            // 验证剩余承载能力计算正确
            expect(agent.getRemainingCapacity()).toBeCloseTo(10 - totalWeight, 2);

            // 验证电池续航计算正确
            expect(agent.getBatteryRange()).toBeCloseTo((battery / 100) * 50, 2);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: silicon-rider-bench, Property 9: 订单数量限制
     * 验证：需求 6.2
     * 
     * 对于任意智能体状态，当携带订单数量达到 5 单时，
     * 尝试接受新订单应该被拒绝并返回错误
     */
    it('属性 9: 订单数量限制', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // position
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1 }),
              type: fc.constantFrom('food', 'supermarket', 'pharmacy'),
              pickupLocation: fc.string({ minLength: 1 }),
              deliveryLocation: fc.string({ minLength: 1 }),
              distance: fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
              itemPrice: fc.float({ min: Math.fround(5), max: Math.fround(100), noNaN: true }),
              deliveryFee: fc.float({ min: Math.fround(3), max: Math.fround(20), noNaN: true }),
              weight: fc.float({ min: Math.fround(0.05), max: Math.fround(1), noNaN: true }), // 小重量确保能添加5个
              timeLimit: fc.integer({ min: 10, max: 60 }),
              pickedUp: fc.boolean(),
              delivered: fc.boolean(),
            }),
            { minLength: 5, maxLength: 5 } // 恰好5个订单
          ),
          fc.float({ min: Math.fround(0.05), max: Math.fround(2), noNaN: true }), // 新订单重量
          (position, orders, newOrderWeight) => {
            const agent = new AgentState(position);

            // 添加5个订单
            for (const order of orders) {
              agent.addOrder(order as Order);
            }

            // 验证订单数量为5
            expect(agent.getCarriedOrders()).toHaveLength(5);

            // 尝试接受新订单应该被拒绝
            expect(agent.canAcceptOrderByCount()).toBe(false);

            const result = agent.canAcceptOrder(newOrderWeight);
            expect(result.canAccept).toBe(false);
            expect(result.reason).toBeDefined();
            expect(result.reason).toContain('订单数量已达上限');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: silicon-rider-bench, Property 10: 重量限制
     * 验证：需求 6.3
     * 
     * 对于任意智能体状态和新订单，当当前总重量加上新订单重量超过 10kg 时，
     * 接单应该被拒绝并返回错误
     */
    it('属性 10: 重量限制', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }), // position
          fc.float({ min: Math.fround(5), max: Math.fround(9.5), noNaN: true }), // 当前总重量
          fc.float({ min: Math.fround(1), max: Math.fround(5), noNaN: true }), // 新订单重量
          (position, currentWeight, newOrderWeight) => {
            // 只测试会超重的情况
            fc.pre(currentWeight + newOrderWeight > 10);

            const agent = new AgentState(position);

            // 添加订单使总重量达到 currentWeight
            const order: Order = {
              id: 'order1',
              type: 'supermarket',
              pickupLocation: 'node2',
              deliveryLocation: 'node3',
              distance: 2,
              itemPrice: 50,
              deliveryFee: 8,
              weight: currentWeight,
              timeLimit: 30,
              createdAt: 360,
              pickedUp: false,
              delivered: false,
            };
            agent.addOrder(order);

            // 验证当前重量
            expect(agent.getTotalWeight()).toBeCloseTo(currentWeight, 2);

            // 尝试接受会导致超重的订单应该被拒绝
            expect(agent.canAcceptOrderByWeight(newOrderWeight)).toBe(false);

            const result = agent.canAcceptOrder(newOrderWeight);
            expect(result.canAccept).toBe(false);
            expect(result.reason).toBeDefined();
            expect(result.reason).toContain('承载重量将超过限制');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
