/**
 * 信息查询工具单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentState } from '../core/agent-state';
import { OrderGenerator } from '../core/order-generator';
import { Pathfinder } from '../world/pathfinder';
import { CongestionManager } from '../world/congestion-manager';
import { generateMap } from '../world/map-generator';
import { Node, Edge } from '../types';
import {
  getMyStatusTool,
  searchNearbyOrdersTool,
  searchNearbyBatteryStationsTool,
  getLocationInfoTool,
  calculateDistanceTool,
  estimateTimeTool,
  ToolContext,
} from './query-tools';

describe('Query Tools', () => {
  let context: ToolContext;
  let nodes: Map<string, Node>;
  let edges: Edge[];

  beforeEach(() => {
    // 创建简单的测试地图
    const map = generateMap({ seed: 12345, size: 'small' });
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

  describe('get_my_status', () => {
    it('should return complete agent status', async () => {
      const result = await getMyStatusTool.handler({}, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('position');
        expect(result.data).toHaveProperty('battery');
        expect(result.data).toHaveProperty('batteryRange');
        expect(result.data).toHaveProperty('carriedOrders');
        expect(result.data).toHaveProperty('totalWeight');
        expect(result.data).toHaveProperty('remainingCapacity');
        expect(result.data).toHaveProperty('currentTime');
        expect(result.data).toHaveProperty('profit');
        expect(result.data.battery).toBe(100);
        expect(result.data.batteryRange).toBe(50);
      }
    });

    it('should reflect battery changes', async () => {
      context.agentState.updateBattery(50);
      const result = await getMyStatusTool.handler({}, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.battery).toBe(50);
        expect(result.data.batteryRange).toBe(25);
      }
    });
  });

  describe('search_nearby_orders', () => {
    beforeEach(() => {
      // 生成一些测试订单
      const pickupNodes = Array.from(nodes.values()).filter(n => n.type === 'restaurant');
      const deliveryNodes = Array.from(nodes.values()).filter(n => n.type === 'residential');
      
      context.orderGenerator.generateOrders(
        5,
        0,
        pickupNodes,
        deliveryNodes,
        (from, to) => {
          const result = context.pathfinder.calculateDistance(from, to);
          return result ? result.distance : 0;
        }
      );
    });

    it('should return orders within radius', async () => {
      const result = await searchNearbyOrdersTool.handler({ radius: 100 }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.orders)).toBe(true);
      }
    });

    it('should return empty array when no orders in radius', async () => {
      const result = await searchNearbyOrdersTool.handler({ radius: 0.001 }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orders).toHaveLength(0);
      }
    });

    it('should include all required order fields', async () => {
      const result = await searchNearbyOrdersTool.handler({ radius: 100 }, context);
      
      expect(result.success).toBe(true);
      if (result.success && result.data.orders.length > 0) {
        const order = result.data.orders[0];
        expect(order).toHaveProperty('id');
        expect(order).toHaveProperty('type');
        expect(order).toHaveProperty('deliveryFee');
        expect(order).toHaveProperty('weight');
        expect(order).toHaveProperty('itemPrice');
        expect(order).toHaveProperty('pickupLocation');
        expect(order).toHaveProperty('deliveryLocation');
        expect(order).toHaveProperty('distance');
        expect(order).toHaveProperty('estimatedTimeLimit');
      }
    });
  });

  describe('search_nearby_battery_stations', () => {
    it('should return battery stations within radius', async () => {
      const result = await searchNearbyBatteryStationsTool.handler({ radius: 100 }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Array.isArray(result.data.stations)).toBe(true);
        // 验证返回的都是换电站
        result.data.stations.forEach(station => {
          const node = nodes.get(station.id);
          expect(node?.type).toBe('battery_swap');
        });
      }
    });

    it('should return empty array when no stations in radius', async () => {
      const result = await searchNearbyBatteryStationsTool.handler({ radius: 0.001 }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stations).toHaveLength(0);
      }
    });

    it('should include all required station fields', async () => {
      const result = await searchNearbyBatteryStationsTool.handler({ radius: 100 }, context);
      
      expect(result.success).toBe(true);
      if (result.success && result.data.stations.length > 0) {
        const station = result.data.stations[0];
        expect(station).toHaveProperty('id');
        expect(station).toHaveProperty('name');
        expect(station).toHaveProperty('distance');
        expect(station).toHaveProperty('estimatedTime');
        expect(station).toHaveProperty('position');
        expect(typeof station.distance).toBe('number');
        expect(typeof station.estimatedTime).toBe('number');
      }
    });

    it('should sort stations by distance', async () => {
      const result = await searchNearbyBatteryStationsTool.handler({ radius: 100 }, context);
      
      expect(result.success).toBe(true);
      if (result.success && result.data.stations.length > 1) {
        // 验证按距离排序
        for (let i = 0; i < result.data.stations.length - 1; i++) {
          expect(result.data.stations[i].distance).toBeLessThanOrEqual(
            result.data.stations[i + 1].distance
          );
        }
      }
    });
  });

  describe('get_location_info', () => {
    it('should return location info for valid location', async () => {
      const locationId = Array.from(nodes.keys())[0];
      const result = await getLocationInfoTool.handler({ locationId }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe(locationId);
        expect(result.data).toHaveProperty('type');
        expect(result.data).toHaveProperty('name');
        expect(result.data).toHaveProperty('position');
      }
    });

    it('should return error for invalid location', async () => {
      const result = await getLocationInfoTool.handler({ locationId: 'invalid' }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_LOCATION');
      }
    });
  });

  describe('calculate_distance', () => {
    it('should calculate distance between two locations', async () => {
      const locationIds = Array.from(nodes.keys());
      const result = await calculateDistanceTool.handler(
        { fromId: locationIds[0], toId: locationIds[1] },
        context
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.distance).toBeGreaterThan(0);
        expect(Array.isArray(result.data.path)).toBe(true);
        expect(result.data.path[0]).toBe(locationIds[0]);
        expect(result.data.path[result.data.path.length - 1]).toBe(locationIds[1]);
      }
    });

    it('should return zero distance for same location', async () => {
      const locationId = Array.from(nodes.keys())[0];
      const result = await calculateDistanceTool.handler(
        { fromId: locationId, toId: locationId },
        context
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.distance).toBe(0);
        expect(result.data.path).toHaveLength(1);
      }
    });

    it('should return error for invalid from location', async () => {
      const locationId = Array.from(nodes.keys())[0];
      const result = await calculateDistanceTool.handler(
        { fromId: 'invalid', toId: locationId },
        context
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_LOCATION');
      }
    });

    it('should return error for invalid to location', async () => {
      const locationId = Array.from(nodes.keys())[0];
      const result = await calculateDistanceTool.handler(
        { fromId: locationId, toId: 'invalid' },
        context
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_LOCATION');
      }
    });
  });

  describe('estimate_time', () => {
    it('should estimate time for valid path', async () => {
      const locationIds = Array.from(nodes.keys()).slice(0, 3);
      const result = await estimateTimeTool.handler({ locationIds }, context);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalTime).toBeGreaterThan(0);
        expect(Array.isArray(result.data.segments)).toBe(true);
        expect(result.data.segments).toHaveLength(2);
      }
    });

    it('should return error for less than 2 locations', async () => {
      const locationId = Array.from(nodes.keys())[0];
      const result = await estimateTimeTool.handler({ locationIds: [locationId] }, context);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_PARAMETER');
      }
    });

    it('should return error for invalid location in path', async () => {
      const locationId = Array.from(nodes.keys())[0];
      const result = await estimateTimeTool.handler(
        { locationIds: [locationId, 'invalid'] },
        context
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_LOCATION');
      }
    });
  });
});
