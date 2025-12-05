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
  GetReceiptsResponse,
  PickupFoodByPhoneResponse,
  WaitResponse,
  ImageTransportMode,
} from '../types';
import { ToolDefinition } from './tool-registry';
import { ToolContext } from './query-tools';
import { MovementCalculator } from '../core/movement-calculator';
import { calculatePayment } from '../core/penalty-calculator';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Sanitize order object to remove sensitive V2 fields (phoneNumber, receiptImagePath)
 * This prevents AI from seeing the phone number before analyzing the receipt image
 */
function sanitizeOrderForResponse(order: any): any {
  const { phoneNumber, receiptImagePath, ...safeOrder } = order;
  return safeOrder;
}

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

    // V2 模式：移除敏感字段（phoneNumber, receiptImagePath），防止 AI 直接看到手机号
    const safeOrder = sanitizeOrderForResponse(acceptedOrder);

    return {
      success: true,
      data: {
        success: true,
        order: safeOrder,
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
      distance: pathResult.distance,
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
      context.onOrderComplete(
        onTime,
        order,
        paymentResult.payment,
        paymentResult.penalty,
        paymentResult.overtime
      );
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
  handler: async (_params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<SwapBatteryResponse>> => {
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
 * Get receipts at a location (V2 mode only)
 * Returns receipt images for all orders that need to be picked up at the specified location
 */
export const getReceiptsTool: ToolDefinition = {
  name: 'get_receipts',
  description: '获取指定地点的外卖小票图片（V2 模式专用）。返回当前地点所有待取餐订单的小票图片，需要识别小票上的手机号来取餐。',
  parameters: {
    targetLocationId: {
      type: 'string',
      required: true,
      description: '目标地点 ID（取餐点）',
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<GetReceiptsResponse>> => {
    const { agentState, nodes } = context;
    const targetLocationId = params.targetLocationId as string;

    // Validate location
    if (!nodes.has(targetLocationId)) {
      return {
        success: false,
        error: {
          code: 'INVALID_LOCATION',
          message: `Invalid location: ${targetLocationId}`,
          details: { targetLocationId },
        },
      };
    }

    // Check if agent is at the target location
    const currentPosition = agentState.getPosition();
    if (currentPosition !== targetLocationId) {
      return {
        success: false,
        error: {
          code: 'WRONG_LOCATION',
          message: `Not at target location. Current: ${currentPosition}, Required: ${targetLocationId}`,
          details: { currentPosition, targetLocationId },
        },
      };
    }

    // Find all carried orders that need to be picked up at this location
    const carriedOrders = agentState.getCarriedOrders();
    const ordersAtLocation = carriedOrders.filter(
      order => order.pickupLocation === targetLocationId && !order.pickedUp && order.receiptImagePath
    );

    if (ordersAtLocation.length === 0) {
      return {
        success: false,
        error: {
          code: 'NO_RECEIPTS_AT_LOCATION',
          message: `No pending receipts at location: ${targetLocationId}`,
          details: { targetLocationId },
        },
      };
    }

    // Get image transport mode from environment
    const imageTransportMode: ImageTransportMode = 
      (process.env.IMAGE_TRANSPORT_MODE as ImageTransportMode) || 'base64';

    // Build receipts response
    const receipts: GetReceiptsResponse['receipts'] = [];
    const dataDir = path.join(__dirname, '..', 'data', 'synthetic_receipt_data');

    for (const order of ordersAtLocation) {
      const imagePath = path.join(dataDir, order.receiptImagePath!);
      const absolutePath = path.resolve(imagePath);
      
      let imageData: string | undefined;
      
      if (imageTransportMode === 'base64') {
        // Read image and encode as base64
        if (fs.existsSync(absolutePath)) {
          const imageBuffer = fs.readFileSync(absolutePath);
          const base64Data = imageBuffer.toString('base64');
          imageData = `data:image/jpeg;base64,${base64Data}`;
        }
      } else {
        // Use file:// URL format
        imageData = `file://${absolutePath}`;
      }

      receipts.push({
        orderId: order.id,
        imagePath: order.receiptImagePath!,
        imageData,
      });
    }

    return {
      success: true,
      data: {
        receipts,
        message: `Found ${receipts.length} receipt(s) at ${targetLocationId}. Please identify the phone numbers from the receipt images.`,
      },
    };
  },
};

/**
 * Pickup food by phone number (V2 mode only)
 * AI must identify the phone number from the receipt image and provide it to pick up the order
 */
export const pickupFoodByPhoneTool: ToolDefinition = {
  name: 'pickup_food_by_phone_number',
  description: '通过手机号取餐（V2 模式专用）。需要先调用 get_receipts 获取小票图片，识别图片中的手机号，然后使用该手机号取餐。',
  parameters: {
    phoneNumber: {
      type: 'string',
      required: true,
      description: '小票上的手机号（格式如 172****3882）',
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<PickupFoodByPhoneResponse>> => {
    const { agentState } = context;
    const phoneNumber = params.phoneNumber as string;

    // Get current position
    const currentPosition = agentState.getPosition();

    // Find carried orders at current location that match the phone number
    const carriedOrders = agentState.getCarriedOrders();
    const matchingOrder = carriedOrders.find(
      order => 
        order.pickupLocation === currentPosition && 
        !order.pickedUp && 
        order.phoneNumber === phoneNumber
    );

    if (!matchingOrder) {
      // Check if there are any orders at this location to provide better error message
      const ordersAtLocation = carriedOrders.filter(
        order => order.pickupLocation === currentPosition && !order.pickedUp
      );

      if (ordersAtLocation.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_RECEIPTS_AT_LOCATION',
            message: `No pending orders at current location: ${currentPosition}`,
            details: { currentPosition },
          },
        };
      }

      return {
        success: false,
        error: {
          code: 'PHONE_NUMBER_NOT_MATCH',
          message: `Phone number does not match any order at this location. Provided: ${phoneNumber}`,
          details: { 
            phoneNumber, 
            currentPosition,
            hint: 'Please check the receipt image again for the correct phone number.',
          },
        },
      };
    }

    // Mark order as picked up
    agentState.markOrderPickedUp(matchingOrder.id);

    // Pickup takes 2 minutes
    const timeCost = 2;

    return {
      success: true,
      data: {
        success: true,
        timeCost,
        orderId: matchingOrder.id,
        message: `Successfully picked up order ${matchingOrder.id} using phone number ${phoneNumber}`,
      },
    };
  },
};

/**
 * 等待（跳过时间）
 * 用于等待新订单生成或时间推进
 */
export const waitTool: ToolDefinition = {
  name: 'wait',
  description: '等待指定的分钟数，跳过时间。在等待期间会生成新订单并移除过期订单。',
  parameters: {
    minutes: {
      type: 'number',
      required: true,
      description: '等待的分钟数（1-60）',
      min: 1,
      max: 60,
    },
  },
  handler: async (params: Record<string, any>, context: ToolContext): Promise<ToolCallResponse<WaitResponse>> => {
    const { simulator } = context;
    const minutes = params.minutes as number;

    // Validate minutes parameter
    if (!minutes || minutes < 1) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: 'Minutes must be at least 1',
          details: { minutes },
        },
      };
    }

    if (minutes > 60) {
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: 'Minutes cannot exceed 60',
          details: { minutes },
        },
      };
    }

    // Check if simulator is available
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

    // Get previous time
    const previousTime = simulator.getCurrentTime();

    // Get order counts before wait
    const ordersBefore = simulator.getAvailableOrders().length;

    // Advance game clock
    const gameClock = simulator.getGameClock();
    gameClock.advance(minutes);

    // Generate new orders and remove expired ones
    // Call advanceSimulation multiple times based on minutes to generate more orders
    const advanceCount = Math.max(1, Math.floor(minutes / 5)); // At least once, more for longer waits
    for (let i = 0; i < advanceCount; i++) {
      simulator.advanceSimulation();
    }

    // Get current time and order counts after wait
    const currentTime = simulator.getCurrentTime();
    const ordersAfter = simulator.getAvailableOrders().length;
    
    // Calculate changes (approximate)
    const newOrdersGenerated = Math.max(0, ordersAfter - ordersBefore);

    return {
      success: true,
      data: {
        success: true,
        timeCost: minutes,
        previousTime,
        currentTime,
        newOrdersGenerated,
        expiredOrders: 0, // We don't have exact count, simulator handles it internally
        message: `Waited ${minutes} minutes. Time advanced from ${formatTime(previousTime)} to ${formatTime(currentTime)}.`,
      },
    };
  },
};

/**
 * Helper function to format time
 */
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * 获取所有行动工具 (V1 mode)
 */
export function getActionTools(): ToolDefinition[] {
  return [
    acceptOrderTool,
    moveToTool,
    pickupFoodTool,
    deliverFoodTool,
    swapBatteryTool,
    waitTool,
  ];
}

/**
 * 获取 V2 模式的行动工具
 * 不包含 pickup_food，增加 get_receipts 和 pickup_food_by_phone_number
 */
export function getActionToolsV2(): ToolDefinition[] {
  return [
    acceptOrderTool,
    moveToTool,
    getReceiptsTool,
    pickupFoodByPhoneTool,
    deliverFoodTool,
    swapBatteryTool,
    waitTool,
  ];
}
