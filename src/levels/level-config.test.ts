/**
 * Level 配置系统测试
 */

import { describe, it, expect } from 'vitest';
import {
  getLevelConfig,
  validateLevelConfig,
  getAvailableLevels,
  isValidLevelName,
  createCustomLevelConfig,
  getLevelDescription,
  printLevelConfig,
  LEVEL_0_1_CONFIG,
  LEVEL_1_CONFIG,
} from './level-config';

describe('Level Config', () => {
  describe('getLevelConfig', () => {
    it('应该返回 Level 0.1 配置', () => {
      const config = getLevelConfig('level0.1');
      
      expect(config.duration).toBe(60);
      expect(config.mapSize).toBe('small');
      expect(config.seed).toBe(12345);
      expect(config.orderCount).toBe(1);
    });

    it('应该返回 Level 1 配置', () => {
      const config = getLevelConfig('level1');
      
      expect(config.duration).toBe(1440);
      expect(config.mapSize).toBe('large');
      expect(config.seed).toBe(67890);
      expect(config.baseOrderFrequency).toBe(5);
    });

    it('应该返回配置副本', () => {
      const config1 = getLevelConfig('level0.1');
      const config2 = getLevelConfig('level0.1');
      
      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('validateLevelConfig', () => {
    it('应该验证有效的配置', () => {
      const config = getLevelConfig('level0.1');
      const error = validateLevelConfig(config);
      
      expect(error).toBeNull();
    });

    it('应该拒绝无效的 duration', () => {
      const config = { ...getLevelConfig('level0.1'), duration: 0 };
      const error = validateLevelConfig(config);
      
      expect(error).toContain('Duration');
    });

    it('应该拒绝无效的 mapSize', () => {
      const config = { ...getLevelConfig('level0.1'), mapSize: 'invalid' as any };
      const error = validateLevelConfig(config);
      
      expect(error).toContain('Map size');
    });

    it('应该拒绝负数 seed', () => {
      const config = { ...getLevelConfig('level0.1'), seed: -1 };
      const error = validateLevelConfig(config);
      
      expect(error).toContain('Seed');
    });

    it('应该拒绝无效的 orderCount', () => {
      const config = { ...getLevelConfig('level0.1'), orderCount: 0 };
      const error = validateLevelConfig(config);
      
      expect(error).toContain('Order count');
    });

    it('应该拒绝无效的 baseOrderFrequency', () => {
      const config = { ...getLevelConfig('level1'), baseOrderFrequency: 0 };
      const error = validateLevelConfig(config);
      
      expect(error).toContain('Base order frequency');
    });
  });

  describe('getAvailableLevels', () => {
    it('应该返回所有可用的 Level', () => {
      const levels = getAvailableLevels();
      
      expect(levels).toContain('level0.1');
      expect(levels).toContain('level1');
      expect(levels.length).toBe(2);
    });
  });

  describe('isValidLevelName', () => {
    it('应该识别有效的 Level 名称', () => {
      expect(isValidLevelName('level0.1')).toBe(true);
      expect(isValidLevelName('level1')).toBe(true);
    });

    it('应该拒绝无效的 Level 名称', () => {
      expect(isValidLevelName('level2')).toBe(false);
      expect(isValidLevelName('invalid')).toBe(false);
    });
  });

  describe('createCustomLevelConfig', () => {
    it('应该创建自定义配置', () => {
      const config = createCustomLevelConfig({
        duration: 120,
        mapSize: 'small',
        seed: 999,
      });
      
      expect(config.duration).toBe(120);
      expect(config.mapSize).toBe('small');
      expect(config.seed).toBe(999);
    });

    it('应该使用默认值', () => {
      const config = createCustomLevelConfig({});
      
      expect(config.duration).toBe(1440);
      expect(config.mapSize).toBe('large');
      expect(typeof config.seed).toBe('number');
    });

    it('应该验证自定义配置', () => {
      expect(() => {
        createCustomLevelConfig({ duration: 0 });
      }).toThrow();
    });
  });

  describe('getLevelDescription', () => {
    it('应该返回 Level 0.1 描述', () => {
      const description = getLevelDescription('level0.1');
      
      expect(description).toContain('Level 0.1');
      expect(description).toContain('教程');
    });

    it('应该返回 Level 1 描述', () => {
      const description = getLevelDescription('level1');
      
      expect(description).toContain('Level 1');
      expect(description).toContain('基准测试');
    });
  });

  describe('printLevelConfig', () => {
    it('应该打印 Level 0.1 配置信息', () => {
      const info = printLevelConfig('level0.1');
      
      expect(info).toContain('Level 0.1');
      expect(info).toContain('60 分钟');
      expect(info).toContain('small');
      expect(info).toContain('12345');
      expect(info).toContain('订单数量: 1');
    });

    it('应该打印 Level 1 配置信息', () => {
      const info = printLevelConfig('level1');
      
      expect(info).toContain('Level 1');
      expect(info).toContain('1440 分钟');
      expect(info).toContain('large');
      expect(info).toContain('67890');
      expect(info).toContain('基准订单频率');
    });
  });

  describe('预定义配置常量', () => {
    it('LEVEL_0_1_CONFIG 应该匹配 getLevelConfig 结果', () => {
      const config = getLevelConfig('level0.1');
      
      expect(LEVEL_0_1_CONFIG).toEqual(config);
    });

    it('LEVEL_1_CONFIG 应该匹配 getLevelConfig 结果', () => {
      const config = getLevelConfig('level1');
      
      expect(LEVEL_1_CONFIG).toEqual(config);
    });
  });

  describe('Level 0.1 特性', () => {
    it('应该配置为教程场景', () => {
      const config = getLevelConfig('level0.1');
      
      // 短时长
      expect(config.duration).toBeLessThan(120);
      
      // 小地图
      expect(config.mapSize).toBe('small');
      
      // 单个订单
      expect(config.orderCount).toBe(1);
      
      // 固定种子
      expect(config.seed).toBe(12345);
    });
  });

  describe('Level 1 特性', () => {
    it('应该配置为完整基准测试', () => {
      const config = getLevelConfig('level1');
      
      // 24 小时
      expect(config.duration).toBe(1440);
      
      // 大地图
      expect(config.mapSize).toBe('large');
      
      // 持续生成订单
      expect(config.baseOrderFrequency).toBeDefined();
      expect(config.baseOrderFrequency).toBeGreaterThan(0);
      
      // 固定种子
      expect(config.seed).toBe(67890);
    });
  });
});
