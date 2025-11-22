/**
 * 行动类工具
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 需求：6.1-6.5, 7.1-7.6, 8.1-8.4, 9.1-9.5, 10.1-10.5
 */

import {
  ToolCallResponse,
  AcceptOrderResponse,
  MoveToResponse,
  PickupFoodResponse,
  DeliverFoodResponse,
  SwapBatteryResponse,
} from '../types';
import { ToolDefinition } from './tool-registry';
import { ToolContext } from './query-tools';
import { MovementCalculator } from '../core/movement-calculator';
import { calculatePayment } from '../core/penalty-calculator';

/**
 * 接受订单
 * 需求：6.1-6.5
 */
export const acceptOrderTool: ToolDefinition = {
  name: 'accept_order',
  description: '接受一个订单，将其添加到携带订单列表',
  parameters: {
    orderId: {
      type: 'string',
      required: true,
      description: '订单 ID',
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<AcceptOrderResponse>> => {
    const { agentState, orderGenerator, currentTime } = context;
    const orderId = params.orderId as string;

    // 检查订单是否存在
    const order = orderGenerator.getOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: {
          code: 'INVALID_ORDER',
          message: `Order not found: ${orderId}`,
          details: { orderId },
        },
      };
    }

    // 检查是否可以接受订单（订单数量和重量限制）
    const canAccept = agentState.canAcceptOrder(order.weight);
    if (!canAccept.canAccept) {
      const errorCode = canAccept.reason?.includes('数量') ? 'CAPACITY_EXCEEDED' : 'WEIGHT_EXCEEDED';
      return {
        success: false,
        error: {
          code: errorCode,
          message: canAccept.reason || 'Cannot accept order',
          details: { orderId, weight: order.weight },
        },
      };
    }

    // 接受订单（从订单池中移除并更新订单信息）
    const acceptedOrder = orderGenerator.acceptOrder(orderId, currentTime);
    if (!acceptedOrder) {
      return {
        success: false,
        error: {
          code: 'INVALID_ORDER',
          message: `Failed to accept order: ${orderId}`,
          details: { orderId },
        },
      };
    }

    // 添加到智能体的携带订单列表
    agentState.addOrder(acceptedOrder);

    return {
      success: true,
      data: {
        success: true,
        order: acceptedOrder,
      },
    };
  },
};

/**
 * 移动到指定位置
 * 需求：7.1-7.6
 */
export const moveToTool: ToolDefinition = {
  name: 'move_to',
  description: '移动到指定位置，消耗时间和电量',
  parameters: {
    targetLocationId: {
      type: 'string',
      required: true,
      description: '目标位置 ID',
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<MoveToResponse>> => {
    const { agentState, pathfinder, congestionManager, currentTime, nodes } = context;
    const targetLocationId = params.targetLocationId as string;

    // 验证目标位置
    if (!nodes.has(targetLocationId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: `Invalid target location: ${targetLocationId}`,
          details: { targetLocationId },
        },
      };
    }

    const currentPosition = agentState.getPosition();

    // 如果已经在目标位置
    if (currentPosition === targetLocationId) {
      return {
        success: true,
        data: {
          success: true,
          timeCost: 0,
          batteryCost: 0,
          newPosition: targetLocationId,
          pushedDistance: 0,
        },
      };
    }

    // 计算路径和距离
    const pathResult = pathfinder.calculateDistance(currentPosition, targetLocationId);
    if (!pathResult) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: `No path found from ${currentPosition} to ${targetLocationId}`,
          details: { currentPosition, targetLocationId },
        },
      };
    }

    // 计算平均拥堵程度
    let totalCongestion = 0;
    let edgeCount = 0;
    for (let i = 0; i < pathResult.path.length - 1; i++) {
      const from = pathResult.path[i];
      const to = pathResult.path[i + 1];
      const edge = pathfinder.getEdge(from, to);
      if (edge) {
        const congestion = congestionManager.getCongestion(edge, currentTime);
        totalCongestion += congestion;
        edgeCount++;
      }
    }
    const avgCongestion = edgeCount > 0 ? totalCongestion / edgeCount : 0;

    // 计算移动时间和电量消耗
    const currentBattery = agentState.getBattery();
    const movementResult = MovementCalculator.calculateMovement(
      pathResult.distance,
      avgCongestion,
      currentBattery
    );

    // 更新智能体状态
    agentState.updatePosition(targetLocationId);
    agentState.consumeBattery(movementResult.batteryCost);
    agentState.addDistance(pathResult.distance);

    const response: MoveToResponse = {
      success: true,
      timeCost: movementResult.time,
      batteryCost: movementResult.batteryCost,
      newPosition: targetLocationId,
    };

    if (movementResult.pushedDistance > 0) {
      response.pushedDistance = movementResult.pushedDistance;
    }

    return {
      success: true,
      data: response,
    };
  },
};

/**
 * 取餐
 * 需求：8.1-8.4
 */
export const pickupFoodTool: ToolDefinition = {
  name: 'pickup_food',
  description: '从餐厅取餐，标记订单为已取餐',
  parameters: {
    orderId: {
      type: 'string',
      required: true,
      description: '订单 ID',
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<PickupFoodResponse>> => {
    const { agentState } = context;
    const orderId = params.orderId as string;

    // 检查订单是否在携带列表中
    const order = agentState.findCarriedOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: {
          code: 'ORDER_NOT_CARRIED',
          message: `Order not in carried list: ${orderId}`,
          details: { orderId },
        },
      };
    }

    // 检查是否在取餐地点
    const currentPosition = agentState.getPosition();
    if (currentPosition !== order.pickupLocation) {
      return {
        success: false,
        error: {
          code: 'WRONG_LOCATION',
          message: `Not at pickup location. Current: ${currentPosition}, Required: ${order.pickupLocation}`,
          details: { currentPosition, requiredLocation: order.pickupLocation },
        },
      };
    }

    // 标记订单为已取餐
    agentState.markOrderPickedUp(orderId);

    // 取餐固定耗时 2 分钟
    const timeCost = 2;

    return {
      success: true,
      data: {
        success: true,
        timeCost,
      },
    };
  },
};

/**
 * 送餐
 * 需求：9.1-9.5
 */
export const deliverFoodTool: ToolDefinition = {
  name: 'deliver_food',
  description: '将食物送达顾客，完成订单并获得报酬',
  parameters: {
    orderId: {
      type: 'string',
      required: true,
      description: '订单 ID',
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<DeliverFoodResponse>> => {
    const { agentState, currentTime } = context;
    const orderId = params.orderId as string;

    // 检查订单是否在携带列表中
    const order = agentState.findCarriedOrder(orderId);
    if (!order) {
      return {
        success: false,
        error: {
          code: 'ORDER_NOT_CARRIED',
          message: `Order not in carried list: ${orderId}`,
          details: { orderId },
        },
      };
    }

    // 检查订单是否已取餐
    if (!order.pickedUp) {
      return {
        success: false,
        error: {
          code: 'ORDER_NOT_PICKED_UP',
          message: `Order has not been picked up: ${orderId}`,
          details: { orderId },
        },
      };
    }

    // 检查是否在送餐地点
    const currentPosition = agentState.getPosition();
    if (currentPosition !== order.deliveryLocation) {
      return {
        success: false,
        error: {
          code: 'WRONG_LOCATION',
          message: `Not at delivery location. Current: ${currentPosition}, Required: ${order.deliveryLocation}`,
          details: { currentPosition, requiredLocation: order.deliveryLocation },
        },
      };
    }

    // 送餐固定耗时 1 分钟
    const timeCost = 1;
    const deliveryTime = currentTime + timeCost;

    // 计算支付金额（考虑超时惩罚）
    const paymentResult = calculatePayment(
      order.deliveryFee,
      order.deadline || 0,
      deliveryTime
    );

    // 更新智能体状态
    agentState.addProfit(paymentResult.payment);
    agentState.removeOrder(orderId);
    agentState.incrementCompletedOrders();

    // 调用订单完成回调
    const onTime = paymentResult.overtime === 0;
    if (context.onOrderComplete) {
      context.onOrderComplete(onTime);
    }

    return {
      success: true,
      data: {
        success: true,
        payment: paymentResult.payment,
        overtime: paymentResult.overtime,
        penalty: paymentResult.penalty,
        timeCost,
      },
    };
  },
};

/**
 * 换电
 * 需求：10.1-10.5
 */
export const swapBatteryTool: ToolDefinition = {
  name: 'swap_battery',
  description: '在换电站更换电池，恢复电量到 100%',
  parameters: {},
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<SwapBatteryResponse>> => {
    const { agentState, nodes } = context;

    // 检查是否在换电站
    const currentPosition = agentState.getPosition();
    const currentNode = nodes.get(currentPosition);
    
    if (!currentNode || currentNode.type !== 'battery_swap') {
      return {
        success: false,
        error: {
          code: 'NOT_AT_SWAP_STATION',
          message: `Not at battery swap station. Current location: ${currentPosition}`,
          details: { currentPosition },
        },
      };
    }

    // 换电成本和时间
    const cost = 0.5; // 元
    const timeCost = 1; // 分钟

    // 更新智能体状态
    agentState.updateBattery(100);
    agentState.deductCost(cost);

    // 调用换电回调
    if (context.onBatterySwap) {
      context.onBatterySwap();
    }

    return {
      success: true,
      data: {
        success: true,
        cost,
        timeCost,
        newBattery: 100,
      },
    };
  },
};

/**
 * 获取所有行动工具
 */
export function getActionTools(): ToolDefinition[] {
  return [
    acceptOrderTool,
    moveToTool,
    pickupFoodTool,
    deliverFoodTool,
    swapBatteryTool,
  ];
}
