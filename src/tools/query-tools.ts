/**
 * 信息查询工具
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 需求：4.1-4.5, 5.1-5.4, 11.1-11.3
 */

import {
  ToolCallResponse,
  GetMyStatusResponse,
  SearchNearbyOrdersResponse,
  SearchNearbyBatteryStationsResponse,
  GetLocationInfoResponse,
  CalculateDistanceResponse,
  EstimateTimeResponse,
  Node,
  Order,
} from '../types';
import { AgentState } from '../core/agent-state';
import { OrderGenerator } from '../core/order-generator';
import { Pathfinder } from '../world/pathfinder';
import { CongestionManager } from '../world/congestion-manager';
import { ToolDefinition } from './tool-registry';

/**
 * 工具上下文接口
 * 包含执行工具所需的所有状态和依赖
 */
export interface ToolContext {
  agentState: AgentState;
  orderGenerator: OrderGenerator;
  pathfinder: Pathfinder;
  congestionManager: CongestionManager;
  nodes: Map<string, Node>;
  currentTime: number;
  simulator?: any; // Simulator 实例，用于 help 工具
  onBatterySwap?: () => void;
  onOrderComplete?: (onTime: boolean, order?: Order, payment?: number, penalty?: number, overtime?: number) => void;
}

/**
 * 获取智能体当前状态
 * 需求：4.1-4.5
 */
export const getMyStatusTool: ToolDefinition = {
  name: 'get_my_status',
  description: '获取智能体的当前状态，包括位置、电量、携带订单、重量、承载能力和当前时间',
  parameters: {},
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<GetMyStatusResponse>> => {
    const { agentState, currentTime } = context;

    const allOrders = agentState.getCarriedOrders();
    
    // 分离已接受但未取餐的订单和已取餐的订单
    const acceptedOrders = allOrders
      .filter(order => !order.pickedUp)
      .map(order => ({
        id: order.id,
        type: order.type,
        weight: order.weight,
        deadline: order.deadline || 0,
        pickupLocation: order.pickupLocation,
        deliveryLocation: order.deliveryLocation,
      }));

    const carriedOrders = allOrders
      .filter(order => order.pickedUp && !order.delivered)
      .map(order => ({
        id: order.id,
        type: order.type,
        weight: order.weight,
        deadline: order.deadline || 0,
        pickupLocation: order.pickupLocation,
        deliveryLocation: order.deliveryLocation,
      }));

    const response: GetMyStatusResponse = {
      position: agentState.getPosition(),
      battery: agentState.getBattery(),
      batteryRange: agentState.getBatteryRange(),
      acceptedOrders,
      carriedOrders,
      totalWeight: agentState.getTotalWeight(),
      remainingCapacity: agentState.getRemainingCapacity(),
      currentTime,
      profit: agentState.getProfit(),
    };

    return {
      success: true,
      data: response,
    };
  },
};

/**
 * 搜索附近的可用订单
 * 需求：5.1-5.4
 */
export const searchNearbyOrdersTool: ToolDefinition = {
  name: 'search_nearby_orders',
  description: '搜索指定半径内的所有可用订单',
  parameters: {
    radius: {
      type: 'number',
      required: true,
      description: '搜索半径（km）',
      min: 0,
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<SearchNearbyOrdersResponse>> => {
    const { agentState, orderGenerator, pathfinder } = context;
    const radius = params.radius as number;

    // 获取智能体当前位置
    const agentPosition = agentState.getPosition();

    // 搜索附近订单
    const nearbyOrders = orderGenerator.searchNearbyOrders(
      agentPosition,
      radius,
      (from: string, to: string) => {
        const result = pathfinder.calculateDistance(from, to);
        return result ? result.distance : Infinity;
      }
    );

    // 格式化订单信息
    const orders = nearbyOrders.map(order => ({
      id: order.id,
      type: order.type,
      deliveryFee: order.deliveryFee,
      weight: order.weight,
      itemPrice: order.itemPrice,
      pickupLocation: order.pickupLocation,
      deliveryLocation: order.deliveryLocation,
      distance: order.distance,
      estimatedTimeLimit: order.timeLimit,
    }));

    return {
      success: true,
      data: { orders },
    };
  },
};

/**
 * 搜索附近的换电站
 */
export const searchNearbyBatteryStationsTool: ToolDefinition = {
  name: 'search_nearby_battery_stations',
  description: '搜索指定半径内的所有换电站',
  parameters: {
    radius: {
      type: 'number',
      required: true,
      description: '搜索半径（km）',
      min: 0,
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<SearchNearbyBatteryStationsResponse>> => {
    const { agentState, pathfinder, nodes, congestionManager, currentTime } = context;
    const radius = params.radius as number;

    // 获取智能体当前位置
    const agentPosition = agentState.getPosition();

    // 查找所有换电站
    const batteryStations = Array.from(nodes.values()).filter(
      node => node.type === 'battery_swap'
    );

    // 计算距离并筛选在半径内的换电站
    const nearbyStations = batteryStations
      .map(station => {
        const distanceResult = pathfinder.calculateDistance(agentPosition, station.id);
        if (!distanceResult) {
          return null;
        }

        const distance = distanceResult.distance;
        if (distance > radius) {
          return null;
        }

        // 估算到达时间
        const path = distanceResult.path;
        let totalTime = 0;

        for (let i = 0; i < path.length - 1; i++) {
          const from = path[i];
          const to = path[i + 1];
          const edgeId = `${from}-${to}`;
          const reverseEdgeId = `${to}-${from}`;

          // 获取拥堵程度
          const congestionMap = congestionManager.updateCongestion(currentTime);
          const congestion = congestionMap.get(edgeId) || congestionMap.get(reverseEdgeId) || 0;

          // 计算速度
          let speed = 30; // 默认速度
          if (congestion < 0.3) speed = 30;
          else if (congestion < 0.5) speed = 25;
          else if (congestion < 0.7) speed = 20;
          else speed = 15;

          // 计算这一段的距离
          const segmentResult = pathfinder.calculateDistance(from, to);
          if (segmentResult) {
            const segmentDistance = segmentResult.distance;
            totalTime += (segmentDistance / speed) * 60; // 转换为分钟
          }
        }

        return {
          id: station.id,
          name: station.name,
          distance,
          estimatedTime: totalTime,
          position: station.position,
        };
      })
      .filter((station): station is NonNullable<typeof station> => station !== null)
      .sort((a, b) => a.distance - b.distance); // 按距离排序

    return {
      success: true,
      data: { stations: nearbyStations },
    };
  },
};

/**
 * 获取位置信息
 * 需求：11.1-11.3
 */
export const getLocationInfoTool: ToolDefinition = {
  name: 'get_location_info',
  description: '获取指定位置的详细信息',
  parameters: {
    locationId: {
      type: 'string',
      required: true,
      description: '位置节点 ID',
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<GetLocationInfoResponse>> => {
    const { nodes } = context;
    const locationId = params.locationId as string;

    // 检查位置是否存在
    const node = nodes.get(locationId);
    if (!node) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: `Location not found: ${locationId}`,
          details: { locationId },
        },
      };
    }

    const response: GetLocationInfoResponse = {
      id: node.id,
      type: node.type,
      name: node.name,
      position: { ...node.position },
    };

    return {
      success: true,
      data: response,
    };
  },
};

/**
 * 计算两点之间的距离
 * 需求：11.1
 */
export const calculateDistanceTool: ToolDefinition = {
  name: 'calculate_distance',
  description: '计算两个位置之间的最短路径距离',
  parameters: {
    fromId: {
      type: 'string',
      required: true,
      description: '起点位置 ID',
    },
    toId: {
      type: 'string',
      required: true,
      description: '终点位置 ID',
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<CalculateDistanceResponse>> => {
    const { pathfinder, nodes } = context;
    const fromId = params.fromId as string;
    const toId = params.toId as string;

    // 验证位置 ID
    if (!nodes.has(fromId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: `Invalid from location: ${fromId}`,
          details: { fromId },
        },
      };
    }

    if (!nodes.has(toId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: `Invalid to location: ${toId}`,
          details: { toId },
        },
      };
    }

    // 计算距离
    const result = pathfinder.calculateDistance(fromId, toId);
    if (!result) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: `No path found between ${fromId} and ${toId}`,
          details: { fromId, toId },
        },
      };
    }

    return {
      success: true,
      data: result,
    };
  },
};

/**
 * 估算通行时间
 * 需求：11.2, 11.3
 */
export const estimateTimeTool: ToolDefinition = {
  name: 'estimate_time',
  description: '估算沿指定路径的总通行时间，考虑当前拥堵情况',
  parameters: {
    locationIds: {
      type: 'array',
      required: true,
      description: '位置 ID 列表（按顺序）',
      items: {
        type: 'string',
      },
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<EstimateTimeResponse>> => {
    const { pathfinder, congestionManager, currentTime, nodes } = context;
    const locationIds = params.locationIds as string[];

    // 验证参数
    if (!Array.isArray(locationIds) || locationIds.length < 2) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: 'locationIds must be an array with at least 2 elements',
          details: { locationIds },
        },
      };
    }

    // 验证所有位置 ID
    for (const locationId of locationIds) {
      if (!nodes.has(locationId)) {
        return {
          success: false,
          error: {
            code: 'INVALID_LOCATION',
            message: `Invalid location: ${locationId}`,
            details: { locationId },
          },
        };
      }
    }

    // 估算时间
    const result = pathfinder.estimateTime(locationIds, currentTime, congestionManager);
    if (!result) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: 'Unable to estimate time for the given path',
          details: { locationIds },
        },
      };
    }

    return {
      success: true,
      data: result,
    };
  },
};

/**
 * 获取帮助信息
 * 返回系统提示词作为帮助文档
 * 
 * 这个工具复用系统提示词生成逻辑，确保帮助信息与初始提示词保持一致
 */
export const helpTool: ToolDefinition = {
  name: 'help',
  description: '显示帮助信息，包括所有可用工具、游戏规则和策略建议',
  parameters: {},
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<{ help: string }>> => {
    // 从 context 中获取 simulator
    const simulator = context.simulator;
    
    if (!simulator) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: 'Simulator not available in context',
          details: {},
        },
      };
    }
    
    // 动态导入以避免循环依赖
    const { generateSystemPrompt } = await import('../client/system-prompt.js');
    
    // 生成帮助信息（复用系统提示词）
    const helpText = generateSystemPrompt(simulator);
    
    return {
      success: true,
      data: {
        help: helpText,
      },
    };
  },
};

/**
 * 获取所有查询工具
 */
export function getQueryTools(): ToolDefinition[] {
  return [
    getMyStatusTool,
    searchNearbyOrdersTool,
    searchNearbyBatteryStationsTool,
    getLocationInfoTool,
    calculateDistanceTool,
    estimateTimeTool,
    helpTool,
  ];
}
