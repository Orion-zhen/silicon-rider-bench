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
    const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY is required. Please set it in .env file.');
    }

    return {
      apiKey,
      modelName: config?.modelName || process.env.MODEL_NAME || 'anthropic/claude-3.5-sonnet',
      baseURL: config?.baseURL || process.env.BASE_URL || 'https://openrouter.ai/api/v1',
      siteURL: config?.siteURL || process.env.SITE_URL,
      appName: config?.appName || process.env.APP_NAME || 'Silicon Rider Bench',
      maxIterations: config?.maxIterations || 100,
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
    const maxIterations = this.config.maxIterations || 100;

    while (!this.simulator.shouldTerminate() && iteration < maxIterations) {
      iteration++;

      try {
        // 调用 AI 模型
        const response = await this.client.chat.completions.create({
          model: this.config.modelName,
          messages: this.conversationHistory as any,
          tools: this.toolDefinitions,
          tool_choice: 'auto',
          temperature: this.config.temperature,
        });

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response from AI model');
        }

        const message = choice.message;

        // 添加助手消息到历史
        this.conversationHistory.push({
          role: 'assistant',
          content: message.content || '',
        });

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
              'Please continue by calling appropriate tools to complete the delivery tasks.'
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

/**
 * 生成系统提示词
 * 
 * @param simulator 模拟器实例
 * @returns 系统提示词
 */
export function generateSystemPrompt(simulator: Simulator): string {
  const isLevel01 = simulator.isLevel01Mode();
  const agentState = simulator.getAgentState();

  const prompt = `
# Silicon Rider Bench - AI 外卖骑手模拟

你是一个 AI 外卖骑手，在虚拟城市中配送订单以赚取利润。

## 目标
${isLevel01 
  ? '完成单个配送订单，验证基本功能。' 
  : `在 24 小时内最大化利润。当前时间：${simulator.getFormattedTime()}`
}

## 当前状态
- 位置：${agentState.getPosition()}
- 电量：${agentState.getBattery()}%（续航 ${agentState.getBatteryRange().toFixed(1)} km）
- 携带订单：${agentState.getCarriedOrders().length}/5
- 总重量：${agentState.getTotalWeight().toFixed(1)}/10 kg
- 当前利润：¥${agentState.getProfit().toFixed(2)}

## 可用工具
你可以调用以下工具来完成配送任务：

### 信息查询类
- **get_my_status()**: 查询当前状态（位置、电量、订单、利润等）
- **search_nearby_orders(radius)**: 搜索指定半径内的可用订单
- **get_location_info(locationId)**: 获取位置详细信息
- **calculate_distance(fromId, toId)**: 计算两点间最短距离
- **estimate_time(locationIds)**: 估算路径通行时间（考虑拥堵）

### 行动类
- **accept_order(orderId)**: 接受订单（最多 5 单，总重量不超过 10kg）
- **move_to(targetLocationId)**: 移动到目标位置
- **pickup_food(orderId)**: 在取餐点取餐（耗时 2 分钟）
- **deliver_food(orderId)**: 在送餐点送餐（耗时 1 分钟）
- **swap_battery()**: 在换电站换电（耗时 1 分钟，花费 0.5 元）

## 重要规则
1. **电量管理**：满电续航 50km，每公里消耗 2% 电量。电量耗尽后只能推行（10km/h）
2. **承载限制**：最多携带 5 单，总重量不超过 10kg
3. **订单类型**：
   - 餐饮订单：0.5-1kg，配送费较低
   - 超市订单：5-10kg，配送费较高
   - 药店订单：0.05-0.2kg，配送费最高
4. **超时惩罚**：
   - 0-5 分钟：无惩罚
   - 5-10 分钟：扣除 30% 配送费
   - 10-15 分钟：扣除 50% 配送费
   - 15 分钟以上：扣除 70% 配送费
5. **拥堵影响**：道路拥堵会降低速度（30/25/20/15 km/h）
6. **订单潮汐**：不同时段不同类型订单频率不同

## 策略建议
- 优先接受高配送费、低重量、近距离的订单
- 合理规划路线，减少空驶
- 注意电量，及时换电
- 考虑订单时限，避免超时
- 在订单密集时段多接单

## 开始任务
${isLevel01
  ? '请依次调用工具完成配送：search_nearby_orders → accept_order → move_to → pickup_food → move_to → deliver_food'
  : '请开始配送任务，通过调用工具来最大化利润。'
}
`.trim();

  return prompt;
}
