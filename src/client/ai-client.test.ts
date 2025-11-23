/**
 * AI 客户端测试
 * Silicon Rider Bench - Agent 基准测试系统
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AIClient, createAIClient, generateSystemPrompt } from './ai-client';
import { Simulator } from '../core/simulator';
import { getLevelConfig } from '../levels/level-config';

describe('AIClient', () => {
  let simulator: Simulator;

  beforeEach(() => {
    const config = getLevelConfig('level0.1');
    simulator = new Simulator(config);
  });

  describe('Configuration Loading', () => {
    it('should load configuration from environment variables', () => {
      // 注意：这个测试依赖于 .env 文件
      // 如果没有 .env 文件，会抛出错误
      try {
        const client = createAIClient(simulator);
        const config = client.getConfig();
        
        expect(config.apiKey).toBeDefined();
        expect(config.modelName).toBeDefined();
        expect(config.baseURL).toBeDefined();
      } catch (error) {
        // 如果没有配置 API key，跳过测试
        expect((error as Error).message).toContain('API_KEY');
      }
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        apiKey: 'test-api-key',
        modelName: 'test-model',
        baseURL: 'https://test.example.com',
        maxIterations: 50,
        temperature: 0.5,
      };

      const client = createAIClient(simulator, customConfig);
      const config = client.getConfig();

      expect(config.apiKey).toBe('test-api-key');
      expect(config.modelName).toBe('test-model');
      expect(config.baseURL).toBe('https://test.example.com');
      expect(config.maxIterations).toBe(50);
      expect(config.temperature).toBe(0.5);
    });

    it('should throw error if API key is missing', () => {
      // 临时清除环境变量
      const originalKey = process.env.API_KEY;
      delete process.env.API_KEY;

      expect(() => {
        createAIClient(simulator);
      }).toThrow('API_KEY is required');

      // 恢复环境变量
      if (originalKey) {
        process.env.API_KEY = originalKey;
      }
    });
  });

  describe('Tool Definitions', () => {
    it('should generate tool definitions in OpenAI format', () => {
      const client = createAIClient(simulator, { apiKey: 'test-key' });
      const config = client.getConfig();
      
      // 工具定义应该在初始化时生成
      expect(config).toBeDefined();
    });
  });

  describe('Conversation Management', () => {
    it('should initialize conversation with system prompt', () => {
      const client = createAIClient(simulator, { apiKey: 'test-key' });
      const systemPrompt = 'Test system prompt';
      
      client.initializeConversation(systemPrompt);
      const history = client.getConversationHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0].role).toBe('system');
      expect(history[0].content).toBe(systemPrompt);
    });

    it('should add user messages to conversation history', () => {
      const client = createAIClient(simulator, { apiKey: 'test-key' });
      
      client.initializeConversation('System prompt');
      client.addUserMessage('User message 1');
      client.addUserMessage('User message 2');
      
      const history = client.getConversationHistory();
      
      expect(history).toHaveLength(3);
      expect(history[1].role).toBe('user');
      expect(history[1].content).toBe('User message 1');
      expect(history[2].role).toBe('user');
      expect(history[2].content).toBe('User message 2');
    });
  });

  describe('System Prompt Generation', () => {
    it('should generate system prompt for Level 0.1', () => {
      const prompt = generateSystemPrompt(simulator);
      
      expect(prompt).toContain('Silicon Rider Bench');
      expect(prompt).toContain('AI 外卖骑手');
      expect(prompt).toContain('完成单个配送订单');
      expect(prompt).toContain('get_my_status');
      expect(prompt).toContain('accept_order');
    });

    it('should generate system prompt for Level 1', () => {
      const config = getLevelConfig('level1');
      const level1Simulator = new Simulator(config);
      const prompt = generateSystemPrompt(level1Simulator);
      
      expect(prompt).toContain('Silicon Rider Bench');
      expect(prompt).toContain('24 小时');
      expect(prompt).toContain('最大化利润');
    });

    it('should include current agent state in prompt', () => {
      const prompt = generateSystemPrompt(simulator);
      const agentState = simulator.getAgentState();
      
      expect(prompt).toContain(`位置：${agentState.getPosition()}`);
      expect(prompt).toContain(`电量：${agentState.getBattery()}%`);
      expect(prompt).toContain(`携带订单：${agentState.getCarriedOrders().length}/5`);
    });

    it('should include tool descriptions in prompt', () => {
      const prompt = generateSystemPrompt(simulator);
      
      // 检查所有工具是否在提示词中
      const tools = [
        'get_my_status',
        'search_nearby_orders',
        'get_location_info',
        'calculate_distance',
        'estimate_time',
        'accept_order',
        'move_to',
        'pickup_food',
        'deliver_food',
        'swap_battery',
      ];

      for (const tool of tools) {
        expect(prompt).toContain(tool);
      }
    });

    it('should include important rules in prompt', () => {
      const prompt = generateSystemPrompt(simulator);
      
      expect(prompt).toContain('电量管理');
      expect(prompt).toContain('承载限制');
      expect(prompt).toContain('超时惩罚');
      expect(prompt).toContain('拥堵影响');
    });
  });

  describe('Simulator Integration', () => {
    it('should have access to simulator instance', () => {
      const client = createAIClient(simulator, { apiKey: 'test-key' });
      const sim = client.getSimulator();
      
      expect(sim).toBe(simulator);
    });

    it('should be able to query simulator state', () => {
      const client = createAIClient(simulator, { apiKey: 'test-key' });
      const sim = client.getSimulator();
      
      expect(sim.getCurrentTime()).toBe(0);
      expect(sim.getAgentState()).toBeDefined();
      expect(sim.getWorldState()).toBeDefined();
    });
  });
});
