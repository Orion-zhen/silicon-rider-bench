/**
 * 模拟器核心测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Simulator } from './simulator';
import { getLevelConfig } from '../levels/level-config';

describe('Simulator', () => {
  describe('Level 0.1 初始化', () => {
    let simulator: Simulator;

    beforeEach(() => {
      const config = getLevelConfig('level0.1');
      simulator = new Simulator(config);
    });

    it('应该正确初始化 Level 0.1', () => {
      expect(simulator.getStatus()).toBe('initialized');
      expect(simulator.isLevel01Mode()).toBe(true);
    });

    it('应该生成一个可用订单', () => {
      const orders = simulator.getAvailableOrders();
      expect(orders.length).toBe(1);
    });

    it('应该初始化智能体状态', () => {
      const agentState = simulator.getAgentState();
      expect(agentState.getBattery()).toBe(100);
      expect(agentState.getCarriedOrders().length).toBe(0);
      expect(agentState.getProfit()).toBe(0);
    });

    it('应该初始化游戏时钟', () => {
      expect(simulator.getCurrentTime()).toBe(0);
    });

    it('应该生成地图', () => {
      const worldState = simulator.getWorldState();
      expect(worldState.nodes.size).toBeGreaterThan(0);
      expect(worldState.edges.length).toBeGreaterThan(0);
    });
  });

  describe('Level 1 初始化', () => {
    let simulator: Simulator;

    beforeEach(() => {
      const config = getLevelConfig('level1');
      simulator = new Simulator(config);
    });

    it('应该正确初始化 Level 1', () => {
      expect(simulator.getStatus()).toBe('initialized');
      expect(simulator.isLevel01Mode()).toBe(false);
    });

    it('应该生成多个可用订单', () => {
      const orders = simulator.getAvailableOrders();
      expect(orders.length).toBeGreaterThan(1);
    });

    it('应该使用 24 小时时长', () => {
      const config = simulator.getConfig();
      expect(config.duration).toBe(1440);
    });

    it('应该使用大地图', () => {
      const config = simulator.getConfig();
      expect(config.mapSize).toBe('large');
    });
  });

  describe('工具调用执行', () => {
    let simulator: Simulator;

    beforeEach(() => {
      const config = getLevelConfig('level0.1');
      simulator = new Simulator(config);
    });

    it('应该能够执行 get_my_status 工具', async () => {
      const response = await simulator.executeToolCall({
        toolName: 'get_my_status',
        parameters: {},
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toHaveProperty('position');
        expect(response.data).toHaveProperty('battery');
        expect(response.data).toHaveProperty('currentTime');
      }
    });

    it('应该能够执行 search_nearby_orders 工具', async () => {
      const response = await simulator.executeToolCall({
        toolName: 'search_nearby_orders',
        parameters: { radius: 100 },
      });

      expect(response.success).toBe(true);
      if (response.success) {
        expect(response.data).toHaveProperty('orders');
        expect(Array.isArray(response.data.orders)).toBe(true);
      }
    });

    it('应该统计工具调用次数', async () => {
      await simulator.executeToolCall({
        toolName: 'get_my_status',
        parameters: {},
      });

      const stats = simulator.getStats();
      expect(stats.totalToolCalls).toBe(1);
    });

    it('应该统计无效工具调用', async () => {
      await simulator.executeToolCall({
        toolName: 'invalid_tool',
        parameters: {},
      });

      const stats = simulator.getStats();
      expect(stats.invalidToolCalls).toBe(1);
    });
  });

  describe('终止条件检测', () => {
    it('Level 0.1 应该在订单完成后终止', async () => {
      const config = getLevelConfig('level0.1');
      const simulator = new Simulator(config);

      // 初始状态不应该终止
      expect(simulator.shouldTerminate()).toBe(false);

      // 获取订单
      const orders = simulator.getAvailableOrders();
      const order = orders[0];

      // 接受订单
      await simulator.executeToolCall({
        toolName: 'accept_order',
        parameters: { orderId: order.id },
      });

      // 移动到取餐点
      await simulator.executeToolCall({
        toolName: 'move_to',
        parameters: { targetLocationId: order.pickupLocation },
      });

      // 取餐
      await simulator.executeToolCall({
        toolName: 'pickup_food',
        parameters: { orderId: order.id },
      });

      // 移动到送餐点
      await simulator.executeToolCall({
        toolName: 'move_to',
        parameters: { targetLocationId: order.deliveryLocation },
      });

      // 送餐
      await simulator.executeToolCall({
        toolName: 'deliver_food',
        parameters: { orderId: order.id },
      });

      // 应该终止
      expect(simulator.shouldTerminate()).toBe(true);
    });

    it('应该在时间到达终点时终止', () => {
      const config = { ...getLevelConfig('level0.1'), duration: 10 };
      const simulator = new Simulator(config);

      // 手动推进时间
      const gameClock = simulator.getGameClock();
      gameClock.advance(10);

      expect(simulator.shouldTerminate()).toBe(true);
    });
  });

  describe('统计信息', () => {
    let simulator: Simulator;

    beforeEach(() => {
      const config = getLevelConfig('level0.1');
      simulator = new Simulator(config);
    });

    it('应该初始化统计信息', () => {
      const stats = simulator.getStats();
      expect(stats.totalToolCalls).toBe(0);
      expect(stats.invalidToolCalls).toBe(0);
      expect(stats.completedOrders).toBe(0);
      expect(stats.onTimeOrders).toBe(0);
      expect(stats.totalProfit).toBe(0);
      expect(stats.totalDistance).toBe(0);
      expect(stats.batterySwaps).toBe(0);
    });

    it('应该计算最终评分', () => {
      const score = simulator.calculateFinalScore();
      expect(score).toHaveProperty('profit');
      expect(score).toHaveProperty('onTimeRate');
      expect(score).toHaveProperty('pathEfficiency');
      expect(score).toHaveProperty('apiViolationRate');
    });

    it('应该生成报告摘要', () => {
      const report = simulator.generateReportSummary();
      expect(report).toContain('Silicon Rider Bench');
      expect(report).toContain('总利润');
      expect(report).toContain('完成订单数');
    });
  });

  describe('世界状态查询', () => {
    let simulator: Simulator;

    beforeEach(() => {
      const config = getLevelConfig('level0.1');
      simulator = new Simulator(config);
    });

    it('应该能够获取世界状态', () => {
      const worldState = simulator.getWorldState();
      expect(worldState).toHaveProperty('nodes');
      expect(worldState).toHaveProperty('edges');
      expect(worldState).toHaveProperty('currentTime');
      expect(worldState).toHaveProperty('seed');
      expect(worldState).toHaveProperty('congestionMap');
    });

    it('应该能够获取节点信息', () => {
      const nodes = simulator.getNodes();
      const firstNodeId = Array.from(nodes.keys())[0];
      const node = simulator.getNode(firstNodeId);
      
      expect(node).toBeDefined();
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('type');
      expect(node).toHaveProperty('position');
    });

    it('应该能够获取路径查找器', () => {
      const pathfinder = simulator.getPathfinder();
      expect(pathfinder).toBeDefined();
    });

    it('应该能够获取拥堵管理器', () => {
      const congestionManager = simulator.getCongestionManager();
      expect(congestionManager).toBeDefined();
    });
  });
});
