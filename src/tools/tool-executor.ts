/**
 * 工具执行器
 * Silicon Rider Bench - Agent 基准测试系统
 * 
 * 需求：17.2, 17.3
 */

import { ToolCallRequest, ToolCallResponse } from '../types';
import { ToolRegistry } from './tool-registry';
import { ToolContext } from './query-tools';

/**
 * 工具执行器类
 * 负责分发工具调用、执行工具函数、处理错误
 */
export class ToolExecutor {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * 执行工具调用
   * 需求：17.2, 17.3
   * 
   * @param request 工具调用请求
   * @param context 工具执行上下文
   * @returns 工具调用响应
   */
  async execute(
    request: ToolCallRequest,
    context: ToolContext
  ): Promise<ToolCallResponse> {
    const { toolName, parameters } = request;

    try {
      // 验证工具名称
      if (!this.registry.hasTool(toolName)) {
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: `Unknown tool: ${toolName}`,
            details: { toolName },
          },
        };
      }

      // 验证参数
      const validationError = this.registry.validateParameters(toolName, parameters);
      if (validationError) {
        return validationError;
      }

      // 获取工具定义
      const tool = this.registry.getTool(toolName);
      if (!tool) {
        // 这不应该发生，因为我们已经检查过工具存在
        return {
          success: false,
          error: {
            code: 'INVALID_PARAMETER',
            message: `Tool not found: ${toolName}`,
            details: { toolName },
          },
        };
      }

      // 执行工具函数
      const result = await tool.handler(parameters, context);
      return result;
    } catch (error) {
      // 捕获执行过程中的任何错误
      return {
        success: false,
        error: {
          code: 'INVALID_PARAMETER',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: {
            toolName,
            parameters,
            error: error instanceof Error ? error.stack : String(error),
          },
        },
      };
    }
  }

  /**
   * 批量执行工具调用
   * 
   * @param requests 工具调用请求数组
   * @param context 工具执行上下文
   * @returns 工具调用响应数组
   */
  async executeAll(
    requests: ToolCallRequest[],
    context: ToolContext
  ): Promise<ToolCallResponse[]> {
    const results: ToolCallResponse[] = [];

    for (const request of requests) {
      const result = await this.execute(request, context);
      results.push(result);
    }

    return results;
  }

  /**
   * 获取工具注册表
   * @returns 工具注册表实例
   */
  getRegistry(): ToolRegistry {
    return this.registry;
  }
}

/**
 * 创建工具执行器实例
 * 
 * @param registry 工具注册表
 * @returns 工具执行器实例
 */
export function createToolExecutor(registry: ToolRegistry): ToolExecutor {
  return new ToolExecutor(registry);
}
