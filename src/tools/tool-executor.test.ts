/**
 * 工具执行器单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolExecutor, createToolExecutor } from './tool-executor';
import { ToolRegistry, ToolDefinition } from './tool-registry';
import { createToolRegistry } from './index';
import { AgentState } from '../core/agent-state';
import { OrderGenerator } from '../core/order-generator';
import { Pathfinder } from '../world/pathfinder';
import { CongestionManager } from '../world/congestion-manager';
import { generateMap } from '../world/map-generator';
import { ToolContext } from './query-tools';

describe('ToolExecutor', () => {
  let executor: ToolExecutor;
  let context: ToolContext;

  beforeEach(() => {
    // 创建测试地图和上下文
    const map = generateMap({ seed: 12345, size: 'small' });

    const agentState = new AgentState(Array.from(map.nodes.keys())[0]);
    const orderGenerator = new OrderGenerator(12345);
    const pathfinder = new Pathfinder(map.nodes, map.edges);
    const congestionManager = new CongestionManager(map.edges, map.nodes);

    context = {
      agentState,
      orderGenerator,
      pathfinder,
      congestionManager,
      nodes: map.nodes,
      currentTime: 0,
    };

    // 创建工具注册表和执行器
    const registry = createToolRegistry();
    executor = createToolExecutor(registry);
  });

  describe('execute', () => {
    it('should execute valid tool call', async () => {
      const result = await executor.execute(
        {
          toolName: 'get_my_status',
          parameters: {},
        },
        context
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveProperty('position');
        expect(result.data).toHaveProperty('battery');
      }
    });

    it('should reject unknown tool', async () => {
      const result = await executor.execute(
        {
          toolName: 'unknown_tool',
          parameters: {},
        },
        context
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_PARAMETER');
        expect(result.error.message).toContain('Unknown tool');
      }
    });

    it('should reject invalid parameters', async () => {
      const result = await executor.execute(
        {
          toolName: 'search_nearby_orders',
          parameters: {}, // missing required 'radius' parameter
        },
        context
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_PARAMETER');
      }
    });

    it('should handle tool execution errors', async () => {
      const result = await executor.execute(
        {
          toolName: 'get_location_info',
          parameters: { locationId: 'invalid' },
        },
        context
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_LOCATION');
      }
    });
  });

  describe('executeAll', () => {
    it('should execute multiple tool calls', async () => {
      const results = await executor.executeAll(
        [
          { toolName: 'get_my_status', parameters: {} },
          { toolName: 'search_nearby_orders', parameters: { radius: 10 } },
        ],
        context
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it('should handle mixed success and failure', async () => {
      const results = await executor.executeAll(
        [
          { toolName: 'get_my_status', parameters: {} },
          { toolName: 'unknown_tool', parameters: {} },
        ],
        context
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('custom tool registration', () => {
    it('should work with custom tools', async () => {
      const registry = new ToolRegistry();
      const customTool: ToolDefinition = {
        name: 'custom_tool',
        description: 'A custom test tool',
        parameters: {
          value: {
            type: 'number',
            required: true,
          },
        },
        handler: async (params) => ({
          success: true,
          data: { result: params.value * 2 },
        }),
      };

      registry.register(customTool);
      const customExecutor = createToolExecutor(registry);

      const result = await customExecutor.execute(
        {
          toolName: 'custom_tool',
          parameters: { value: 5 },
        },
        context
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.result).toBe(10);
      }
    });
  });
});
