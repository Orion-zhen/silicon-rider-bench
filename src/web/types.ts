/**
 * WebSocket 消息协议类型定义
 * Silicon Rider Bench - Web Visualization
 */

import type { NodeType } from '../types/index.js';

// ============================================================================
// 消息类型枚举
// ============================================================================

/**
 * WebSocket 消息类型
 */
export type MessageType = 
  | 'init'           // 初始化数据
  | 'state_update'   // 状态更新
  | 'conversation'   // 对话消息
  | 'tool_call'      // 工具调用
  | 'tool_result'    // 工具结果
  | 'simulation_end' // 模拟结束
  | 'error';         // 错误消息

// ============================================================================
// 基础消息结构
// ============================================================================

/**
 * WebSocket 消息基础接口
 */
export interface WebSocketMessage {
  type: MessageType;
  timestamp: number;
  data: any;
}

// ============================================================================
// 具体消息类型
// ============================================================================

/**
 * 初始化消息
 * 在客户端连接时发送，包含地图和配置信息
 */
export interface InitMessage extends WebSocketMessage {
  type: 'init';
  data: {
    nodes: Array<{
      id: string;
      type: NodeType;
      name: string;
      position: { x: number; y: number };
    }>;
    edges: Array<{
      from: string;
      to: string;
      distance: number;
    }>;
    config: {
      level: string;
      seed: number;
      duration: number;
    };
  };
}

/**
 * 状态更新消息
 * 在模拟器状态变化时发送
 */
export interface StateUpdateMessage extends WebSocketMessage {
  type: 'state_update';
  data: {
    currentTime: number;
    formattedTime: string;
    agentState: {
      position: string;
      battery: number;
      profit: number;
      carriedOrders: Array<{
        id: string;
        type: string;
        weight: number;
        deadline: number;
        pickedUp: boolean;
      }>;
      totalWeight: number;
      completedOrders: number;
    };
  };
}

/**
 * 对话消息
 * 在 AI 与系统交互时发送
 */
export interface ConversationMessage extends WebSocketMessage {
  type: 'conversation';
  data: {
    role: 'user' | 'assistant' | 'system';
    content: string;
  };
}

/**
 * 工具调用消息
 * 在 AI 调用工具时发送
 */
export interface ToolCallMessage extends WebSocketMessage {
  type: 'tool_call';
  data: {
    toolName: string;
    arguments: Record<string, any>;
  };
}

/**
 * 工具结果消息
 * 在工具调用返回结果时发送
 */
export interface ToolResultMessage extends WebSocketMessage {
  type: 'tool_result';
  data: {
    toolName: string;
    success: boolean;
    result: any;
  };
}

/**
 * 模拟结束消息
 * 在模拟完成时发送
 */
export interface SimulationEndMessage extends WebSocketMessage {
  type: 'simulation_end';
  data: {
    report: string;
    finalProfit: number;
    completedOrders: number;
    totalDistance: number;
  };
}

/**
 * 错误消息
 * 在发生错误时发送
 */
export interface ErrorMessage extends WebSocketMessage {
  type: 'error';
  data: {
    message: string;
    code?: string;
    details?: any;
  };
}

// ============================================================================
// 联合类型
// ============================================================================

/**
 * 所有可能的 WebSocket 消息类型
 */
export type AnyWebSocketMessage = 
  | InitMessage
  | StateUpdateMessage
  | ConversationMessage
  | ToolCallMessage
  | ToolResultMessage
  | SimulationEndMessage
  | ErrorMessage;
