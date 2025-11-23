/**
 * Help 工具测试
 * 
 * 测试 help 工具是否正确返回帮助信息
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { helpTool } from './query-tools';
import { Simulator } from '../core/simulator';
import { LevelConfig } from '../types';

describe('Help Tool', () => {
  let simulator: Simulator;
  let context: any;

  beforeEach(() => {
    // 创建 Level 0.1 配置
    const config: LevelConfig = {
      duration: 60,
      mapSize: 'small',
      seed: 12345,
      orderCount: 1,
    };

    simulator = new Simulator(config);
    
    // 创建工具上下文
    context = {
      agentState: simulator.getAgentState(),
      orderGenerator: (simulator as any).orderGenerator,
      pathfinder: (simulator as any).pathfinder,
      congestionManager: (simulator as any).congestionManager,
      nodes: (simulator as any).nodes,
      currentTime: 0,
      simulator: simulator,
    };
  });

  describe('help 工具调用', () => {
    it('should return help information', async () => {
      const result = await helpTool.handler({}, context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.help).toBeDefined();
      expect(typeof result.data?.help).toBe('string');
    });

    it('should include tool descriptions in help text', async () => {
      const result = await helpTool.handler({}, context);

      const helpText = result.data?.help || '';
      
      // 检查是否包含工具说明
      expect(helpText).toContain('get_my_status');
      expect(helpText).toContain('search_nearby_orders');
      expect(helpText).toContain('accept_order');
      expect(helpText).toContain('move_to');
      expect(helpText).toContain('pickup_food');
      expect(helpText).toContain('deliver_food');
      expect(helpText).toContain('swap_battery');
      expect(helpText).toContain('help');
    });

    it('should include game rules in help text', async () => {
      const result = await helpTool.handler({}, context);

      const helpText = result.data?.help || '';
      
      // 检查是否包含游戏规则
      expect(helpText).toContain('电量管理');
      expect(helpText).toContain('承载限制');
      expect(helpText).toContain('订单类型');
      expect(helpText).toContain('超时惩罚');
      expect(helpText).toContain('拥堵影响');
    });

    it('should include current status in help text', async () => {
      const result = await helpTool.handler({}, context);

      const helpText = result.data?.help || '';
      
      // 检查是否包含当前状态
      expect(helpText).toContain('当前状态');
      expect(helpText).toContain('位置');
      expect(helpText).toContain('电量');
      expect(helpText).toContain('携带订单');
      expect(helpText).toContain('当前利润');
    });

    it('should include strategy suggestions in help text', async () => {
      const result = await helpTool.handler({}, context);

      const helpText = result.data?.help || '';
      
      // 检查是否包含策略建议
      expect(helpText).toContain('策略建议');
      expect(helpText).toContain('合理规划');
      expect(helpText).toContain('注意评估电量');
      expect(helpText).toContain('考虑订单时限');
    });

    it('should return error if simulator is not available', async () => {
      const contextWithoutSimulator = {
        ...context,
        simulator: undefined,
      };

      const result = await helpTool.handler({}, contextWithoutSimulator);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('INVALID_PARAMETER');
    });

    it('should reflect Level 0.1 mode in help text', async () => {
      const result = await helpTool.handler({}, context);

      const helpText = result.data?.help || '';
      
      // Level 0.1 应该包含教程提示
      expect(helpText).toContain('完成单个配送订单');
    });

    it('should reflect Level 1 mode in help text', async () => {
      // 创建 Level 1 配置
      const level1Config: LevelConfig = {
        duration: 1440,
        mapSize: 'large',
        seed: 67890,
        baseOrderFrequency: 5,
      };

      const level1Simulator = new Simulator(level1Config);
      
      const level1Context = {
        ...context,
        simulator: level1Simulator,
      };

      const result = await helpTool.handler({}, level1Context);

      const helpText = result.data?.help || '';
      
      // Level 1 应该包含 24 小时提示
      expect(helpText).toContain('24 小时');
      expect(helpText).toContain('最大化利润');
    });
  });

  describe('help 工具定义', () => {
    it('should have correct tool name', () => {
      expect(helpTool.name).toBe('help');
    });

    it('should have description', () => {
      expect(helpTool.description).toBeDefined();
      expect(helpTool.description.length).toBeGreaterThan(0);
    });

    it('should have no required parameters', () => {
      expect(helpTool.parameters).toBeDefined();
      expect(Object.keys(helpTool.parameters).length).toBe(0);
    });
  });
});
