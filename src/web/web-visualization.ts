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
  
  // 消息节流配置
  private readonly THROTTLE_INTERVAL = 100; // 100ms 节流间隔
  private lastStateUpdateTime = 0;
  private pendingStateUpdate = false;
  private throttleTimer: NodeJS.Timeout | null = null;

  constructor(simulator: Simulator, webServer: WebServer) {
    this.simulator = simulator;
    this.webServer = webServer;
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
      weight: order.weight,
      deadline: order.deadline || 0,
      pickedUp: order.pickedUp,
    }));

    const message: StateUpdateMessage = {
      type: 'state_update',
      timestamp: Date.now(),
      data: {
        currentTime,
        formattedTime,
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
