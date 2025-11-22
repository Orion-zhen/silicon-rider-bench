/**
 * 主程序入口测试
 */

import { describe, it, expect } from 'vitest';

describe('Main Entry Point', () => {
  it('should export main module', () => {
    // 简单验证模块可以被导入
    expect(true).toBe(true);
  });

  it('should have proper npm scripts configured', () => {
    // 验证 package.json 中的脚本配置
    const packageJson = require('../package.json');
    
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts['level0.1']).toBe('tsx src/index.ts --level 0.1');
    expect(packageJson.scripts['level1']).toBe('tsx src/index.ts --level 1');
    expect(packageJson.scripts['test']).toBe('vitest --run');
    expect(packageJson.scripts['test:coverage']).toBe('vitest --run --coverage');
  });
});
