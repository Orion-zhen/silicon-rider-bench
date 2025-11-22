/**
 * Silicon Rider Bench - 主程序入口
 * 
 * 任务 18.1: 实现 CLI 入口
 * - 创建 src/index.ts
 * - 实现命令行参数解析
 * - 实现 Level 选择逻辑
 * - 整合所有模块
 * - 启动模拟和可视化
 * - 生成最终报告
 */

import { Simulator } from './core/simulator';
import { getLevelConfig, LevelName, isValidLevelName, printLevelConfig } from './levels/level-config';
import { createAIClient, generateSystemPrompt } from './client/ai-client';
import { TerminalDisplay } from './visualization/terminal-display';
import { ScoreCalculator } from './scoring/score-calculator';
import { ReportGenerator } from './scoring/report-generator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 命令行参数接口
 */
interface CLIArgs {
  level: LevelName;
  seed?: number;
  modelName?: string;
  noVisualization?: boolean;
  outputFile?: string;
  help?: boolean;
}

/**
 * 解析命令行参数
 */
function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const parsed: Partial<CLIArgs> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--level':
      case '-l':
        const levelValue = args[++i];
        if (levelValue === '0.1') {
          parsed.level = 'level0.1';
        } else if (levelValue === '1') {
          parsed.level = 'level1';
        } else if (isValidLevelName(levelValue)) {
          parsed.level = levelValue as LevelName;
        } else {
          console.error(`Invalid level: ${levelValue}`);
          process.exit(1);
        }
        break;

      case '--seed':
      case '-s':
        parsed.seed = parseInt(args[++i], 10);
        if (isNaN(parsed.seed)) {
          console.error('Invalid seed value');
          process.exit(1);
        }
        break;

      case '--model':
      case '-m':
        parsed.modelName = args[++i];
        break;

      case '--no-viz':
        parsed.noVisualization = true;
        break;

      case '--output':
      case '-o':
        parsed.outputFile = args[++i];
        break;

      case '--help':
      case '-h':
        parsed.help = true;
        break;

      default:
        console.error(`Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  // 默认值
  if (!parsed.level) {
    parsed.level = 'level1';
  }

  return parsed as CLIArgs;
}

/**
 * 显示帮助信息
 */
function showHelp(): void {
  console.log(`
Silicon Rider Bench - AI 外卖骑手基准测试

用法:
  npm run level0.1              运行 Level 0.1（教程场景）
  npm run level1                运行 Level 1（完整基准测试）
  npm run dev -- [options]      使用自定义选项运行

选项:
  --level, -l <level>           指定 Level（0.1 或 1）
  --seed, -s <seed>             指定地图种子（覆盖默认值）
  --model, -m <model>           指定 AI 模型名称
  --no-viz                      禁用实时可视化
  --output, -o <file>           指定报告输出文件
  --help, -h                    显示此帮助信息

示例:
  npm run dev -- --level 1 --seed 12345
  npm run dev -- --level 0.1 --no-viz --output report.md

环境变量:
  OPENROUTER_API_KEY            OpenRouter API 密钥（必需）
  MODEL_NAME                    AI 模型名称（可选）
  BASE_URL                      API 基础 URL（可选）
  `.trim());
}

/**
 * 主函数
 */
async function main(): Promise<void> {
  // 解析命令行参数
  const args = parseArgs();

  // 显示帮助
  if (args.help) {
    showHelp();
    return;
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Silicon Rider Bench - AI 外卖骑手基准测试           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // 显示 Level 配置信息
  console.log(printLevelConfig(args.level));
  console.log('');

  try {
    // 获取 Level 配置
    let config = getLevelConfig(args.level);

    // 如果指定了自定义种子，覆盖配置
    if (args.seed !== undefined) {
      config = { ...config, seed: args.seed };
      console.log(`使用自定义种子: ${args.seed}\n`);
    }

    // 初始化模拟器
    console.log('正在初始化模拟器...');
    const simulator = new Simulator(config);
    console.log('✓ 模拟器初始化完成\n');

    // 初始化可视化（如果启用）
    let display: TerminalDisplay | null = null;
    if (!args.noVisualization) {
      display = new TerminalDisplay(simulator, {
        updateInterval: 500, // 每 500ms 更新一次
      });
      console.log('✓ 可视化模块已启用\n');
    }

    // 初始化 AI 客户端
    console.log('正在初始化 AI 客户端...');
    const clientConfig = args.modelName ? { modelName: args.modelName } : undefined;
    const aiClient = createAIClient(simulator, clientConfig);
    console.log('✓ AI 客户端初始化完成');
    console.log(`  模型: ${aiClient.getConfig().modelName}\n`);

    // 生成系统提示词并初始化对话
    const systemPrompt = generateSystemPrompt(simulator);
    aiClient.initializeConversation(systemPrompt);

    // 记录开始时间
    const startTime = new Date();
    console.log(`开始时间: ${startTime.toLocaleString()}\n`);
    console.log('开始模拟...\n');

    // 设置模拟器状态
    simulator.setStatus('running');

    // 运行对话循环
    let lastDisplayUpdate = Date.now();
    const displayInterval = 1000; // 每秒更新一次显示

    await aiClient.runConversationLoop((iteration) => {
      // 更新可视化
      const now = Date.now();
      if (display && now - lastDisplayUpdate >= displayInterval) {
        display.display();
        lastDisplayUpdate = now;
      }

      // 打印简短日志（如果禁用了可视化）
      if (!display && iteration % 10 === 0) {
        console.log(
          `[Iteration ${iteration}] ${simulator.getFormattedTime()} | ` +
          `Profit: ¥${simulator.getAgentState().getProfit().toFixed(2)} | ` +
          `Completed: ${simulator.getAgentState().getCompletedOrders()}`
        );
      }
    });

    // 模拟完成
    simulator.setStatus('completed');
    const endTime = new Date();

    // 最后一次更新显示
    if (display) {
      display.display();
    }

    console.log('\n模拟完成！\n');
    console.log(`结束时间: ${endTime.toLocaleString()}`);
    console.log(`实际耗时: ${((endTime.getTime() - startTime.getTime()) / 1000).toFixed(1)} 秒\n`);

    // 计算评分
    console.log('正在计算评分...');
    const stats = simulator.getStats();
    
    // 创建评分计算器并填充数据
    const scoreCalculator = new ScoreCalculator();
    
    // 从模拟器统计信息中填充评分计算器
    // 注意：这里简化处理，实际应该在模拟过程中记录详细信息
    for (let i = 0; i < stats.totalToolCalls; i++) {
      scoreCalculator.recordToolCall(i >= stats.invalidToolCalls);
    }
    scoreCalculator.recordDistance(stats.totalDistance);
    for (let i = 0; i < stats.batterySwaps; i++) {
      scoreCalculator.recordBatterySwap(0.5);
    }
    
    const metrics = scoreCalculator.calculateMetrics();

    // 生成报告
    console.log('正在生成报告...\n');
    const report = ReportGenerator.generateReport(
      {
        level: args.level === 'level0.1' ? '0.1' : '1',
        seed: config.seed,
        duration: config.duration,
        modelName: aiClient.getConfig().modelName,
        startTime: startTime.toLocaleString(),
        endTime: endTime.toLocaleString(),
      },
      metrics
    );

    // 输出报告
    console.log('═'.repeat(60));
    console.log(report);
    console.log('═'.repeat(60));

    // 保存报告到文件
    const outputFile = args.outputFile || `report-${args.level}-${Date.now()}.md`;
    const outputPath = path.resolve(outputFile);
    fs.writeFileSync(outputPath, report, 'utf-8');
    console.log(`\n✓ 报告已保存到: ${outputPath}\n`);

  } catch (error) {
    console.error('\n❌ 错误:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// 运行主函数
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
