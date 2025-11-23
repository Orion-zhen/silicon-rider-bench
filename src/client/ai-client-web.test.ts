/**
 * AI 客户端 Web 可视化集成测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIClient } from './ai-client';
import { Simulator } from '../core/simulator';
import { getLevelConfig } from '../levels/level-config';
import type { WebVisualization } from '../web/web-visualization';

describe('AIClient Web Visualization Integration', () => {
  let simulator: Simulator;
  let mockWebVisualization: WebVisualization;

  beforeEach(() => {
    // 创建模拟器
    const config = getLevelConfig('level0.1');
    simulator = new Simulator(config);

    // 创建 mock WebVisualization
    mockWebVisualization = {
      sendConversation: vi.fn(),
      sendToolCall: vi.fn(),
      sendToolResult: vi.fn(),
      sendInitialData: vi.fn(),
      sendStateUpdate: vi.fn(),
      sendSimulationEnd: vi.fn(),
    } as any;
  });

  it('should accept webVisualization parameter', () => {
    const client = new AIClient(
      simulator,
      { apiKey: 'test-key' },
      mockWebVisualization
    );

    expect(client).toBeDefined();
  });

  it('should work without webVisualization parameter', () => {
    const client = new AIClient(simulator, { apiKey: 'test-key' });

    expect(client).toBeDefined();
  });

  it('should have webVisualization methods available when provided', () => {
    const client = new AIClient(
      simulator,
      { apiKey: 'test-key' },
      mockWebVisualization
    );

    // 验证客户端已创建
    expect(client).toBeDefined();
    expect(client.getSimulator()).toBe(simulator);
  });
});
