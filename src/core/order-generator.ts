/**
 * 订单生成系统
 * 负责根据时间、订单潮汐规则生成订单，并管理订单池
 */

import { Order, OrderType, Node } from '../types';
import { SeededRNG } from '../utils/seeded-rng';
import { calculateTotalFee } from './fee-calculator';
import { getFoodSelector } from '../data/food-selector';

/**
 * 订单潮汐配置
 */
interface OrderTideConfig {
  startHour: number;
  endHour: number;
  orderType: OrderType;
  multiplier: number;
}

/**
 * 订单生成器类
 */
export class OrderGenerator {
  private rng: SeededRNG;
  private orderCounter: number = 0;
  private availableOrders: Map<string, Order> = new Map();
  private acceptedOrders: Set<string> = new Set();
  
  // 订单潮汐规则
  private tideRules: OrderTideConfig[] = [
    // 早高峰（6:00-9:00）：餐饮 ×3
    { startHour: 6, endHour: 9, orderType: 'food', multiplier: 3 },
    // 午高峰（10:30-12:30）：餐饮 ×4
    { startHour: 10.5, endHour: 12.5, orderType: 'food', multiplier: 4 },
    // 下午小高峰（15:00-17:00）：超市 ×3
    { startHour: 15, endHour: 17, orderType: 'supermarket', multiplier: 3 },
    // 晚高峰（18:00-20:00）：餐饮 ×4
    { startHour: 18, endHour: 20, orderType: 'food', multiplier: 4 },
    // 夜宵（21:00-24:00）：餐饮 ×2
    { startHour: 21, endHour: 24, orderType: 'food', multiplier: 2 },
    // 深夜（0:00-6:00）：药店 ×2
    { startHour: 0, endHour: 6, orderType: 'pharmacy', multiplier: 2 },
  ];

  constructor(seed: number) {
    this.rng = new SeededRNG(seed);
  }

  /**
   * 计算当前时间的订单生成频率倍数
   * 需求：18.1-18.6
   */
  private getOrderFrequencyMultiplier(currentTime: number, orderType: OrderType): number {
    const hour = currentTime / 60;
    
    for (const rule of this.tideRules) {
      if (hour >= rule.startHour && hour < rule.endHour && rule.orderType === orderType) {
        return rule.multiplier;
      }
    }
    
    // 深夜时段降低非药店订单频率
    if (hour >= 0 && hour < 6 && orderType !== 'pharmacy') {
      return 0.5;
    }
    
    return 1;
  }

  /**
   * 生成订单类型
   * 根据当前时间和潮汐规则选择订单类型
   */
  private generateOrderType(currentTime: number): OrderType {
    const hour = currentTime / 60;
    
    // 深夜时段主要生成药店订单
    if (hour >= 0 && hour < 6) {
      return this.rng.nextFloat() < 0.7 ? 'pharmacy' : 'food';
    }
    
    // 根据时段权重选择订单类型
    const weights: Record<OrderType, number> = {
      food: 0.7,
      supermarket: 0.2,
      pharmacy: 0.1,
    };
    
    // 应用潮汐倍数调整权重
    const foodMultiplier = this.getOrderFrequencyMultiplier(currentTime, 'food');
    const supermarketMultiplier = this.getOrderFrequencyMultiplier(currentTime, 'supermarket');
    const pharmacyMultiplier = this.getOrderFrequencyMultiplier(currentTime, 'pharmacy');
    
    weights.food *= foodMultiplier;
    weights.supermarket *= supermarketMultiplier;
    weights.pharmacy *= pharmacyMultiplier;
    
    const total = weights.food + weights.supermarket + weights.pharmacy;
    const rand = this.rng.nextFloat() * total;
    
    if (rand < weights.food) {
      return 'food';
    } else if (rand < weights.food + weights.supermarket) {
      return 'supermarket';
    } else {
      return 'pharmacy';
    }
  }

  /**
   * 生成订单重量
   * 需求：19.1, 19.2, 19.4
   */
  private generateOrderWeight(orderType: OrderType): number {
    switch (orderType) {
      case 'food':
        // 餐饮订单：0.5-1kg
        return this.rng.nextFloatRange(0.5, 1);
      case 'supermarket':
        // 超市订单：5-10kg
        return this.rng.nextFloatRange(5, 10);
      case 'pharmacy':
        // 药店订单：0.05-0.2kg
        return this.rng.nextFloatRange(0.05, 0.2);
    }
  }

  /**
   * 生成商品价格
   */
  private generateItemPrice(orderType: OrderType): number {
    switch (orderType) {
      case 'food':
        return this.rng.nextFloatRange(15, 80);
      case 'supermarket':
        return this.rng.nextFloatRange(30, 150);
      case 'pharmacy':
        return this.rng.nextFloatRange(10, 100);
    }
  }

  /**
   * 计算配送时限
   * 需求：21.1, 21.2
   */
  private calculateTimeLimit(distance: number): number {
    if (distance < 3) {
      // 距离小于 3km：20 分钟
      return 20;
    } else {
      // 距离大于等于 3km：20 分钟 + 超出 3km 部分每公里 3 分钟
      return 20 + (distance - 3) * 3;
    }
  }

  /**
   * 生成单个订单
   */
  generateOrder(
    currentTime: number,
    pickupNodes: Node[],
    deliveryNodes: Node[],
    distanceCalculator: (from: string, to: string) => number
  ): Order {
    const orderType = this.generateOrderType(currentTime);
    
    // 根据订单类型选择取餐点
    let pickupNode: Node;
    if (orderType === 'food') {
      const restaurants = pickupNodes.filter(n => n.type === 'restaurant');
      pickupNode = this.rng.choice(restaurants.length > 0 ? restaurants : pickupNodes);
    } else if (orderType === 'supermarket') {
      const supermarkets = pickupNodes.filter(n => n.type === 'supermarket');
      pickupNode = this.rng.choice(supermarkets.length > 0 ? supermarkets : pickupNodes);
    } else {
      const pharmacies = pickupNodes.filter(n => n.type === 'pharmacy');
      pickupNode = this.rng.choice(pharmacies.length > 0 ? pharmacies : pickupNodes);
    }
    
    // 选择送餐点（居民区或写字楼）
    const deliveryNodeCandidates = deliveryNodes.filter(
      n => n.type === 'residential' || n.type === 'office'
    );
    const deliveryNode = this.rng.choice(
      deliveryNodeCandidates.length > 0 ? deliveryNodeCandidates : deliveryNodes
    );
    
    // 计算距离
    const distance = distanceCalculator(pickupNode.id, deliveryNode.id);
    
    // 生成订单属性
    const weight = this.generateOrderWeight(orderType);
    const itemPrice = this.generateItemPrice(orderType);
    const timeLimit = this.calculateTimeLimit(distance);
    
    // 注意：配送费在接单时才计算时段费，这里先用 0 作为接单时间
    const deliveryFee = calculateTotalFee(distance, itemPrice, 0);
    
    // 生成订单名称
    const foodSelector = getFoodSelector();
    const name = foodSelector.selectFoodName(orderType, weight, itemPrice);
    
    const order: Order = {
      id: `order_${++this.orderCounter}`,
      type: orderType,
      name,
      pickupLocation: pickupNode.id,
      deliveryLocation: deliveryNode.id,
      distance,
      itemPrice,
      deliveryFee,
      weight,
      timeLimit,
      createdAt: currentTime,  // Record order creation time
      pickedUp: false,
      delivered: false,
    };
    
    this.availableOrders.set(order.id, order);
    return order;
  }

  /**
   * 批量生成订单
   */
  generateOrders(
    count: number,
    currentTime: number,
    pickupNodes: Node[],
    deliveryNodes: Node[],
    distanceCalculator: (from: string, to: string) => number
  ): Order[] {
    const orders: Order[] = [];
    for (let i = 0; i < count; i++) {
      orders.push(this.generateOrder(currentTime, pickupNodes, deliveryNodes, distanceCalculator));
    }
    return orders;
  }

  /**
   * 获取可用订单列表
   */
  getAvailableOrders(): Order[] {
    return Array.from(this.availableOrders.values());
  }

  /**
   * 获取指定订单
   */
  getOrder(orderId: string): Order | undefined {
    return this.availableOrders.get(orderId);
  }

  /**
   * 接受订单（从可用订单池中移除）
   */
  acceptOrder(orderId: string, acceptTime: number): Order | undefined {
    const order = this.availableOrders.get(orderId);
    if (!order) {
      return undefined;
    }
    
    // 更新订单的接单时间和截止时间
    order.acceptedAt = acceptTime;
    order.deadline = acceptTime + order.timeLimit;
    
    // 重新计算配送费（包含时段费）
    order.deliveryFee = calculateTotalFee(order.distance, order.itemPrice, acceptTime);
    
    // 从可用订单池中移除
    this.availableOrders.delete(orderId);
    this.acceptedOrders.add(orderId);
    
    return order;
  }

  /**
   * 移除过期订单
   * 如果订单在可用池中存在时间超过其 timeLimit，则视为过期并移除
   * 这样可以避免 AI 接到已经超时的订单
   */
  removeExpiredOrders(currentTime: number): void {
    const expiredOrders: string[] = [];
    
    for (const [orderId, order] of this.availableOrders.entries()) {
      // Check if order has been waiting too long (exceeded timeLimit since creation)
      const waitingTime = currentTime - order.createdAt;
      if (waitingTime > order.timeLimit) {
        expiredOrders.push(orderId);
      }
    }
    
    // Remove expired orders and log if any
    if (expiredOrders.length > 0) {
      console.log(`[OrderGenerator] Removing ${expiredOrders.length} expired order(s): ${expiredOrders.join(', ')}`);
    }
    
    expiredOrders.forEach(orderId => this.availableOrders.delete(orderId));
  }

  /**
   * 搜索附近的订单
   */
  searchNearbyOrders(
    agentPosition: string,
    radius: number,
    distanceCalculator: (from: string, to: string) => number
  ): Order[] {
    const nearbyOrders: Order[] = [];
    
    for (const order of this.availableOrders.values()) {
      const distance = distanceCalculator(agentPosition, order.pickupLocation);
      if (distance <= radius) {
        nearbyOrders.push(order);
      }
    }
    
    return nearbyOrders;
  }

  /**
   * 清空订单池（用于测试）
   */
  clear(): void {
    this.availableOrders.clear();
    this.acceptedOrders.clear();
    this.orderCounter = 0;
  }
}
