/**
 * 终端可视化模块测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalDisplay } from './terminal-display';
import { Simulator } from '../core/simulator';
import { LevelConfig } from '../types';

describe('TerminalDisplay', () => {
  let simulator: Simulator;
  let display: TerminalDisplay;

  beforeEach(() => {
    const config: LevelConfig = {
      duration: 60,
      mapSize: 'small',
      seed: 12345,
      orderCount: 1,
    };
    simulator = new Simulator(config);
    display = new TerminalDisplay(simulator);
  });

  describe('基本渲染', () => {
    it('应该渲染完整显示', () => {
      const output = display.render();
      
      expect(output).toBeTruthy();
      expect(output).toContain('Silicon Rider Bench');
      expect(output).toContain('Level 0.1');
      expect(output).toContain('Time:');
      expect(output).toContain('Battery:');
      expect(output).toContain('Profit:');
    });

    it('应该包含顶部和底部边框', () => {
      const output = display.render();
      
      expect(output).toContain('╔');
      expect(output).toContain('╚');
      expect(output).toContain('═');
    });

    it('应该显示图例', () => {
      const output = display.render();
      
      expect(output).toContain('🏠=Residential');
      expect(output).toContain('🏢=Office');
      expect(output).toContain('🍔=Restaurant');
      expect(output).toContain('🚴=Agent');
    });
  });

  describe('状态显示', () => {
    it('应该显示当前游戏时间', () => {
      const output = display.render();
      
      expect(output).toContain('Time: 00:00');
    });

    it('应该显示电量百分比', () => {
      const output = display.render();
      
      expect(output).toContain('Battery: 100%');
    });

    it('应该显示利润', () => {
      const output = display.render();
      
      expect(output).toContain('Profit: ¥0.00');
    });

    it('应该显示订单信息', () => {
      const output = display.render();
      
      expect(output).toContain('Orders: 0/5');
      expect(output).toContain('Completed: 0');
    });

    it('应该显示重量信息', () => {
      const output = display.render();
      
      expect(output).toContain('(0.0/10kg)');
    });
  });

  describe('地图渲染', () => {
    it('应该渲染地图区域', () => {
      const output = display.render();
      const lines = output.split('\n');
      
      // 应该有足够的行数（标题 + 状态 + 地图 + 图例）
      expect(lines.length).toBeGreaterThan(10);
    });

    it('应该在地图上显示节点', () => {
      const output = display.render();
      
      // 应该包含至少一些节点符号
      const hasNodes = 
        output.includes('🏠') ||
        output.includes('🏢') ||
        output.includes('🍔') ||
        output.includes('🛒') ||
        output.includes('💊') ||
        output.includes('🔋');
      
      expect(hasNodes).toBe(true);
    });

    it('应该显示智能体位置', () => {
      const output = display.render();
      
      expect(output).toContain('🚴');
    });
  });

  describe('简化渲染', () => {
    it('应该渲染简化版本', () => {
      const output = display.renderCompact();
      
      expect(output).toContain('Battery:');
      expect(output).toContain('Profit:');
      expect(output).toContain('Completed:');
    });

    it('简化版本应该更短', () => {
      const full = display.render();
      const compact = display.renderCompact();
      
      expect(compact.length).toBeLessThan(full.length);
    });
  });

  describe('订单详情', () => {
    it('应该渲染订单详情', () => {
      const output = display.renderOrderDetails();
      
      expect(output).toContain('携带订单');
      expect(output).toContain('可用订单');
    });

    it('初始状态应该显示无携带订单', () => {
      const output = display.renderOrderDetails();
      
      expect(output).toContain('携带订单');
      expect(output).toContain('无');
    });
  });

  describe('配置', () => {
    it('应该使用默认配置', () => {
      const config = display.getConfig();
      
      expect(config.mapWidth).toBe(60);
      expect(config.mapHeight).toBe(20);
      expect(config.showGrid).toBe(true);
      expect(config.updateInterval).toBe(100);
    });

    it('应该接受自定义配置', () => {
      const customDisplay = new TerminalDisplay(simulator, {
        mapWidth: 80,
        mapHeight: 30,
        updateInterval: 200,
      });
      
      const config = customDisplay.getConfig();
      expect(config.mapWidth).toBe(80);
      expect(config.mapHeight).toBe(30);
      expect(config.updateInterval).toBe(200);
    });

    it('应该允许更新更新间隔', () => {
      display.setUpdateInterval(500);
      
      const config = display.getConfig();
      expect(config.updateInterval).toBe(500);
    });
  });

  describe('Level 1 显示', () => {
    it('应该正确显示 Level 1', () => {
      const level1Config: LevelConfig = {
        duration: 1440,
        mapSize: 'large',
        seed: 67890,
        baseOrderFrequency: 5,
      };
      const level1Simulator = new Simulator(level1Config);
      const level1Display = new TerminalDisplay(level1Simulator);
      
      const output = level1Display.render();
      
      expect(output).toContain('Level 1');
    });
  });

  describe('状态更新', () => {
    it('应该反映智能体状态变化', async () => {
      // 执行一个工具调用来改变状态
      await simulator.executeToolCall({
        toolName: 'get_my_status',
        parameters: {},
      });
      
      const output = display.render();
      
      // 应该仍然能够渲染
      expect(output).toBeTruthy();
      expect(output).toContain('Silicon Rider Bench');
    });
  });
});
