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
import { getLevelConfig, printLevelConfig } from './levels/level-config';
import { createAIClient, generateSystemPrompt } from './client/ai-client';
import { TerminalDisplay } from './visualization/terminal-display';
import { ReportGenerator } from './scoring/report-generator';
import { formatStatusDisplay, formatHeader, formatSeparator } from './utils/cli-formatter';
import { parseArgs } from './cli/args-parser';
import { WebServer } from './web/web-server';
import { WebVisualization } from './web/web-visualization';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  --mode <mode>                 可视化模式（terminal 或 web，默认: terminal）
  --host <host>                 Web 服务器主机地址（默认: localhost）
  --port <port>                 Web 服务器端口号（默认: 3000）
  --no-viz                      禁用实时可视化
  --output, -o <file>           指定报告输出文件
  --help, -h                    显示此帮助信息

示例:
  npm run dev -- --level 1 --seed 12345
  npm run dev -- --level 0.1 --no-viz --output report.md

环境变量:
  API_KEY                       API 密钥（必需，支持 OpenRouter、OpenAI 等）
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

  console.log(formatHeader('Silicon Rider Bench - AI 外卖骑手基准测试'));

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

    // 初始化 Web 服务器（如果是 Web 模式）
    let webServer: WebServer | null = null;
    let webVisualization: WebVisualization | null = null;
    if (args.mode === 'web') {
      const staticDir = path.join(__dirname, 'web', 'public');
      webServer = new WebServer({
        host: args.host,
        port: args.port,
        staticDir,
      });

      try {
        await webServer.start();
        const url = `http://${args.host}:${args.port}`;
        console.log('✓ Web 服务器已启动');
        console.log(`  访问 URL: ${url}\n`);

        // 初始化 AI 客户端（需要先初始化以获取模型名称）
        console.log('正在初始化 AI 客户端...');
        const clientConfig = args.modelName ? { modelName: args.modelName } : undefined;
        const aiClient = createAIClient(simulator, clientConfig);
        const modelName = aiClient.getConfig().modelName;
        console.log('✓ AI 客户端初始化完成');
        console.log(`  模型: ${modelName}\n`);

        // 创建 Web 可视化适配器（传递模型名称）
        webVisualization = new WebVisualization(simulator, webServer, modelName);
        
        // 当新客户端连接时，发送初始化数据
        webServer.onConnection(() => {
          console.log('✓ 新客户端连接，发送初始化数据');
          webVisualization!.sendInitialData();
        });
        
        console.log('✓ Web 可视化模块已启用\n');
      } catch (error) {
        if (error instanceof Error) {
          if ('code' in error) {
            const nodeError = error as NodeJS.ErrnoException;
            switch (nodeError.code) {
              case 'EADDRINUSE':
                console.error(`❌ 错误: 端口 ${args.port} 已被占用`);
                console.error(`   请尝试使用其他端口: --port <端口号>`);
                console.error(`   例如: --port ${args.port + 1}\n`);
                break;
              case 'EACCES':
                console.error(`❌ 错误: 没有权限绑定到端口 ${args.port}`);
                console.error(`   端口 1-1023 需要管理员/root 权限`);
                console.error(`   请尝试使用更高的端口号 (>1024)\n`);
                break;
              case 'EADDRNOTAVAIL':
                console.error(`❌ 错误: 无法绑定到地址 ${args.host}`);
                console.error(`   请检查主机地址是否正确\n`);
                break;
              default:
                console.error('❌ Web 服务器启动失败:', error.message);
                console.error(`   错误代码: ${nodeError.code}\n`);
            }
          } else {
            console.error('❌ Web 服务器启动失败:', error.message);
          }
        } else {
          console.error('❌ Web 服务器启动失败:', error);
        }
        process.exit(1);
      }
    }

    // 初始化终端可视化（如果是终端模式且启用）
    let display: TerminalDisplay | null = null;
    if (args.mode === 'terminal' && !args.noVisualization) {
      display = new TerminalDisplay(simulator, {
        updateInterval: 500, // 每 500ms 更新一次
      });
      console.log('✓ 终端可视化模块已启用\n');
    }

    // 如果不是 Web 模式，初始化 AI 客户端
    let aiClient;
    if (args.mode !== 'web') {
      console.log('正在初始化 AI 客户端...');
      const clientConfig = args.modelName ? { modelName: args.modelName } : undefined;
      aiClient = createAIClient(simulator, clientConfig, webVisualization || undefined);
      console.log('✓ AI 客户端初始化完成');
      console.log(`  模型: ${aiClient.getConfig().modelName}\n`);
    } else {
      // Web 模式下，AI 客户端已经在上面初始化了
      // 现在需要传递 webVisualization
      const clientConfig = args.modelName ? { modelName: args.modelName } : undefined;
      aiClient = createAIClient(simulator, clientConfig, webVisualization || undefined);
    }

    // 生成系统提示词并初始化对话
    const systemPrompt = generateSystemPrompt(simulator);
    aiClient.initializeConversation(systemPrompt);

    // 设置 Web 可视化的最大迭代次数
    if (webVisualization) {
      webVisualization.setMaxIterations(aiClient.getConfig().maxIterations || 300);
    }

    // 记录开始时间
    const startTime = new Date();
    console.log(`开始时间: ${startTime.toLocaleString()}\n`);
    console.log('开始模拟...\n');

    // 设置模拟器状态
    simulator.setStatus('running');

    // 运行对话循环
    let lastDisplayUpdate = Date.now();
    const displayInterval = 1000; // 每秒更新一次显示

    await aiClient.runConversationLoop((iteration, message) => {
      // 更新 Web 可视化的当前迭代次数
      if (webVisualization) {
        webVisualization.updateIteration(iteration);
      }

      // 更新可视化
      const now = Date.now();
      
      // 终端模式：更新终端显示
      if (display && now - lastDisplayUpdate >= displayInterval) {
        display.display();
        
        // 在地图渲染后，打印新的对话日志
        aiClient.printNewConversationLogs();
        
        lastDisplayUpdate = now;
      }

      // Web 模式：发送状态更新到客户端
      if (webVisualization && now - lastDisplayUpdate >= displayInterval) {
        webVisualization.sendStateUpdate();
        lastDisplayUpdate = now;
      }

      // Web 模式：在终端输出关键事件
      if (args.mode === 'web') {
        // 打印对话日志（包含工具调用和结果）
        aiClient.printNewConversationLogs();
      }

      // 打印格式化的状态信息（如果禁用了可视化）
      if (!display && args.mode === 'terminal') {
        console.log(formatStatusDisplay(simulator, iteration, message));
        
        // 也打印对话日志
        aiClient.printNewConversationLogs();
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
    // const stats = simulator.getStats();
    
    // 获取评分计算器（从模拟器中）
    const scoreCalculator = simulator.getScoreCalculator();
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
    console.log('\n' + formatSeparator('═'));
    console.log(report);
    console.log(formatSeparator('═'));

    // 发送模拟结束消息到 Web 客户端
    if (webVisualization) {
      webVisualization.sendSimulationEnd(report);
    }

    // 保存报告到文件
    const outputFile = args.outputFile || `report-${args.level}-${Date.now()}.md`;
    const outputPath = path.resolve(outputFile);
    fs.writeFileSync(outputPath, report, 'utf-8');
    console.log(`\n✓ 报告已保存到: ${outputPath}\n`);

    // 关闭 Web 服务器（如果启用）
    if (webServer) {
      console.log('正在关闭 Web 服务器...');
      await webServer.stop();
      console.log('✓ Web 服务器已关闭\n');
    }

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
