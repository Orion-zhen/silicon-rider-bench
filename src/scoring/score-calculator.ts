/**
 * 评分计算器
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 需求：14.1-14.4
 */

// import { Order } from '../types';

/**
 * 订单完成记录
 */
export interface OrderCompletionRecord {
  orderId: string;
  orderType: string;
  deliveryFee: number;
  payment: number;
  penalty: number;
  overtime: number;
  onTime: boolean;
  distance: number;
  optimalDistance: number;
}

/**
 * 评分指标
 */
export interface ScoreMetrics {
  // 核心指标
  totalProfit: number;           // 总利润（需求 14.1）
  onTimeRate: number;            // 准时率（需求 14.2）
  pathEfficiency: number;        // 路径效率（需求 14.3）
  apiViolationRate: number;      // API 违规率（需求 14.4）
  
  // 详细统计
  completedOrders: number;       // 完成订单数
  onTimeOrders: number;          // 准时订单数
  totalDistance: number;         // 总行驶距离
  optimalDistance: number;       // 理论最优距离
  totalToolCalls: number;        // 总工具调用数
  invalidToolCalls: number;      // 无效工具调用数
  batterySwaps: number;          // 换电次数
  totalRevenue: number;          // 总收入（所有订单支付）
  totalPenalty: number;          // 总惩罚
  totalCost: number;             // 总成本（换电等）
  
  // 订单类型分布
  foodOrders: number;
  supermarketOrders: number;
  pharmacyOrders: number;
  
  // 平均值
  averageProfit: number;         // 平均每单利润
  averageOvertime: number;       // 平均超时时长
}

/**
 * 评分计算器类
 * 
 * 负责跟踪和计算所有评分指标
 */
export class ScoreCalculator {
  // 订单完成记录
  private completionRecords: OrderCompletionRecord[] = [];
  
  // 统计数据
  private totalToolCalls: number = 0;
  private invalidToolCalls: number = 0;
  private totalDistance: number = 0;
  private optimalDistance: number = 0;
  private batterySwaps: number = 0;
  private totalCost: number = 0;

  /**
   * 记录订单完成
   * 
   * @param record 订单完成记录
   */
  recordOrderCompletion(record: OrderCompletionRecord): void {
    this.completionRecords.push(record);
    this.optimalDistance += record.optimalDistance;
  }

  /**
   * 记录工具调用
   * 
   * @param isValid 是否有效
   */
  recordToolCall(isValid: boolean): void {
    this.totalToolCalls++;
    if (!isValid) {
      this.invalidToolCalls++;
    }
  }

  /**
   * 记录移动距离
   * 
   * @param distance 距离（km）
   */
  recordDistance(distance: number): void {
    this.totalDistance += distance;
  }

  /**
   * 记录换电
   * 
   * @param cost 换电成本
   */
  recordBatterySwap(cost: number): void {
    this.batterySwaps++;
    this.totalCost += cost;
  }

  /**
   * 记录其他成本
   * 
   * @param cost 成本金额
   */
  recordCost(cost: number): void {
    this.totalCost += cost;
  }

  /**
   * 计算总利润
   * 需求：14.1
   * 
   * 总利润 = 所有订单支付之和 - 罚款 - 成本
   * 
   * @returns 总利润
   */
  calculateTotalProfit(): number {
    const totalRevenue = this.completionRecords.reduce(
      (sum, record) => sum + record.payment,
      0
    );
    
    return totalRevenue - this.totalCost;
  }

  /**
   * 计算准时率
   * 需求：14.2
   * 
   * 准时率 = 准时配送数 / 总配送数
   * 
   * @returns 准时率（0-1）
   */
  calculateOnTimeRate(): number {
    if (this.completionRecords.length === 0) {
      return 0;
    }
    
    const onTimeCount = this.completionRecords.filter(
      record => record.onTime
    ).length;
    
    return onTimeCount / this.completionRecords.length;
  }

  /**
   * 计算路径效率
   * 需求：14.3
   * 
   * 路径效率 = 实际行驶距离 / 理论最优距离
   * 
   * @returns 路径效率（≥1.0，越接近1.0越好）
   */
  calculatePathEfficiency(): number {
    if (this.optimalDistance === 0) {
      return 1.0;
    }
    
    return this.totalDistance / this.optimalDistance;
  }

  /**
   * 计算 API 违规率
   * 需求：14.4
   * 
   * API 违规率 = 无效工具调用数 / 总工具调用数
   * 
   * @returns API 违规率（0-1）
   */
  calculateApiViolationRate(): number {
    if (this.totalToolCalls === 0) {
      return 0;
    }
    
    return this.invalidToolCalls / this.totalToolCalls;
  }

  /**
   * 计算完整的评分指标
   * 
   * @returns 所有评分指标
   */
  calculateMetrics(): ScoreMetrics {
    const completedOrders = this.completionRecords.length;
    const onTimeOrders = this.completionRecords.filter(r => r.onTime).length;
    
    const totalRevenue = this.completionRecords.reduce(
      (sum, record) => sum + record.payment,
      0
    );
    
    const totalPenalty = this.completionRecords.reduce(
      (sum, record) => sum + record.penalty,
      0
    );
    
    const totalProfit = this.calculateTotalProfit();
    const onTimeRate = this.calculateOnTimeRate();
    const pathEfficiency = this.calculatePathEfficiency();
    const apiViolationRate = this.calculateApiViolationRate();
    
    // 订单类型统计
    const foodOrders = this.completionRecords.filter(
      r => r.orderType === 'food'
    ).length;
    const supermarketOrders = this.completionRecords.filter(
      r => r.orderType === 'supermarket'
    ).length;
    const pharmacyOrders = this.completionRecords.filter(
      r => r.orderType === 'pharmacy'
    ).length;
    
    // 平均值计算
    const averageProfit = completedOrders > 0
      ? totalProfit / completedOrders
      : 0;
    
    const totalOvertime = this.completionRecords.reduce(
      (sum, record) => sum + record.overtime,
      0
    );
    const averageOvertime = completedOrders > 0
      ? totalOvertime / completedOrders
      : 0;
    
    return {
      totalProfit,
      onTimeRate,
      pathEfficiency,
      apiViolationRate,
      completedOrders,
      onTimeOrders,
      totalDistance: this.totalDistance,
      optimalDistance: this.optimalDistance,
      totalToolCalls: this.totalToolCalls,
      invalidToolCalls: this.invalidToolCalls,
      batterySwaps: this.batterySwaps,
      totalRevenue,
      totalPenalty,
      totalCost: this.totalCost,
      foodOrders,
      supermarketOrders,
      pharmacyOrders,
      averageProfit,
      averageOvertime,
    };
  }

  /**
   * 获取订单完成记录
   */
  getCompletionRecords(): OrderCompletionRecord[] {
    return [...this.completionRecords];
  }

  /**
   * 重置所有统计数据
   */
  reset(): void {
    this.completionRecords = [];
    this.totalToolCalls = 0;
    this.invalidToolCalls = 0;
    this.totalDistance = 0;
    this.optimalDistance = 0;
    this.batterySwaps = 0;
    this.totalCost = 0;
  }
}
