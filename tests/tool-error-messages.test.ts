/**
 * 工具错误消息测试
 * 验证当工具调用参数错误时，错误消息包含正确的用法说明
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Simulator } from '../src/core/simulator';
import { getLevelConfig } from '../src/levels/level-config';

describe('Tool Error Messages', () => {
  let simulator: Simulator;

  beforeEach(() => {
    const config = getLevelConfig('level0.1');
    simulator = new Simulator(config);
  });

  it('should include usage hint when JSON parsing fails', async () => {
    // 模拟一个参数为 undefined 的工具调用
    const result = await simulator.executeToolCall({
      toolName: 'search_nearby_orders',
      parameters: undefined as any,
    });

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      // 错误消息应该包含用法说明
      expect(result.error.message).toContain('Usage');
      expect(result.error.message).toContain('search_nearby_orders');
      expect(result.error.message).toContain('radius');
    }
  });

  it('should include usage hint for accept_order with missing parameters', async () => {
    const result = await simulator.executeToolCall({
      toolName: 'accept_order',
      parameters: {},
    });

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      // 应该提示缺少 orderId 参数
      expect(result.error.message).toContain('orderId');
    }
  });

  it('should include usage hint for move_to with missing parameters', async () => {
    const result = await simulator.executeToolCall({
      toolName: 'move_to',
      parameters: {},
    });

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      // 应该提示缺少 targetLocationId 参数
      expect(result.error.message).toContain('targetLocationId');
    }
  });

  it('should include usage hint for calculate_distance with missing parameters', async () => {
    const result = await simulator.executeToolCall({
      toolName: 'calculate_distance',
      parameters: { fromId: 'R1' }, // 缺少 toId
    });

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      // 应该提示缺少 toId 参数
      expect(result.error.message).toContain('toId');
    }
  });

  it('should include usage hint for estimate_time with invalid parameters', async () => {
    const result = await simulator.executeToolCall({
      toolName: 'estimate_time',
      parameters: { locationIds: 'not-an-array' }, // 应该是数组
    });

    expect(result.success).toBe(false);
    if (!result.success && result.error) {
      // 应该提示参数类型错误
      expect(result.error.message).toContain('locationIds');
    }
  });

  it('should work correctly with valid parameters', async () => {
    // 测试正确的参数调用
    const result = await simulator.executeToolCall({
      toolName: 'get_my_status',
      parameters: {},
    });

    expect(result.success).toBe(true);
  });
});
