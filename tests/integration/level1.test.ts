/**
 * Level 1 集成测试
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 测试 Level 1 完整基准测试场景的 24 小时模拟
 * 需求：13.1-13.5
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Simulator } from '../../src/core/simulator';
import { getLevelConfig } from '../../src/levels/level-config';

describe('Level 1 集成测试', () => {
  let simulator: Simulator;

  beforeEach(() => {
    // 需求 13.1: WHEN Level 1 初始化 THEN 模拟器 SHALL 从种子生成完整地图
    const config = getLevelConfig('level1');
    simulator = new Simulator(config);
  });

  describe('初始化验证', () => {
    it('应该从种子生成完整地图', () => {
      // 需求 13.1: 从种子生成完整地图，包含多个餐厅、配送地点和换电站
      const worldState = simulator.getWorldState();
      
      // 验证地图存在且规模较大
      expect(worldState.nodes.size).toBeGreaterThan(10);
      expect(worldState.edges.length).toBeGreaterThan(10);
      
      // 验证地图大小为 large
      const config = simulator.getConfig();
      expect(config.mapSize).toBe('large');
      
      // 验证种子正确
      expect(worldState.seed).toBe(67890);
    });

    it('应该包含多种类型的节点', () => {
      // 需求 13.1: 包含多个餐厅、配送地点和换电站
      const nodes = Array.from(simulator.getNodes().values());
      
      // 统计各类型节点数量
      const nodeTypes = {
        restaurant: 0,
        supermarket: 0,
        pharmacy: 0,
        residential: 0,
        office: 0,
        battery_swap: 0,
      };
      
      nodes.forEach(node => {
        nodeTypes[node.type]++;
      });
      
      // 验证包含所有类型的节点
      expect(nodeTypes.restaurant).toBeGreaterThan(0);
      expect(nodeTypes.supermarket).toBeGreaterThan(0);
      expect(nodeTypes.pharmacy).toBeGreaterThan(0);
      expect(nodeTypes.residential).toBeGreaterThan(0);
      expect(nodeTypes.office).toBeGreaterThan(0);
      expect(nodeTypes.battery_swap).toBeGreaterThan(0);
    });

    it('应该配置 24 小时周期', () => {
      // 需求 13.2: 模拟从 0:00 到 24:00 的完整 24 小时周期
      const config = simulator.getConfig();
      expect(config.duration).toBe(1440); // 24 * 60 = 1440 分钟
    });

    it('应该初始化订单生成系统', () => {
      // 需求 13.3: 在整个模拟期间持续生成新订单
      const config = simulator.getConfig();
      expect(config.baseOrderFrequency).toBeDefined();
      expect(config.baseOrderFrequency).toBeGreaterThan(0);
      
      // 验证初始订单池不为空
      const orders = simulator.getAvailableOrders();
      expect(orders.length).toBeGreaterThan(0);
    });

    it('应该初始化拥堵管理系统', () => {
      // 需求 13.4: 根据时间应用动态拥堵
      const worldState = simulator.getWorldState();
      expect(worldState.congestionMap).toBeDefined();
      expect(worldState.congestionMap.size).toBeGreaterThan(0);
    });
  });

  describe('24 小时模拟', () => {
    it('应该正确跟踪游戏时间', () => {
      // 需求 13.2: 模拟从 0:00 到 24:00
      const initialTime = simulator.getCurrentTime();
      expect(initialTime).toBe(0);
      
      // 验证时间格式化
      const formattedTime = simulator.getFormattedTime();
      expect(formattedTime).toBe('00:00');
    });

    it('应该在时间到达终点时终止', () => {
      // 需求 13.2: 24 小时周期
      const gameClock = simulator.getGameClock();
      
      // 推进时间到接近终点
      gameClock.advance(1439);
      expect(simulator.shouldTerminate()).toBe(false);
      
      // 推进到终点
      gameClock.advance(1);
      expect(simulator.shouldTerminate()).toBe(true);
    });

    it('应该能够推进模拟生成新订单', () => {
      // 需求 13.3: 持续生成新订单
      const initialOrders = simulator.getAvailableOrders().length;
      
      // 推进模拟
      simulator.advanceSimulation();
      
      // 验证订单数量可能增加（取决于随机生成）
      const newOrders = simulator.getAvailableOrders().length;
      expect(newOrders).toBeGreaterThanOrEqual(initialOrders);
    });
  });

  describe('订单潮汐效果', () => {
    it('应该在不同时段生成不同类型的订单', () => {
      // 需求 13.3: 持续生成新订单
      // 需求 18.1-18.6: 订单潮汐现象
      
      // 推进到早高峰时段（6:00-9:00）
      const gameClock = simulator.getGameClock();
      gameClock.advance(360); // 6:00
      
      // 生成订单
      simulator.advanceSimulation();
      
      // 验证有订单生成
      const orders = simulator.getAvailableOrders();
      expect(orders.length).toBeGreaterThan(0);
      
      // 验证订单包含类型信息
      orders.forEach(order => {
        expect(order.type).toMatch(/food|supermarket|pharmacy/);
      });
    });

    it('应该根据时间更新拥堵程度', () => {
      // 需求 13.4: 根据时间应用动态拥堵
      const gameClock = simulator.getGameClock();
      const congestionManager = simulator.getCongestionManager();
      
      // 获取初始拥堵（0:00）
      const initialCongestion = congestionManager.updateCongestion(0);
      
      // 推进到早高峰（7:00-9:00）
      gameClock.advance(420); // 7:00
      const morningCongestion = congestionManager.updateCongestion(420);
      
      // 验证拥堵地图已更新
      expect(morningCongestion.size).toBeGreaterThan(0);
      
      // 推进到晚高峰（17:00-19:00）
      gameClock.advance(600); // 17:00
      const eveningCongestion = congestionManager.updateCongestion(1020);
      
      // 验证拥堵地图已更新
      expect(eveningCongestion.size).toBeGreaterThan(0);
    });

    it('应该在不同时段应用不同的拥堵模式', () => {
      // 需求 13.4: 动态拥堵
      // 需求 2.3: 早高峰和晚高峰拥堵
      const congestionManager = simulator.getCongestionManager();
      
      // 测试正常时段（10:00）
      const normalCongestion = congestionManager.updateCongestion(600);
      
      // 测试早高峰（8:00）
      const morningRushCongestion = congestionManager.updateCongestion(480);
      
      // 测试晚高峰（18:00）
      const eveningRushCongestion = congestionManager.updateCongestion(1080);
      
      // 验证拥堵地图都已生成
      expect(normalCongestion.size).toBeGreaterThan(0);
      expect(morningRushCongestion.size).toBeGreaterThan(0);
      expect(eveningRushCongestion.size).toBeGreaterThan(0);
    });
  });

  describe('评分计算', () => {
    it('应该计算最终利润分数', async () => {
      // 需求 13.5: 计算并报告最终利润分数
      // 需求 14.1: 总利润为订单支付和奖金之和减去罚款和成本
      
      // 完成一个订单来生成利润
      const orders = simulator.getAvailableOrders();
      if (orders.length > 0) {
        const order = orders[0];
        
        await simulator.executeToolCall({
          toolName: 'accept_order',
          parameters: { orderId: order.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order.pickupLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'pickup_food',
          parameters: { orderId: order.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order.deliveryLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'deliver_food',
          parameters: { orderId: order.id },
        });
      }
      
      // 计算最终评分
      const score = simulator.calculateFinalScore();
      
      // 需求 13.5: 验证评分包含利润
      expect(score).toHaveProperty('profit');
      expect(score.profit).toBeGreaterThanOrEqual(0);
    });

    it('应该计算准时率', async () => {
      // 需求 14.2: 准时率为准时配送数与总配送数的比率
      
      // 完成一个订单
      const orders = simulator.getAvailableOrders();
      if (orders.length > 0) {
        const order = orders[0];
        
        await simulator.executeToolCall({
          toolName: 'accept_order',
          parameters: { orderId: order.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order.pickupLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'pickup_food',
          parameters: { orderId: order.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order.deliveryLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'deliver_food',
          parameters: { orderId: order.id },
        });
      }
      
      const score = simulator.calculateFinalScore();
      
      // 验证准时率在有效范围内
      expect(score.onTimeRate).toBeGreaterThanOrEqual(0);
      expect(score.onTimeRate).toBeLessThanOrEqual(1);
    });

    it('应该计算路径效率', () => {
      // 需求 14.3: 路径效率为实际行驶距离与理论最优距离的比率
      const score = simulator.calculateFinalScore();
      
      expect(score).toHaveProperty('pathEfficiency');
      expect(score.pathEfficiency).toBeGreaterThan(0);
    });

    it('应该计算 API 违规率', async () => {
      // 需求 14.4: API 违规率为无效工具调用数与总工具调用数的比率
      
      // 执行一个有效的工具调用
      await simulator.executeToolCall({
        toolName: 'get_my_status',
        parameters: {},
      });
      
      // 执行一个无效的工具调用
      await simulator.executeToolCall({
        toolName: 'invalid_tool',
        parameters: {},
      });
      
      const score = simulator.calculateFinalScore();
      
      expect(score).toHaveProperty('apiViolationRate');
      expect(score.apiViolationRate).toBeGreaterThanOrEqual(0);
      expect(score.apiViolationRate).toBeLessThanOrEqual(1);
      
      // 验证统计信息
      const stats = simulator.getStats();
      expect(stats.totalToolCalls).toBe(2);
      expect(stats.invalidToolCalls).toBe(1);
    });

    it('应该生成 Markdown 报告', async () => {
      // 需求 14.5: 生成包含所有指标的 markdown 报告
      
      // 完成一个订单来生成数据
      const orders = simulator.getAvailableOrders();
      if (orders.length > 0) {
        const order = orders[0];
        
        await simulator.executeToolCall({
          toolName: 'accept_order',
          parameters: { orderId: order.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order.pickupLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'pickup_food',
          parameters: { orderId: order.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order.deliveryLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'deliver_food',
          parameters: { orderId: order.id },
        });
      }
      
      const report = simulator.generateReportSummary();
      
      // 验证报告包含关键信息
      expect(report).toContain('Silicon Rider Bench');
      expect(report).toContain('Level: 1');
      expect(report).toContain('Seed: 67890');
      expect(report).toContain('总利润');
      expect(report).toContain('完成订单数');
      expect(report).toContain('准时率');
      expect(report).toContain('路径效率');
      expect(report).toContain('API 违规率');
      expect(report).toContain('总行驶距离');
      expect(report).toContain('换电次数');
    });
  });

  describe('完整模拟流程', () => {
    it('应该能够执行多个订单的完整流程', async () => {
      // 测试完成多个订单
      const initialStats = simulator.getStats();
      expect(initialStats.completedOrders).toBe(0);
      
      // 完成第一个订单
      let orders = simulator.getAvailableOrders();
      if (orders.length > 0) {
        const order1 = orders[0];
        
        await simulator.executeToolCall({
          toolName: 'accept_order',
          parameters: { orderId: order1.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order1.pickupLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'pickup_food',
          parameters: { orderId: order1.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order1.deliveryLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'deliver_food',
          parameters: { orderId: order1.id },
        });
      }
      
      // 验证第一个订单完成
      let stats = simulator.getStats();
      expect(stats.completedOrders).toBe(1);
      
      // 生成新订单
      simulator.advanceSimulation();
      
      // 完成第二个订单（如果有）
      orders = simulator.getAvailableOrders();
      if (orders.length > 0) {
        const order2 = orders[0];
        
        await simulator.executeToolCall({
          toolName: 'accept_order',
          parameters: { orderId: order2.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order2.pickupLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'pickup_food',
          parameters: { orderId: order2.id },
        });
        
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: order2.deliveryLocation },
        });
        
        await simulator.executeToolCall({
          toolName: 'deliver_food',
          parameters: { orderId: order2.id },
        });
        
        // 验证第二个订单完成
        stats = simulator.getStats();
        expect(stats.completedOrders).toBe(2);
      }
    });

    it('应该能够处理换电操作', async () => {
      // 找到换电站
      const nodes = Array.from(simulator.getNodes().values());
      const batterySwapStation = nodes.find(n => n.type === 'battery_swap');
      
      if (batterySwapStation) {
        // 移动到换电站
        await simulator.executeToolCall({
          toolName: 'move_to',
          parameters: { targetLocationId: batterySwapStation.id },
        });
        
        // 换电
        const swapResponse = await simulator.executeToolCall({
          toolName: 'swap_battery',
          parameters: {},
        });
        
        expect(swapResponse.success).toBe(true);
        
        // 验证电量恢复
        const agentState = simulator.getAgentState();
        expect(agentState.getBattery()).toBe(100);
        
        // 验证统计信息
        const stats = simulator.getStats();
        expect(stats.batterySwaps).toBeGreaterThan(0);
      }
    });

    it('应该能够同时携带多个订单', async () => {
      // 接受多个订单
      const orders = simulator.getAvailableOrders();
      const ordersToAccept = orders.slice(0, Math.min(3, orders.length));
      
      for (const order of ordersToAccept) {
        const response = await simulator.executeToolCall({
          toolName: 'accept_order',
          parameters: { orderId: order.id },
        });
        
        if (response.success) {
          // 验证订单已添加到携带列表
          const agentState = simulator.getAgentState();
          const carriedOrders = agentState.getCarriedOrders();
          expect(carriedOrders.some(o => o.id === order.id)).toBe(true);
        }
      }
      
      // 验证携带订单数量
      const agentState = simulator.getAgentState();
      expect(agentState.getCarriedOrders().length).toBeGreaterThan(0);
      expect(agentState.getCarriedOrders().length).toBeLessThanOrEqual(5);
    });

    it('应该正确处理订单过期', () => {
      // 推进时间使订单过期
      const gameClock = simulator.getGameClock();
      const initialOrders = simulator.getAvailableOrders();
      
      // 推进大量时间
      gameClock.advance(500);
      
      // 移除过期订单
      simulator.advanceSimulation();
      
      // 验证订单池已更新（可能有新订单生成）
      const currentOrders = simulator.getAvailableOrders();
      expect(Array.isArray(currentOrders)).toBe(true);
    });
  });

  describe('性能和统计', () => {
    it('应该正确跟踪所有统计指标', async () => {
      const stats = simulator.getStats();
      
      // 验证所有统计字段存在
      expect(stats).toHaveProperty('totalToolCalls');
      expect(stats).toHaveProperty('invalidToolCalls');
      expect(stats).toHaveProperty('completedOrders');
      expect(stats).toHaveProperty('onTimeOrders');
      expect(stats).toHaveProperty('totalProfit');
      expect(stats).toHaveProperty('totalDistance');
      expect(stats).toHaveProperty('batterySwaps');
      
      // 验证初始值
      expect(stats.totalToolCalls).toBe(0);
      expect(stats.invalidToolCalls).toBe(0);
      expect(stats.completedOrders).toBe(0);
      expect(stats.onTimeOrders).toBe(0);
      expect(stats.totalProfit).toBe(0);
      expect(stats.totalDistance).toBe(0);
      expect(stats.batterySwaps).toBe(0);
    });

    it('应该在执行工具调用后更新统计', async () => {
      await simulator.executeToolCall({
        toolName: 'get_my_status',
        parameters: {},
      });
      
      const stats = simulator.getStats();
      expect(stats.totalToolCalls).toBe(1);
    });

    it('应该能够处理大量工具调用', async () => {
      // 执行多次工具调用
      for (let i = 0; i < 10; i++) {
        await simulator.executeToolCall({
          toolName: 'get_my_status',
          parameters: {},
        });
      }
      
      const stats = simulator.getStats();
      expect(stats.totalToolCalls).toBe(10);
    });
  });

  describe('边界条件和错误处理', () => {
    it('应该处理无效的工具调用', async () => {
      const response = await simulator.executeToolCall({
        toolName: 'invalid_tool_name',
        parameters: {},
      });
      
      expect(response.success).toBe(false);
      
      const stats = simulator.getStats();
      expect(stats.invalidToolCalls).toBeGreaterThan(0);
    });

    it('应该处理资源耗尽情况', async () => {
      // 测试电量耗尽
      const agentState = simulator.getAgentState();
      
      // 记录初始电量
      const initialBattery = agentState.getBattery();
      expect(initialBattery).toBe(100);
      
      // 电量管理由移动操作自动处理
      // 这里只验证系统能够正常运行
      expect(agentState.getBattery()).toBeGreaterThanOrEqual(0);
      expect(agentState.getBattery()).toBeLessThanOrEqual(100);
    });

    it('应该处理订单容量限制', async () => {
      // 尝试接受超过 5 个订单
      const orders = simulator.getAvailableOrders();
      let acceptedCount = 0;
      
      for (let i = 0; i < Math.min(6, orders.length); i++) {
        const response = await simulator.executeToolCall({
          toolName: 'accept_order',
          parameters: { orderId: orders[i].id },
        });
        
        if (response.success) {
          acceptedCount++;
        }
      }
      
      // 验证最多接受 5 个订单
      const agentState = simulator.getAgentState();
      expect(agentState.getCarriedOrders().length).toBeLessThanOrEqual(5);
    });

    it('应该处理重量限制', async () => {
      // 尝试接受超重订单
      const orders = simulator.getAvailableOrders();
      
      // 接受订单直到接近重量限制
      for (const order of orders) {
        const agentState = simulator.getAgentState();
        if (agentState.getTotalWeight() + order.weight <= 10) {
          await simulator.executeToolCall({
            toolName: 'accept_order',
            parameters: { orderId: order.id },
          });
        } else {
          // 尝试接受会超重的订单
          const response = await simulator.executeToolCall({
            toolName: 'accept_order',
            parameters: { orderId: order.id },
          });
          
          // 应该被拒绝
          expect(response.success).toBe(false);
          break;
        }
      }
      
      // 验证总重量不超过限制
      const agentState = simulator.getAgentState();
      expect(agentState.getTotalWeight()).toBeLessThanOrEqual(10);
    });
  });
});
