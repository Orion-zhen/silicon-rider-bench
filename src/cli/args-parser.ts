/**
 * CLI 参数解析模块
 */

import { LevelName, isValidLevelName } from '../levels/level-config';
import type { AgentConfig } from '../types';

/**
 * 命令行参数接口
 */
export interface CLIArgs {
  level: LevelName;
  seed?: number;
  modelName?: string;
  baseURL?: string;
  noVisualization?: boolean;
  outputFile?: string;
  help?: boolean;
  mode: 'terminal' | 'web';
  host: string;
  port: number;
  agents?: AgentConfig[];  // 多代理配置（从环境变量 AGENTS 解析）
}

/**
 * 解析命令行参数
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): CLIArgs {
  const args = argv;
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
        } else if (levelValue === '2') {
          parsed.level = 'level2';
        } else if (levelValue === '3') {
          parsed.level = 'level3';
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

      case '--base-url':
      case '--baseurl':
        parsed.baseURL = args[++i];
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

      case '--mode':
        const modeValue = args[++i];
        if (modeValue === 'terminal' || modeValue === 'web') {
          parsed.mode = modeValue;
        } else {
          console.error(`Invalid mode: ${modeValue}. Must be 'terminal' or 'web'`);
          process.exit(1);
        }
        break;

      case '--host':
        parsed.host = args[++i];
        if (!parsed.host || parsed.host.trim() === '') {
          console.error('Invalid host value: host cannot be empty');
          process.exit(1);
        }
        // Basic validation for host format
        if (parsed.host.includes(' ')) {
          console.error('Invalid host value: host cannot contain spaces');
          process.exit(1);
        }
        break;

      case '--port':
        const portStr = args[++i];
        parsed.port = parseInt(portStr, 10);
        if (isNaN(parsed.port)) {
          console.error(`Invalid port value: '${portStr}' is not a valid number`);
          process.exit(1);
        }
        if (parsed.port < 1 || parsed.port > 65535) {
          console.error(`Invalid port value: ${parsed.port} is out of range. Must be between 1 and 65535`);
          process.exit(1);
        }
        // Warn about privileged ports
        if (parsed.port < 1024) {
          console.warn(`Warning: Port ${parsed.port} is a privileged port. You may need administrator/root privileges.`);
        }
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
  if (!parsed.mode) {
    parsed.mode = 'terminal';
  }
  if (!parsed.host) {
    parsed.host = 'localhost';
  }
  if (!parsed.port) {
    parsed.port = 3000;
  }

  // Parse AGENTS environment variable for multi-agent configuration
  const agentsEnv = process.env.AGENTS;
  if (agentsEnv) {
    try {
      const agentsConfig = JSON.parse(agentsEnv);
      if (Array.isArray(agentsConfig) && agentsConfig.length > 0) {
        parsed.agents = agentsConfig.map((agent: any, index: number) => {
          const modelName = agent.model || agent.modelName;
          if (!modelName) {
            throw new Error(`Agent at index ${index} is missing model/modelName`);
          }
          
          // Generate agent ID: extract model short name and append index
          const modelShortName = getModelShortName(modelName);
          const agentId = agent.id || `${modelShortName}-${index + 1}`;
          
          return {
            id: agentId,
            modelName: modelName,
            baseURL: agent.baseURL || agent.base_url,
            apiKey: agent.apiKey || agent.api_key,
          };
        });
        console.log(`[Args] Loaded ${parsed.agents.length} agent(s) from AGENTS environment variable`);
      }
    } catch (error) {
      console.error('[Args] Failed to parse AGENTS environment variable:', error);
      console.error('[Args] Expected format: AGENTS=\'[{"model":"openai/gpt-4"},{"model":"anthropic/claude-3"}]\'');
    }
  }

  return parsed as CLIArgs;
}

/**
 * Extract short name from full model name
 * e.g., "openai/gpt-4o" -> "gpt-4o"
 * e.g., "anthropic/claude-3-5-sonnet" -> "claude-3-5-sonnet"
 */
function getModelShortName(modelName: string): string {
  const parts = modelName.split('/');
  return parts[parts.length - 1];
}
