/**
 * 工具模块导出
 * Silicon Rider Bench - Agent 基准测试系统
 */

export * from './tool-registry';
export * from './query-tools';
export * from './action-tools';
export * from './tool-executor';

import { ToolRegistry } from './tool-registry';
import { getQueryTools } from './query-tools';
import { getActionTools } from './action-tools';

/**
 * 创建并初始化工具注册表
 * 注册所有可用工具
 * 
 * @returns 已注册所有工具的注册表实例
 */
export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  
  // 注册查询工具
  registry.registerAll(getQueryTools());
  
  // 注册行动工具
  registry.registerAll(getActionTools());
  
  return registry;
}
