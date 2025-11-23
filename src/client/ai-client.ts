/**
 * AI 客户端模块
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 需求：16.1-16.4
 * 
 * 职责：
 * - 加载 .env 配置
 * - 初始化 OpenAI SDK（配置 OpenRouter）
 * - 实现工具定义生成
 * - 实现对话循环
 * - 实现工具调用解析和执行
 */

import OpenAI from 'openai';
import dotenv from 'dotenv';
import { Simulator } from '../core/simulator';
import { ToolCallRequest } from '../types';
import { createToolRegistry } from '../tools';
import { generateSystemPrompt } from './system-prompt';

// 加载环境变量
dotenv.config();

/**
 * AI 客户端配置
 */
export interface AIClientConfig {
  apiKey: string;
  modelName: string;
  baseURL: string;
  siteURL?: string;
  appName?: string;
  maxIterations?: number;
  temperature?: number;
}

/**
 * 对话消息
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
}

/**
 * 对话日志条目
 */
export interface ConversationLogEntry {
  iteration: number;
  type: 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

/**
 * AI 客户端类
 * 
 * 负责与 OpenAI SDK 交互，管理对话循环，处理工具调用
 */
export class AIClient {
  private client: OpenAI;
  private config: AIClientConfig;
  private simulator: Simulator;
  private conversationHistory: ChatMessage[];
  private toolDefinitions: any[];
  private conversationLogs: ConversationLogEntry[];
  private lastReadLogIndex: number;

  /**
   * 创建 AI 客户端实例
   * 
   * @param simulator 模拟器实例
   * @param config 客户端配置（可选，默认从环境变量加载）
   */
  constructor(simulator: Simulator, config?: Partial<AIClientConfig>) {
    this.simulator = simulator;
    
    // 加载配置
    this.config = this.loadConfig(config);
    
    // 初始化 OpenAI SDK
    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      defaultHeaders: {
        'HTTP-Referer': this.config.siteURL || '',
        'X-Title': this.config.appName || 'Silicon Rider Bench',
      },
    });
    
    // 初始化对话历史
    this.conversationHistory = [];
    
    // 初始化对话日志
    this.conversationLogs = [];
    this.lastReadLogIndex = 0;
    
    // 生成工具定义
    this.toolDefinitions = this.generateToolDefinitions();
  }

  /**
   * 加载配置
   * 需求：16.1
   * 
   * @param config 部分配置
   * @returns 完整配置
   */
  private loadConfig(config?: Partial<AIClientConfig>): AIClientConfig {
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) {
      throw new Error('API_KEY is required. Please set it in .env file.');
    }

    // 解析最大迭代次数，支持从环境变量读取
    const maxIterationsFromEnv = process.env.MAX_ITERATIONS 
      ? parseInt(process.env.MAX_ITERATIONS, 10) 
      : undefined;

    return {
      apiKey,
      modelName: config?.modelName || process.env.MODEL_NAME || 'anthropic/claude-3.5-sonnet',
      baseURL: config?.baseURL || process.env.BASE_URL || 'https://openrouter.ai/api/v1',
      siteURL: config?.siteURL || process.env.SITE_URL,
      appName: config?.appName || process.env.APP_NAME || 'Silicon Rider Bench',
      maxIterations: config?.maxIterations || maxIterationsFromEnv || 300,
      temperature: config?.temperature || 0.7,
    };
  }

  /**
   * 生成工具定义
   * 需求：16.1
   * 
   * @returns OpenAI 格式的工具定义数组
   */
  private generateToolDefinitions(): any[] {
    const registry = createToolRegistry();
    return registry.toOpenAIFormat();
  }

  /**
   * 初始化对话
   * 
   * @param systemPrompt 系统提示词
   */
  initializeConversation(systemPrompt: string): void {
    this.conversationHistory = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];
  }

  /**
   * 添加用户消息
   * 
   * @param message 用户消息内容
   */
  addUserMessage(message: string): void {
    this.conversationHistory.push({
      role: 'user',
      content: message,
    });
  }

  /**
   * 运行对话循环
   * 需求：16.2, 16.3, 16.4
   * 
   * 持续与 AI 模型交互，直到模拟终止或达到最大迭代次数
   * 
   * @param onIteration 每次迭代的回调函数
   * @returns 最终统计信息
   */
  async runConversationLoop(
    onIteration?: (iteration: number, message: string) => void
  ): Promise<void> {
    let iteration = 0;
    const maxIterations = this.config.maxIterations || 300;
    const isDebugMode = process.env.DEBUG === 'true';

    while (!this.simulator.shouldTerminate() && iteration < maxIterations) {
      iteration++;

      try {
        // 构建请求
        const requestBody = {
          model: this.config.modelName,
          messages: this.conversationHistory as any,
          tools: this.toolDefinitions,
          tool_choice: 'auto' as const,
          temperature: this.config.temperature,
        };

        // Debug: 输出请求详情
        if (isDebugMode) {
          console.log('\n=== AI Request ===');
          console.log('Model:', requestBody.model);
          console.log('Messages:', JSON.stringify(requestBody.messages, null, 2));
          console.log('Tools:', JSON.stringify(requestBody.tools, null, 2));
          console.log('==================\n');
        }

        // 调用 AI 模型
        const response = await this.client.chat.completions.create(requestBody);

        // Debug: 输出响应详情
        if (isDebugMode) {
          console.log('\n=== AI Response ===');
          console.log('Response:', JSON.stringify(response, null, 2));
          console.log('===================\n');
        }

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response from AI model');
        }

        const message = choice.message;

        // 添加助手消息到历史（包含 tool_calls 如果有的话）
        const assistantMessage: any = {
          role: 'assistant',
          content: message.content || '',
        };
        
        // 如果有工具调用，也要添加到历史中
        if (message.tool_calls && message.tool_calls.length > 0) {
          assistantMessage.tool_calls = message.tool_calls;
        }
        
        this.conversationHistory.push(assistantMessage);

        // 正常模式：记录格式化的对话信息
        if (!isDebugMode) {
          const logContent = this.formatConversation(iteration, message);
          this.conversationLogs.push({
            iteration,
            type: 'assistant',
            content: logContent,
            timestamp: Date.now(),
          });
        }

        // 检查是否有工具调用
        if (message.tool_calls && message.tool_calls.length > 0) {
          // 处理工具调用
          const toolResults = await this.handleToolCalls(message.tool_calls);

          // 将工具结果添加到对话历史
          for (const result of toolResults) {
            this.conversationHistory.push({
              role: 'tool',
              tool_call_id: result.toolCallId,
              name: result.toolName,
              content: JSON.stringify(result.result),
            });

            // 正常模式：记录工具调用结果
            if (!isDebugMode) {
              const logContent = this.formatToolResult(iteration, result);
              this.conversationLogs.push({
                iteration,
                type: 'tool',
                content: logContent,
                timestamp: Date.now(),
              });
            }
          }

          // 回调
          if (onIteration) {
            onIteration(
              iteration,
              `Executed ${message.tool_calls.length} tool call(s)`
            );
          }
        } else {
          // 没有工具调用，可能是模型在思考或结束
          if (onIteration) {
            onIteration(
              iteration,
              message.content || 'No response'
            );
          }

          // 如果模型没有工具调用且没有内容，可能需要提示
          if (!message.content || message.content.trim() === '') {
            this.addUserMessage(
              'Please continue by calling appropriate tools to complete the delivery tasks. If you are unsure what to do, you can call the "help" tool to see all available tools and game rules.'
            );
          }
        }

        // 在 Level 1 中，定期生成新订单
        if (!this.simulator.isLevel01Mode() && iteration % 5 === 0) {
          this.simulator.advanceSimulation();
        }

      } catch (error) {
        console.error('Error in conversation loop:', error);
        throw error;
      }
    }

    // 检查终止原因
    if (iteration >= maxIterations) {
      console.warn(`Reached maximum iterations (${maxIterations})`);
    }
  }

  /**
   * 格式化对话信息（正常模式）
   * 
   * @param iteration 对话轮次
   * @param message AI 响应消息
   * @returns 格式化的字符串
   */
  private formatConversation(
    iteration: number,
    message: OpenAI.Chat.Completions.ChatCompletionMessage
  ): string {
    let output = '';
    output += '\n' + '='.repeat(80) + '\n';
    output += `[对话轮次 #${iteration}] ASSISTANT\n`;
    output += '='.repeat(80) + '\n';

    // 打印 content
    if (message.content) {
      output += '\n【Content】\n';
      output += message.content + '\n';
    }

    // 打印 tool_calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      output += '\n【Tool Calls】\n';
      message.tool_calls.forEach((toolCall, index) => {
        output += `\n  [${index + 1}] ${toolCall.function.name}\n`;
        output += '  Arguments:\n';
        try {
          const args = JSON.parse(toolCall.function.arguments);
          output += JSON.stringify(args, null, 4).split('\n').map(line => '    ' + line).join('\n') + '\n';
        } catch {
          output += '    ' + toolCall.function.arguments + '\n';
        }
      });
    }

    output += '\n' + '='.repeat(80) + '\n';
    return output;
  }

  /**
   * 格式化工具调用结果（正常模式）
   * 
   * @param iteration 对话轮次
   * @param result 工具调用结果
   * @returns 格式化的字符串
   */
  private formatToolResult(
    iteration: number,
    result: { toolCallId: string; toolName: string; result: any }
  ): string {
    let output = '';
    output += '\n' + '-'.repeat(80) + '\n';
    output += `[对话轮次 #${iteration}] TOOL: ${result.toolName}\n`;
    output += '-'.repeat(80) + '\n';
    output += '\n【Result】\n';
    output += JSON.stringify(result.result, null, 2) + '\n';
    output += '\n' + '-'.repeat(80) + '\n';
    return output;
  }

  /**
   * 获取新的对话日志（自上次读取以来的新日志）
   * 
   * @returns 新的对话日志数组
   */
  getNewConversationLogs(): ConversationLogEntry[] {
    const newLogs = this.conversationLogs.slice(this.lastReadLogIndex);
    this.lastReadLogIndex = this.conversationLogs.length;
    return newLogs;
  }

  /**
   * 获取所有对话日志
   * 
   * @returns 所有对话日志数组
   */
  getAllConversationLogs(): ConversationLogEntry[] {
    return [...this.conversationLogs];
  }

  /**
   * 打印新的对话日志
   */
  printNewConversationLogs(): void {
    const newLogs = this.getNewConversationLogs();
    for (const log of newLogs) {
      console.log(log.content);
    }
  }

  /**
   * 处理工具调用
   * 需求：16.3, 16.4
   * 
   * @param toolCalls OpenAI 工具调用数组
   * @returns 工具调用结果数组
   */
  private async handleToolCalls(
    toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
  ): Promise<Array<{ toolCallId: string; toolName: string; result: any }>> {
    const results: Array<{ toolCallId: string; toolName: string; result: any }> = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolCallId = toolCall.id;

      try {
        // 解析参数
        const parameters = JSON.parse(toolCall.function.arguments);

        // 构建工具调用请求
        const request: ToolCallRequest = {
          toolName,
          parameters,
        };

        // 执行工具调用
        const response = await this.simulator.executeToolCall(request);

        // 记录结果
        results.push({
          toolCallId,
          toolName,
          result: response,
        });
      } catch (error) {
        // 处理解析或执行错误
        results.push({
          toolCallId,
          toolName,
          result: {
            success: false,
            error: {
              code: 'INVALID_PARAMETER',
              message: error instanceof Error ? error.message : 'Unknown error',
              details: { error: String(error) },
            },
          },
        });
      }
    }

    return results;
  }

  /**
   * 获取对话历史
   * 
   * @returns 对话历史数组
   */
  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * 获取配置
   * 
   * @returns 客户端配置
   */
  getConfig(): AIClientConfig {
    return { ...this.config };
  }

  /**
   * 获取模拟器实例
   * 
   * @returns 模拟器实例
   */
  getSimulator(): Simulator {
    return this.simulator;
  }
}

/**
 * 创建 AI 客户端实例
 * 
 * @param simulator 模拟器实例
 * @param config 客户端配置（可选）
 * @returns AI 客户端实例
 */
export function createAIClient(
  simulator: Simulator,
  config?: Partial<AIClientConfig>
): AIClient {
  return new AIClient(simulator, config);
}

// 导出 generateSystemPrompt 以保持向后兼容
export { generateSystemPrompt } from './system-prompt';
