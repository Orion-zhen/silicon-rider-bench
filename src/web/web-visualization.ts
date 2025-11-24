/**
 * Web 可视化适配器
 * Silicon Rider Bench - Web Visualization
 * 
 * 将模拟器事件转换为 WebSocket 消息并广播到客户端
 */

import type { Simulator } from '../core/simulator.js';
import type { WebServer } from './web-server.js';
import type {
  InitMessage,
  StateUpdateMessage,
  ConversationMessage,
  ToolCallMessage,
  ToolResultMessage,
  SimulationEndMessage,
} from './types.js';

/**
 * Web 可视化适配器类
 * 
 * 职责：
 * - 将模拟器状态转换为 WebSocket 消息
 * - 通过 WebServer 广播消息到所有连接的客户端
 * - 提供便捷的方法来发送不同类型的消息
 * - 实现消息节流以优化性能
 */
export class WebVisualization {
  private simulator: Simulator;
  private webServer: WebServer;
  private modelName: string;
  private currentIteration: number = 0;
  private maxIterations: number = 300;
  private lastTotalTokens: number = 0;
  private lastPromptTokens: number = 0;
  private lastCompletionTokens: number = 0;
  private cumulativeTotalTokens: number = 0;
  private cumulativePromptTokens: number = 0;
  private cumulativeCompletionTokens: number = 0;
  
  // 消息节流配置
  private readonly THROTTLE_INTERVAL = 100; // 100ms 节流间隔
  private lastStateUpdateTime = 0;
  private pendingStateUpdate = false;
  private throttleTimer: NodeJS.Timeout | null = null;

  constructor(simulator: Simulator, webServer: WebServer, modelName?: string) {
    this.simulator = simulator;
    this.webServer = webServer;
    this.modelName = modelName || 'Unknown';
  }
  
  /**
   * 设置最大迭代次数
   * @param maxIterations 最大迭代次数
   */
  setMaxIterations(maxIterations: number): void {
    this.maxIterations = maxIterations;
  }

  /**
   * 更新当前迭代次数
   * @param iteration 当前迭代次数
   */
  updateIteration(iteration: number): void {
    this.currentIteration = iteration;
  }

  /**
   * 更新 token 使用量
   * @param lastTotal 单次总 token 数
   * @param lastPrompt 单次提示 token 数
   * @param lastCompletion 单次完成 token 数
   * @param cumulativeTotal 累计总 token 数
   * @param cumulativePrompt 累计提示 token 数
   * @param cumulativeCompletion 累计完成 token 数
   */
  updateTokenUsage(
    lastTotal: number,
    lastPrompt: number,
    lastCompletion: number,
    cumulativeTotal: number,
    cumulativePrompt: number,
    cumulativeCompletion: number
  ): void {
    this.lastTotalTokens = lastTotal;
    this.lastPromptTokens = lastPrompt;
    this.lastCompletionTokens = lastCompletion;
    this.cumulativeTotalTokens = cumulativeTotal;
    this.cumulativePromptTokens = cumulativePrompt;
    this.cumulativeCompletionTokens = cumulativeCompletion;
  }

  /**
   * 清理资源
   * 在服务器关闭时调用
   */
  cleanup(): void {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }
  }

  /**
   * 发送初始化数据
   * 在客户端连接时调用，发送地图和配置信息
   */
  sendInitialData(): void {
    const worldState = this.simulator.getWorldState();
    const config = this.simulator.getConfig();

    // 转换节点数据
    const nodes = Array.from(worldState.nodes.values()).map(node => ({
      id: node.id,
      type: node.type,
      name: node.name,
      position: node.position,
      emoji: node.emoji,
    }));

    // 转换边数据
    const edges = worldState.edges.map(edge => ({
      from: edge.from,
      to: edge.to,
      distance: edge.distance,
    }));

    const message: InitMessage = {
      type: 'init',
      timestamp: Date.now(),
      data: {
        nodes,
        edges,
        config: {
          level: this.simulator.isLevel01Mode() ? '0.1' : '1',
          seed: config.seed,
          duration: config.duration,
          modelName: this.modelName,
        },
      },
    };

    this.webServer.broadcast(message);
  }

  /**
   * 发送状态更新（带节流）
   * 在模拟器状态变化时调用
   * 
   * 使用节流机制避免过于频繁的更新：
   * - 如果距离上次更新不足 THROTTLE_INTERVAL，则延迟发送
   * - 确保最后一次更新总是会被发送
   */
  sendStateUpdate(): void {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastStateUpdateTime;

    // 如果距离上次更新时间足够长，立即发送
    if (timeSinceLastUpdate >= this.THROTTLE_INTERVAL) {
      this.performStateUpdate();
      this.lastStateUpdateTime = now;
      this.pendingStateUpdate = false;
      
      // 清除任何待处理的定时器
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
        this.throttleTimer = null;
      }
    } else {
      // 标记有待处理的更新
      this.pendingStateUpdate = true;
      
      // 如果还没有设置定时器，设置一个
      if (!this.throttleTimer) {
        const delay = this.THROTTLE_INTERVAL - timeSinceLastUpdate;
        this.throttleTimer = setTimeout(() => {
          if (this.pendingStateUpdate) {
            this.performStateUpdate();
            this.lastStateUpdateTime = Date.now();
            this.pendingStateUpdate = false;
          }
          this.throttleTimer = null;
        }, delay);
      }
    }
  }

  /**
   * 执行实际的状态更新广播
   * 私有方法，由 sendStateUpdate 调用
   */
  private performStateUpdate(): void {
    const agentState = this.simulator.getAgentState();
    const currentTime = this.simulator.getCurrentTime();
    const formattedTime = this.simulator.getFormattedTime();

    // 转换携带订单数据
    const carriedOrders = agentState.getCarriedOrders().map(order => ({
      id: order.id,
      type: order.type,
      name: order.name,
      weight: order.weight,
      deadline: order.deadline || 0,
      pickedUp: order.pickedUp,
      deliveryFee: order.deliveryFee,
    }));

    const message: StateUpdateMessage = {
      type: 'state_update',
      timestamp: Date.now(),
      data: {
        currentTime,
        formattedTime,
        currentIteration: this.currentIteration,
        maxIterations: this.maxIterations,
        lastTotalTokens: this.lastTotalTokens,
        lastPromptTokens: this.lastPromptTokens,
        lastCompletionTokens: this.lastCompletionTokens,
        cumulativeTotalTokens: this.cumulativeTotalTokens,
        cumulativePromptTokens: this.cumulativePromptTokens,
        cumulativeCompletionTokens: this.cumulativeCompletionTokens,
        agentState: {
          position: agentState.getPosition(),
          battery: agentState.getBattery(),
          profit: agentState.getProfit(),
          carriedOrders,
          totalWeight: agentState.getTotalWeight(),
          completedOrders: agentState.getCompletedOrders(),
        },
      },
    };

    this.webServer.broadcast(message);
  }

  /**
   * 发送对话消息
   * 在 AI 与系统交互时调用
   * 
   * @param role 消息角色
   * @param content 消息内容
   */
  sendConversation(role: 'user' | 'assistant' | 'system', content: string): void {
    const message: ConversationMessage = {
      type: 'conversation',
      timestamp: Date.now(),
      data: {
        role,
        content,
      },
    };

    this.webServer.broadcast(message);
  }

  /**
   * 发送工具调用信息
   * 在 AI 调用工具时调用
   * 
   * @param toolName 工具名称
   * @param args 工具参数
   */
  sendToolCall(toolName: string, args: Record<string, any>): void {
    const message: ToolCallMessage = {
      type: 'tool_call',
      timestamp: Date.now(),
      data: {
        toolName,
        arguments: args,
      },
    };

    this.webServer.broadcast(message);
  }

  /**
   * 发送工具结果
   * 在工具调用返回结果时调用
   * 
   * @param toolName 工具名称
   * @param success 是否成功
   * @param result 结果数据
   */
  sendToolResult(toolName: string, success: boolean, result: any): void {
    const message: ToolResultMessage = {
      type: 'tool_result',
      timestamp: Date.now(),
      data: {
        toolName,
        success,
        result,
      },
    };

    this.webServer.broadcast(message);
  }

  /**
   * 发送模拟结束消息
   * 在模拟完成时调用
   * 
   * @param report 报告文本
   */
  sendSimulationEnd(report: string): void {
    const stats = this.simulator.getStats();
    
    const message: SimulationEndMessage = {
      type: 'simulation_end',
      timestamp: Date.now(),
      data: {
        report,
        finalProfit: stats.totalProfit,
        completedOrders: stats.completedOrders,
        totalDistance: stats.totalDistance,
      },
    };

    this.webServer.broadcast(message);
  }
}
