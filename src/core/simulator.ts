/**
 * 模拟器核心
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 整合所有子系统，实现模拟初始化、主循环和终止条件检测
 * 需求：所有核心需求
 */

import { Node, Edge, Order, LevelConfig, WorldState, ToolCallRequest, ToolCallResponse } from '../types';
import { GameClock } from './game-clock';
import { AgentState } from './agent-state';
import { OrderGenerator } from './order-generator';
import { generateMap } from '../world/map-generator';
import { CongestionManager } from '../world/congestion-manager';
import { Pathfinder } from '../world/pathfinder';
import { ToolExecutor } from '../tools/tool-executor';
import { createToolRegistry } from '../tools/index';
import { ScoreCalculator } from '../scoring/score-calculator';

/**
 * 模拟器状态
 */
export type SimulatorStatus = 'initialized' | 'running' | 'completed' | 'error';

/**
 * 模拟器统计信息
 */
export interface SimulatorStats {
  totalToolCalls: number;
  invalidToolCalls: number;
  completedOrders: number;
  onTimeOrders: number;
  totalProfit: number;
  totalDistance: number;
  batterySwaps: number;
}

/**
 * 模拟器类
 * 
 * 核心职责：
 * - 初始化所有子系统（地图、时钟、订单、智能体）
 * - 管理模拟主循环
 * - 处理工具调用
 * - 检测终止条件
 * - 收集统计信息
 */
export class Simulator {
  // 配置
  private config: LevelConfig;
  
  // 子系统
  private gameClock: GameClock;
  private agentState: AgentState;
  private orderGenerator: OrderGenerator;
  private congestionManager: CongestionManager;
  private pathfinder: Pathfinder;
  private toolExecutor: ToolExecutor;
  private scoreCalculator: ScoreCalculator;
  
  // 世界状态
  private nodes: Map<string, Node>;
  private edges: Edge[];
  private congestionMap: Map<string, number>;
  
  // 模拟状态
  private status: SimulatorStatus;
  private stats: SimulatorStats;
  
  // Level 0.1 特殊处理
  private isLevel01: boolean;
  private level01OrderCompleted: boolean = false;

  /**
   * 创建模拟器实例
   * 
   * @param config Level 配置
   */
  constructor(config: LevelConfig) {
    this.config = config;
    this.status = 'initialized';
    this.isLevel01 = config.orderCount !== undefined && config.orderCount === 1;
    
    // 初始化统计信息
    this.stats = {
      totalToolCalls: 0,
      invalidToolCalls: 0,
      completedOrders: 0,
      onTimeOrders: 0,
      totalProfit: 0,
      totalDistance: 0,
      batterySwaps: 0,
    };
    
    // 生成地图
    const map = generateMap({
      seed: config.seed,
      size: config.mapSize,
    });
    
    this.nodes = map.nodes;
    this.edges = map.edges;
    
    // 初始化子系统
    // 从凌晨 6:00 开始，持续到第二天凌晨 6:00
    const startTime = 6 * 60; // 6:00 = 360 分钟
    const endTime = startTime + config.duration; // 结束时间 = 开始时间 + 持续时间
    this.gameClock = new GameClock(startTime, endTime);
    
    // 选择初始位置（随机选择一个节点）
    const nodeIds = Array.from(this.nodes.keys());
    const initialPosition = nodeIds[0]; // 简单起见，选择第一个节点
    this.agentState = new AgentState(initialPosition);
    
    this.orderGenerator = new OrderGenerator(config.seed);
    this.congestionManager = new CongestionManager(this.edges, this.nodes);
    this.pathfinder = new Pathfinder(this.nodes, this.edges);
    
    // 初始化拥堵地图（使用开始时间）
    this.congestionMap = this.congestionManager.updateCongestion(startTime);
    
    // 初始化工具系统
    const toolRegistry = createToolRegistry();
    this.toolExecutor = new ToolExecutor(toolRegistry);
    
    // 初始化评分计算器
    this.scoreCalculator = new ScoreCalculator();
    
    // 生成初始订单
    this.generateInitialOrders();
  }

  /**
   * 生成初始订单
   */
  private generateInitialOrders(): void {
    const currentTime = this.gameClock.getCurrentTime();
    
    if (this.isLevel01) {
      // Level 0.1: 只生成一个订单
      const pickupNodes = Array.from(this.nodes.values()).filter(
        n => n.type === 'restaurant' || n.type === 'supermarket' || n.type === 'pharmacy'
      );
      const deliveryNodes = Array.from(this.nodes.values()).filter(
        n => n.type === 'residential' || n.type === 'office'
      );
      
      this.orderGenerator.generateOrder(
        currentTime,
        pickupNodes,
        deliveryNodes,
        (from, to) => this.calculateDistance(from, to)
      );
    } else {
      // Level 1: 生成初始订单池
      const pickupNodes = Array.from(this.nodes.values()).filter(
        n => n.type === 'restaurant' || n.type === 'supermarket' || n.type === 'pharmacy'
      );
      const deliveryNodes = Array.from(this.nodes.values()).filter(
        n => n.type === 'residential' || n.type === 'office'
      );
      
      // 生成 5-10 个初始订单
      const initialOrderCount = 5 + Math.floor(Math.random() * 6);
      this.orderGenerator.generateOrders(
        initialOrderCount,
        currentTime,
        pickupNodes,
        deliveryNodes,
        (from, to) => this.calculateDistance(from, to)
      );
    }
  }

  /**
   * 执行工具调用
   * 
   * @param request 工具调用请求
   * @returns 工具调用响应
   */
  async executeToolCall(request: ToolCallRequest): Promise<ToolCallResponse> {
    this.stats.totalToolCalls++;
    
    // 构建工具执行上下文
    const context = {
      agentState: this.agentState,
      orderGenerator: this.orderGenerator,
      pathfinder: this.pathfinder,
      congestionManager: this.congestionManager,
      nodes: this.nodes,
      currentTime: this.gameClock.getCurrentTime(),
      simulator: this, // 添加 simulator 引用，用于 help 工具
      onBatterySwap: () => {
        this.stats.batterySwaps++;
      },
      onOrderComplete: (onTime: boolean, order?: Order, payment?: number, penalty?: number, overtime?: number) => {
        this.stats.completedOrders++;
        if (onTime) {
          this.stats.onTimeOrders++;
        }
        
        // 记录到评分计算器
        if (order && payment !== undefined && penalty !== undefined && overtime !== undefined) {
          const optimalDistance = this.pathfinder.calculateDistance(
            order.pickupLocation,
            order.deliveryLocation
          )?.distance ?? 0;
          
          this.scoreCalculator.recordOrderCompletion({
            orderId: order.id,
            orderType: order.type,
            deliveryFee: order.deliveryFee,
            payment,
            penalty,
            overtime,
            onTime,
            distance: order.distance,
            optimalDistance,
          });
          
          // 在终端输出订单完成信息（用于 Web 模式）
          this.logOrderCompletion(order, payment, penalty, overtime, onTime);
        }
        
        // Level 0.1: 标记订单完成
        if (this.isLevel01) {
          this.level01OrderCompleted = true;
        }
      },
    };
    
    // 执行工具调用
    const response = await this.toolExecutor.execute(request, context);
    
    // 记录到评分计算器
    this.scoreCalculator.recordToolCall(response.success);
    
    // 统计无效调用
    if (!response.success) {
      this.stats.invalidToolCalls++;
    }
    
    // 如果操作成功，推进时间（如果有 timeCost）
    if (response.success && response.data) {
      const data = response.data as any;
      if (data.timeCost && typeof data.timeCost === 'number' && data.timeCost > 0) {
        this.gameClock.advance(data.timeCost);
      }
    }
    
    // 如果是移动操作，记录距离
    if (request.toolName === 'move_to' && response.success && response.data) {
      const moveData = response.data as any;
      if (moveData.distance) {
        this.scoreCalculator.recordDistance(moveData.distance);
      }
    }
    
    // 如果是换电操作，记录换电
    if (request.toolName === 'swap_battery' && response.success) {
      this.scoreCalculator.recordBatterySwap(0.5);
    }
    
    // 更新拥堵地图（使用推进后的时间）
    this.congestionMap = this.congestionManager.updateCongestion(this.gameClock.getCurrentTime());
    
    // 更新统计信息
    this.updateStats();
    
    return response;
  }

  /**
   * 批量执行工具调用
   * 
   * @param requests 工具调用请求数组
   * @returns 工具调用响应数组
   */
  async executeToolCalls(requests: ToolCallRequest[]): Promise<ToolCallResponse[]> {
    const responses: ToolCallResponse[] = [];
    
    for (const request of requests) {
      const response = await this.executeToolCall(request);
      responses.push(response);
    }
    
    return responses;
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    this.stats.totalProfit = this.agentState.getProfit();
    this.stats.totalDistance = this.agentState.getTotalDistance();
  }

  /**
   * 检查终止条件
   * 
   * @returns true 如果应该终止模拟
   */
  shouldTerminate(): boolean {
    // 检查时间是否到达终点
    if (this.gameClock.hasReachedEnd()) {
      return true;
    }
    
    // Level 0.1: 检查订单是否完成
    if (this.isLevel01 && this.level01OrderCompleted) {
      return true;
    }
    
    return false;
  }

  /**
   * 推进模拟（生成新订单等）
   * 
   * 在 Level 1 中，应该定期调用此方法来生成新订单
   */
  advanceSimulation(): void {
    if (this.isLevel01) {
      // Level 0.1 不生成新订单
      return;
    }
    
    // Level 1: 根据基准频率生成新订单
    // const baseFrequency = this.config.baseOrderFrequency || 5;
    const currentTime = this.gameClock.getCurrentTime();
    
    // 简单实现：每次调用生成 1-3 个订单
    const orderCount = 1 + Math.floor(Math.random() * 3);
    
    const pickupNodes = Array.from(this.nodes.values()).filter(
      n => n.type === 'restaurant' || n.type === 'supermarket' || n.type === 'pharmacy'
    );
    const deliveryNodes = Array.from(this.nodes.values()).filter(
      n => n.type === 'residential' || n.type === 'office'
    );
    
    this.orderGenerator.generateOrders(
      orderCount,
      currentTime,
      pickupNodes,
      deliveryNodes,
      (from, to) => this.calculateDistance(from, to)
    );
    
    // 移除过期订单
    this.orderGenerator.removeExpiredOrders(currentTime);
  }

  /**
   * 计算两点间距离（辅助方法）
   */
  private calculateDistance(from: string, to: string): number {
    const result = this.pathfinder.calculateDistance(from, to);
    return result ? result.distance : 0;
  }

  // ============================================================================
  // 状态查询方法
  // ============================================================================

  /**
   * 获取当前游戏时间
   */
  getCurrentTime(): number {
    return this.gameClock.getCurrentTime();
  }

  /**
   * 获取格式化的当前时间
   */
  getFormattedTime(): string {
    return this.gameClock.getFormattedTime();
  }

  /**
   * 获取智能体状态
   */
  getAgentState(): AgentState {
    return this.agentState;
  }

  /**
   * 获取世界状态
   */
  getWorldState(): WorldState {
    return {
      nodes: this.nodes,
      edges: this.edges,
      currentTime: this.gameClock.getCurrentTime(),
      seed: this.config.seed,
      congestionMap: this.congestionMap,
    };
  }

  /**
   * 获取可用订单列表
   */
  getAvailableOrders(): Order[] {
    return this.orderGenerator.getAvailableOrders();
  }

  /**
   * 获取统计信息
   */
  getStats(): SimulatorStats {
    return { ...this.stats };
  }

  /**
   * 获取评分计算器
   */
  getScoreCalculator(): ScoreCalculator {
    return this.scoreCalculator;
  }

  /**
   * 获取模拟器状态
   */
  getStatus(): SimulatorStatus {
    return this.status;
  }

  /**
   * 设置模拟器状态
   */
  setStatus(status: SimulatorStatus): void {
    this.status = status;
  }

  /**
   * 获取配置
   */
  getConfig(): LevelConfig {
    return { ...this.config };
  }

  /**
   * 获取路径查找器
   */
  getPathfinder(): Pathfinder {
    return this.pathfinder;
  }

  /**
   * 获取拥堵管理器
   */
  getCongestionManager(): CongestionManager {
    return this.congestionManager;
  }

  /**
   * 获取游戏时钟
   */
  getGameClock(): GameClock {
    return this.gameClock;
  }

  /**
   * 获取节点信息
   */
  getNode(nodeId: string): Node | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * 获取所有节点
   */
  getNodes(): Map<string, Node> {
    return this.nodes;
  }

  /**
   * 获取所有边
   */
  getEdges(): Edge[] {
    return this.edges;
  }

  /**
   * 是否是 Level 0.1
   */
  isLevel01Mode(): boolean {
    return this.isLevel01;
  }

  /**
   * 计算最终评分
   */
  calculateFinalScore(): {
    profit: number;
    onTimeRate: number;
    pathEfficiency: number;
    apiViolationRate: number;
  } {
    const onTimeRate = this.stats.completedOrders > 0
      ? this.stats.onTimeOrders / this.stats.completedOrders
      : 0;
    
    const apiViolationRate = this.stats.totalToolCalls > 0
      ? this.stats.invalidToolCalls / this.stats.totalToolCalls
      : 0;
    
    // 路径效率需要更复杂的计算，这里简化为 1.0
    const pathEfficiency = 1.0;
    
    return {
      profit: this.stats.totalProfit,
      onTimeRate,
      pathEfficiency,
      apiViolationRate,
    };
  }

  /**
   * 记录订单完成信息到终端（用于 Web 模式）
   */
  private logOrderCompletion(
    order: Order,
    payment: number,
    penalty: number,
    overtime: number,
    onTime: boolean
  ): void {
    // 只在非调试模式下输出（避免与 AI 客户端的详细日志冲突）
    if (process.env.DEBUG === 'true') {
      return;
    }
    
    const statusIcon = onTime ? '✅' : '⏰';
    const statusText = onTime ? '准时完成' : `超时${overtime.toFixed(1)}分钟`;
    const orderTypeEmoji = this.getOrderTypeEmoji(order.type);
    
    console.log('\n' + '─'.repeat(70));
    console.log(`${statusIcon} 订单完成: ${order.id} ${orderTypeEmoji}`);
    console.log(`   配送费: ¥${order.deliveryFee.toFixed(2)}`);
    console.log(`   实际收入: ¥${payment.toFixed(2)}`);
    if (penalty > 0) {
      console.log(`   超时罚款: -¥${penalty.toFixed(2)}`);
    }
    console.log(`   状态: ${statusText}`);
    console.log('─'.repeat(70));
  }

  /**
   * 获取订单类型的 emoji
   */
  private getOrderTypeEmoji(type: string): string {
    switch (type) {
      case 'food':
        return '🍔';
      case 'supermarket':
        return '🛒';
      case 'pharmacy':
        return '💊';
      default:
        return '📦';
    }
  }

  /**
   * 生成报告摘要
   */
  generateReportSummary(): string {
    const score = this.calculateFinalScore();
    const duration = this.gameClock.getElapsedTime();
    
    return `
# Silicon Rider Bench - 评测报告

## 基本信息
- Level: ${this.isLevel01 ? '0.1' : '1'}
- Seed: ${this.config.seed}
- Duration: ${GameClock.formatTime(duration)}

## 核心指标
- **总利润**: ¥${score.profit.toFixed(2)}
- **完成订单数**: ${this.stats.completedOrders}
- **准时率**: ${(score.onTimeRate * 100).toFixed(1)}% (${this.stats.onTimeOrders}/${this.stats.completedOrders})
- **路径效率**: ${score.pathEfficiency.toFixed(2)}
- **API 违规率**: ${(score.apiViolationRate * 100).toFixed(1)}% (${this.stats.invalidToolCalls}/${this.stats.totalToolCalls})

## 详细统计
- 总行驶距离: ${this.stats.totalDistance.toFixed(1)} km
- 换电次数: ${this.stats.batterySwaps}
- 平均每单利润: ¥${this.stats.completedOrders > 0 ? (score.profit / this.stats.completedOrders).toFixed(2) : '0.00'}
- 超时订单数: ${this.stats.completedOrders - this.stats.onTimeOrders}
    `.trim();
  }
}
