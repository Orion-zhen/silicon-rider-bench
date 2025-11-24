/**
 * 错误消息示例
 * 展示改进后的错误提示效果
 */

import { Simulator } from '../src/core/simulator';
import { getLevelConfig } from '../src/levels/level-config';

async function main() {
  const config = getLevelConfig('level0.1');
  const simulator = new Simulator(config);

  console.log('='.repeat(80));
  console.log('错误消息改进示例');
  console.log('='.repeat(80));
  console.log();

  // 示例 1: 缺少必需参数
  console.log('示例 1: 缺少必需参数 (search_nearby_orders)');
  console.log('-'.repeat(80));
  const result1 = await simulator.executeToolCall({
    toolName: 'search_nearby_orders',
    parameters: {}, // 缺少 radius 参数
  });
  console.log('错误响应:');
  console.log(JSON.stringify(result1, null, 2));
  console.log();

  // 示例 2: 参数类型错误
  console.log('示例 2: 参数类型错误 (estimate_time)');
  console.log('-'.repeat(80));
  const result2 = await simulator.executeToolCall({
    toolName: 'estimate_time',
    parameters: {
      locationIds: 'not-an-array', // 应该是数组
    },
  });
  console.log('错误响应:');
  console.log(JSON.stringify(result2, null, 2));
  console.log();

  // 示例 3: 缺少多个参数
  console.log('示例 3: 缺少多个参数 (calculate_distance)');
  console.log('-'.repeat(80));
  const result3 = await simulator.executeToolCall({
    toolName: 'calculate_distance',
    parameters: {
      fromId: 'R1', // 缺少 toId
    },
  });
  console.log('错误响应:');
  console.log(JSON.stringify(result3, null, 2));
  console.log();

  // 示例 4: 参数为 undefined
  console.log('示例 4: 参数为 undefined (move_to)');
  console.log('-'.repeat(80));
  const result4 = await simulator.executeToolCall({
    toolName: 'move_to',
    parameters: undefined as any,
  });
  console.log('错误响应:');
  console.log(JSON.stringify(result4, null, 2));
  console.log();

  // 示例 5: 正确的调用
  console.log('示例 5: 正确的调用 (get_my_status)');
  console.log('-'.repeat(80));
  const result5 = await simulator.executeToolCall({
    toolName: 'get_my_status',
    parameters: {},
  });
  console.log('成功响应:');
  console.log(JSON.stringify(result5, null, 2));
  console.log();

  console.log('='.repeat(80));
  console.log('示例结束');
  console.log('='.repeat(80));
}

main().catch(console.error);
