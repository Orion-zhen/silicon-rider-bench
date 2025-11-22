/**
 * 行动类工具单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentState } from '../core/agent-state';
import { OrderGenerator } from '../core/order-generator';
import { Pathfinder } from '../world/pathfinder';
import { CongestionManager } from '../world/congestion-manager';
import { generateMap } from '../world/map-generator';
import { Node, Edge } from '../types';
import {
  acceptOrderTool,
  moveToTool,
  pickupFoodTool,
  deliverFoodTool,
  swapBatteryTool,
} from './action-tools';
import { ToolContext } from './query-tools';

describe('Action Tools', () => {
  let context: ToolContext;
  let nodes: Map<string, Node>;
  let edges: Edge[];

  beforeEach(() => {
    // 创建测试地图
    const map = generateMap({ seed: 12345, size: 'large' });
    nodes = map.nodes;
    edges = map.edges;

    const agentState = new AgentState(Array.from(nodes.keys())[0]);
    const orderGenerator = new OrderGenerator(12345);
    const pathfinder = new Pathfinder(nodes, edges);
    const congestionManager = new CongestionManager(edges, nodes);

    context = {
      agentState,
      orderGenerator,
      pathfinder,
      congestionManager,
      nodes,
      currentTime: 0,
    };
  });

  describe('accept_order', () => {
    beforeEach(() => {
      // 生成测试订单
      const pickupNodes = Array.from(nodes.values()).filter(n => n.type === 'restaurant');
      const deliveryNodes = Array.from(nodes.values()).filter(n => n.type === 'residential');
      
      context.orderGenerator.generateOrders(
        3,
        0,
        pickupNodes,
        deliveryNodes,
        (from, to) => {
          const result = context.pathfinder.calculateDistance(from, to);
          return result ? result.distance : 0;
        }
      );
    });

    it('should accept valid order', async () => {
      const orders = context.orderGenerator.getAvailableOrders();
      const orderId = orders[0].id;
      
      const result = await acceptOrderTool.handler({ orderId }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.order).toBeDefined();
        expect(context.agentState.getCarriedOrders()).toHaveLength(1);
      }
    });

    it('should reject invalid order ID', async () => {
      const result = await acceptOrderTool.handler({ orderId: 'invalid' }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ORDER');
      }
    });

    it('should reject when order limit reached', async () => {
      // 生成足够的订单
      const pickupNodes = Array.from(nodes.values()).filter(n => n.type === 'restaurant');
      const deliveryNodes = Array.from(nodes.values()).filter(n => n.type === 'residential');
      context.orderGenerator.generateOrders(3, 0, pickupNodes, deliveryNodes, (from, to) => {
        const result = context.pathfinder.calculateDistance(from, to);
        return result ? result.distance : 0;
      });
      
      const orders = context.orderGenerator.getAvailableOrders();
      
      // 接受 5 个订单（达到上限）
      for (let i = 0; i < 5 && i < orders.length; i++) {
        await acceptOrderTool.handler({ orderId: orders[i].id }, context);
      }
      
      // 生成更多订单
      context.orderGenerator.generateOrders(1, 0, pickupNodes, deliveryNodes, (from, to) => {
        const result = context.pathfinder.calculateDistance(from, to);
        return result ? result.distance : 0;
      });
      
      const newOrders = context.orderGenerator.getAvailableOrders();
      const result = await acceptOrderTool.handler({ orderId: newOrders[0].id }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('CAPACITY_EXCEEDED');
      }
    });
  });

  describe('move_to', () => {
    it('should move to valid location', async () => {
      const locationIds = Array.from(nodes.keys());
      const targetId = locationIds[1];
      
      const result = await moveToTool.handler({ targetLocationId: targetId }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.newPosition).toBe(targetId);
        expect(result.data.timeCost).toBeGreaterThan(0);
        expect(context.agentState.getPosition()).toBe(targetId);
      }
    });

    it('should return zero cost when already at location', async () => {
      const currentPosition = context.agentState.getPosition();
      const result = await moveToTool.handler({ targetLocationId: currentPosition }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeCost).toBe(0);
        expect(result.data.batteryCost).toBe(0);
      }
    });

    it('should reject invalid location', async () => {
      const result = await moveToTool.handler({ targetLocationId: 'invalid' }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_LOCATION');
      }
    });

    it('should consume battery', async () => {
      const locationIds = Array.from(nodes.keys());
      const initialBattery = context.agentState.getBattery();
      
      await moveToTool.handler({ targetLocationId: locationIds[1] }, context);
      
      const finalBattery = context.agentState.getBattery();
      expect(finalBattery).toBeLessThan(initialBattery);
    });
  });

  describe('pickup_food', () => {
    let orderId: string;
    let pickupLocation: string;

    beforeEach(async () => {
      // 生成并接受订单
      const pickupNodes = Array.from(nodes.values()).filter(n => n.type === 'restaurant');
      const deliveryNodes = Array.from(nodes.values()).filter(n => n.type === 'residential');
      
      context.orderGenerator.generateOrders(1, 0, pickupNodes, deliveryNodes, (from, to) => {
        const result = context.pathfinder.calculateDistance(from, to);
        return result ? result.distance : 0;
      });
      
      const orders = context.orderGenerator.getAvailableOrders();
      orderId = orders[0].id;
      pickupLocation = orders[0].pickupLocation;
      
      await acceptOrderTool.handler({ orderId }, context);
    });

    it('should pickup food at correct location', async () => {
      // 移动到取餐点
      await moveToTool.handler({ targetLocationId: pickupLocation }, context);
      
      const result = await pickupFoodTool.handler({ orderId }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.timeCost).toBe(2);
      }
    });

    it('should reject pickup at wrong location', async () => {
      const result = await pickupFoodTool.handler({ orderId }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('WRONG_LOCATION');
      }
    });

    it('should reject pickup for non-carried order', async () => {
      const result = await pickupFoodTool.handler({ orderId: 'invalid' }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('ORDER_NOT_CARRIED');
      }
    });
  });

  describe('deliver_food', () => {
    let orderId: string;
    let pickupLocation: string;
    let deliveryLocation: string;

    beforeEach(async () => {
      // 生成、接受并取餐
      const pickupNodes = Array.from(nodes.values()).filter(n => n.type === 'restaurant');
      const deliveryNodes = Array.from(nodes.values()).filter(n => n.type === 'residential');
      
      context.orderGenerator.generateOrders(1, 0, pickupNodes, deliveryNodes, (from, to) => {
        const result = context.pathfinder.calculateDistance(from, to);
        return result ? result.distance : 0;
      });
      
      const orders = context.orderGenerator.getAvailableOrders();
      orderId = orders[0].id;
      pickupLocation = orders[0].pickupLocation;
      deliveryLocation = orders[0].deliveryLocation;
      
      await acceptOrderTool.handler({ orderId }, context);
      await moveToTool.handler({ targetLocationId: pickupLocation }, context);
      await pickupFoodTool.handler({ orderId }, context);
    });

    it('should deliver food at correct location', async () => {
      // 移动到送餐点
      await moveToTool.handler({ targetLocationId: deliveryLocation }, context);
      
      const initialProfit = context.agentState.getProfit();
      const result = await deliverFoodTool.handler({ orderId }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.payment).toBeGreaterThan(0);
        expect(result.data.timeCost).toBe(1);
        expect(context.agentState.getProfit()).toBeGreaterThan(initialProfit);
        expect(context.agentState.getCarriedOrders()).toHaveLength(0);
      }
    });

    it('should reject delivery at wrong location', async () => {
      const result = await deliverFoodTool.handler({ orderId }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('WRONG_LOCATION');
      }
    });

    it('should reject delivery for non-carried order', async () => {
      const result = await deliverFoodTool.handler({ orderId: 'invalid' }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('ORDER_NOT_CARRIED');
      }
    });

    it('should reject delivery for non-picked-up order', async () => {
      // 生成新订单但不取餐
      const pickupNodes = Array.from(nodes.values()).filter(n => n.type === 'restaurant');
      const deliveryNodes = Array.from(nodes.values()).filter(n => n.type === 'residential');
      
      context.orderGenerator.generateOrders(1, 0, pickupNodes, deliveryNodes, (from, to) => {
        const result = context.pathfinder.calculateDistance(from, to);
        return result ? result.distance : 0;
      });
      
      const orders = context.orderGenerator.getAvailableOrders();
      const newOrderId = orders[0].id;
      await acceptOrderTool.handler({ orderId: newOrderId }, context);
      
      const result = await deliverFoodTool.handler({ orderId: newOrderId }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('ORDER_NOT_PICKED_UP');
      }
    });
  });

  describe('swap_battery', () => {
    it('should swap battery at swap station', async () => {
      // 找到换电站
      const swapStation = Array.from(nodes.values()).find(n => n.type === 'battery_swap');
      if (!swapStation) {
        // 如果地图中没有换电站，跳过测试
        return;
      }
      
      // 移动到换电站并消耗一些电量
      await moveToTool.handler({ targetLocationId: swapStation.id }, context);
      
      const initialProfit = context.agentState.getProfit();
      const result = await swapBatteryTool.handler({}, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.newBattery).toBe(100);
        expect(result.data.cost).toBe(0.5);
        expect(result.data.timeCost).toBe(1);
        expect(context.agentState.getBattery()).toBe(100);
        expect(context.agentState.getProfit()).toBe(initialProfit - 0.5);
      }
    });

    it('should reject swap at non-swap-station', async () => {
      const result = await swapBatteryTool.handler({}, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_AT_SWAP_STATION');
      }
    });
  });
});
