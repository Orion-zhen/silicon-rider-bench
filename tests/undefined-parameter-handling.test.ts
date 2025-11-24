/**
 * 测试处理 AI 传输的 "undefined" 字符串参数
 * 
 * 当 AI 调用不需要参数的工具时，有时会传输字符串 "undefined"
 * 我们应该优雅地处理这种情况，将其视为空对象 {}
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Simulator } from '../src/core/simulator';
import { AIClient } from '../src/client/ai-client';
import { getLevelConfig } from '../src/levels/level-config';

describe('Undefined Parameter Handling', () => {
  let simulator: Simulator;
  let aiClient: AIClient;

  beforeEach(() => {
    const config = getLevelConfig('level0.1');
    simulator = new Simulator(config);
    aiClient = new AIClient(simulator);
  });

  it('should handle "undefined" string as empty object for swap_battery', async () => {
    // 模拟 AI 传输 "undefined" 字符串
    const toolCall = {
      id: 'test-call-1',
      type: 'function' as const,
      function: {
        name: 'swap_battery',
        arguments: 'undefined', // AI 传输的字符串
      },
    };

    // 使用私有方法测试（通过类型断言）
    const result = await (aiClient as any).handleToolCalls([toolCall]);

    // 应该成功处理，而不是报错
    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('swap_battery');
    
    // 由于不在换电站，会返回错误，但不应该是 JSON 解析错误
    expect(result[0].result.success).toBe(false);
    if (!result[0].result.success) {
      expect(result[0].result.error.code).toBe('NOT_AT_SWAP_STATION');
      expect(result[0].result.error.message).not.toContain('JSON');
      expect(result[0].result.error.message).not.toContain('undefined');
    }
  });

  it('should handle empty string as empty object', async () => {
    const toolCall = {
      id: 'test-call-2',
      type: 'function' as const,
      function: {
        name: 'get_my_status',
        arguments: '', // 空字符串
      },
    };

    const result = await (aiClient as any).handleToolCalls([toolCall]);

    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('get_my_status');
    expect(result[0].result.success).toBe(true);
  });

  it('should handle "null" string as empty object', async () => {
    const toolCall = {
      id: 'test-call-3',
      type: 'function' as const,
      function: {
        name: 'help',
        arguments: 'null', // "null" 字符串
      },
    };

    const result = await (aiClient as any).handleToolCalls([toolCall]);

    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('help');
    expect(result[0].result.success).toBe(true);
  });

  it('should handle whitespace-only string as empty object', async () => {
    const toolCall = {
      id: 'test-call-4',
      type: 'function' as const,
      function: {
        name: 'get_my_status',
        arguments: '   ', // 只有空格
      },
    };

    const result = await (aiClient as any).handleToolCalls([toolCall]);

    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('get_my_status');
    expect(result[0].result.success).toBe(true);
  });

  it('should still parse valid JSON normally', async () => {
    const toolCall = {
      id: 'test-call-5',
      type: 'function' as const,
      function: {
        name: 'search_nearby_orders',
        arguments: '{"radius": 5}', // 正常的 JSON
      },
    };

    const result = await (aiClient as any).handleToolCalls([toolCall]);

    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('search_nearby_orders');
    expect(result[0].result.success).toBe(true);
  });

  it('should still report error for invalid JSON', async () => {
    const toolCall = {
      id: 'test-call-6',
      type: 'function' as const,
      function: {
        name: 'search_nearby_orders',
        arguments: '{invalid json}', // 无效的 JSON
      },
    };

    const result = await (aiClient as any).handleToolCalls([toolCall]);

    expect(result).toHaveLength(1);
    expect(result[0].toolName).toBe('search_nearby_orders');
    expect(result[0].result.success).toBe(false);
    if (!result[0].result.success) {
      expect(result[0].result.error.message).toContain('JSON');
    }
  });
});
