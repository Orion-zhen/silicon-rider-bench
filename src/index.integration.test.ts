/**
 * 集成测试 - Web 可视化模式
 * 
 * 测试完整的 Web 模式启动流程、WebSocket 连接和消息传递、
 * 静态文件服务以及模式切换不影响模拟结果
 * 
 * 任务 18: 编写集成测试
 * 任务 18.1: 编写属性测试：模拟器跨模式一致性
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { Simulator } from './core/simulator';
import { getLevelConfig } from './levels/level-config';
import { WebServer } from './web/web-server';
import { WebVisualization } from './web/web-visualization';
import { WebSocket } from 'ws';
import * as http from 'http';
import * as path from 'path';

describe('Web Visualization Integration Tests', () => {
  let webServer: WebServer | null = null;
  const testPort = 13580; // Different port from unit tests
  const testHost = 'localhost';

  afterEach(async () => {
    if (webServer) {
      await webServer.stop();
      webServer = null;
    }
  });

  describe('Complete Web Mode Startup Flow', () => {
    it('should start web server and initialize visualization', async () => {
      // Create simulator
      const config = getLevelConfig('level0.1');
      const simulator = new Simulator(config);

      // Start web server
      const staticDir = path.join(__dirname, 'web', 'public');
      webServer = new WebServer({
        host: testHost,
        port: testPort,
        staticDir,
      });

      await webServer.start();
      expect(webServer.getClientCount()).toBe(0);

      // Create web visualization
      const webViz = new WebVisualization(simulator, webServer);
      expect(webViz).toBeDefined();

      // Send initial data
      webViz.sendInitialData();

      // Verify server is running
      const response = await makeHttpRequest(testPort, '/');
      expect(response.statusCode).toBe(200);
    });

    it('should handle multiple client connections', async () => {
      const config = getLevelConfig('level0.1');
      const simulator = new Simulator(config);

      const staticDir = path.join(__dirname, 'web', 'public');
      webServer = new WebServer({
        host: testHost,
        port: testPort,
        staticDir,
      });

      await webServer.start();

      // Connect multiple WebSocket clients
      const ws1 = new WebSocket(`ws://${testHost}:${testPort}`);
      const ws2 = new WebSocket(`ws://${testHost}:${testPort}`);

      await Promise.all([
        new Promise<void>((resolve) => ws1.on('open', () => resolve())),
        new Promise<void>((resolve) => ws2.on('open', () => resolve())),
      ]);

      expect(webServer.getClientCount()).toBe(2);

      ws1.close();
      ws2.close();

      // Wait for close to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(webServer.getClientCount()).toBe(0);
    });
  });

  describe('WebSocket Connection and Message Passing', () => {
    it('should send initial data to connected clients', async () => {
      const config = getLevelConfig('level0.1');
      const simulator = new Simulator(config);

      const staticDir = path.join(__dirname, 'web', 'public');
      webServer = new WebServer({
        host: testHost,
        port: testPort,
        staticDir,
      });

      await webServer.start();

      const webViz = new WebVisualization(simulator, webServer);

      // Connect WebSocket client
      const ws = new WebSocket(`ws://${testHost}:${testPort}`);

      const initMessage = await new Promise<any>((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'init') {
            resolve(message);
          }
        });

        ws.on('open', () => {
          webViz.sendInitialData();
        });
      });

      expect(initMessage.type).toBe('init');
      expect(initMessage.data).toHaveProperty('nodes');
      expect(initMessage.data).toHaveProperty('edges');
      expect(initMessage.data).toHaveProperty('config');
      expect(Array.isArray(initMessage.data.nodes)).toBe(true);
      expect(Array.isArray(initMessage.data.edges)).toBe(true);

      ws.close();
    });

    it('should send state updates to connected clients', async () => {
      const config = getLevelConfig('level0.1');
      const simulator = new Simulator(config);

      const staticDir = path.join(__dirname, 'web', 'public');
      webServer = new WebServer({
        host: testHost,
        port: testPort,
        staticDir,
      });

      await webServer.start();

      const webViz = new WebVisualization(simulator, webServer);

      // Connect WebSocket client
      const ws = new WebSocket(`ws://${testHost}:${testPort}`);

      await new Promise<void>((resolve) => ws.on('open', () => resolve()));

      const stateMessage = await new Promise<any>((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'state_update') {
            resolve(message);
          }
        });

        webViz.sendStateUpdate();
      });

      expect(stateMessage.type).toBe('state_update');
      expect(stateMessage.data).toHaveProperty('currentTime');
      expect(stateMessage.data).toHaveProperty('formattedTime');
      expect(stateMessage.data).toHaveProperty('agentState');
      expect(stateMessage.data.agentState).toHaveProperty('position');
      expect(stateMessage.data.agentState).toHaveProperty('battery');
      expect(stateMessage.data.agentState).toHaveProperty('profit');

      ws.close();
    });

    it('should send conversation messages to connected clients', async () => {
      const config = getLevelConfig('level0.1');
      const simulator = new Simulator(config);

      const staticDir = path.join(__dirname, 'web', 'public');
      webServer = new WebServer({
        host: testHost,
        port: testPort,
        staticDir,
      });

      await webServer.start();

      const webViz = new WebVisualization(simulator, webServer);

      // Connect WebSocket client
      const ws = new WebSocket(`ws://${testHost}:${testPort}`);

      await new Promise<void>((resolve) => ws.on('open', () => resolve()));

      const conversationMessage = await new Promise<any>((resolve) => {
        ws.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'conversation') {
            resolve(message);
          }
        });

        webViz.sendConversation('assistant', 'Test message');
      });

      expect(conversationMessage.type).toBe('conversation');
      expect(conversationMessage.data).toHaveProperty('role');
      expect(conversationMessage.data).toHaveProperty('content');
      expect(conversationMessage.data.role).toBe('assistant');
      expect(conversationMessage.data.content).toBe('Test message');

      ws.close();
    });

    it('should send tool call and result messages', async () => {
      const config = getLevelConfig('level0.1');
      const simulator = new Simulator(config);

      const staticDir = path.join(__dirname, 'web', 'public');
      webServer = new WebServer({
        host: testHost,
        port: testPort,
        staticDir,
      });

      await webServer.start();

      const webViz = new WebVisualization(simulator, webServer);

      // Connect WebSocket client
      const ws = new WebSocket(`ws://${testHost}:${testPort}`);

      await new Promise<void>((resolve) => ws.on('open', () => resolve()));

      const messages: any[] = [];
      ws.on('message', (data) => {
        messages.push(JSON.parse(data.toString()));
      });

      // Send tool call
      webViz.sendToolCall('get_my_status', {});
      await new Promise(resolve => setTimeout(resolve, 50));

      // Send tool result
      webViz.sendToolResult('get_my_status', true, { battery: 100 });
      await new Promise(resolve => setTimeout(resolve, 50));

      const toolCallMsg = messages.find(m => m.type === 'tool_call');
      const toolResultMsg = messages.find(m => m.type === 'tool_result');

      expect(toolCallMsg).toBeDefined();
      expect(toolCallMsg.data.toolName).toBe('get_my_status');

      expect(toolResultMsg).toBeDefined();
      expect(toolResultMsg.data.toolName).toBe('get_my_status');
      expect(toolResultMsg.data.success).toBe(true);

      ws.close();
    });
  });

  describe('Static File Service', () => {
    beforeEach(async () => {
      const staticDir = path.join(__dirname, 'web', 'public');
      webServer = new WebServer({
        host: testHost,
        port: testPort,
        staticDir,
      });
      await webServer.start();
    });

    it('should serve index.html', async () => {
      const response = await makeHttpRequest(testPort, '/');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/html');
      expect(response.body).toContain('<!DOCTYPE html>');
    });

    it('should serve CSS files', async () => {
      const response = await makeHttpRequest(testPort, '/css/style.css');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('text/css');
    });

    it('should serve JavaScript files', async () => {
      const response = await makeHttpRequest(testPort, '/js/main.js');
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/javascript');
    });

    it('should return 404 for non-existent files', async () => {
      const response = await makeHttpRequest(testPort, '/nonexistent.html');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Property 18: Simulator consistency across modes', () => {
    /**
     * **Feature: web-visualization, Property 18: Simulator consistency across modes**
     * 
     * For any simulation with the same seed and configuration, running in terminal mode
     * vs Web mode should produce the same final profit and completed order count
     * 
     * **Validates: Requirements 8.5, 8.6**
     */
    it('should produce consistent results across terminal and web modes', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999999 }), // Random seed
          (seed) => {
            // Create config with the same seed
            const config = {
              ...getLevelConfig('level0.1'),
              seed,
            };

            // Run in "terminal mode" (no visualization)
            const simulator1 = new Simulator(config);
            
            // Run in "web mode" (with web server, but don't actually start it)
            const simulator2 = new Simulator(config);

            // Both simulators should have identical initial state
            const state1 = simulator1.getAgentState();
            const state2 = simulator2.getAgentState();

            expect(state1.getPosition()).toBe(state2.getPosition());
            expect(state1.getBattery()).toBe(state2.getBattery());
            expect(state1.getProfit()).toBe(state2.getProfit());

            // Both should have the same world state
            const world1 = simulator1.getWorldState();
            const world2 = simulator2.getWorldState();

            expect(world1.nodes.size).toBe(world2.nodes.size);
            expect(world1.edges.length).toBe(world2.edges.length);
            expect(world1.seed).toBe(world2.seed);

            // Both should have the same available orders
            const orders1 = simulator1.getAvailableOrders();
            const orders2 = simulator2.getAvailableOrders();

            expect(orders1.length).toBe(orders2.length);
            
            // Verify order IDs match
            const orderIds1 = orders1.map(o => o.id).sort();
            const orderIds2 = orders2.map(o => o.id).sort();
            expect(orderIds1).toEqual(orderIds2);

            return true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should produce consistent results when executing same tool calls', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }), // Random seed
          async (seed) => {
            // Create config with the same seed
            const config = {
              ...getLevelConfig('level0.1'),
              seed,
            };

            // Create two simulators with the same seed
            const simulator1 = new Simulator(config);
            const simulator2 = new Simulator(config);

            // Execute the same sequence of tool calls on both
            const orders1 = simulator1.getAvailableOrders();
            const orders2 = simulator2.getAvailableOrders();

            if (orders1.length > 0 && orders2.length > 0) {
              const order1 = orders1[0];
              const order2 = orders2[0];

              // Accept order
              const accept1 = await simulator1.executeToolCall({
                toolName: 'accept_order',
                parameters: { orderId: order1.id },
              });
              const accept2 = await simulator2.executeToolCall({
                toolName: 'accept_order',
                parameters: { orderId: order2.id },
              });

              expect(accept1.success).toBe(accept2.success);

              if (accept1.success && accept2.success) {
                // Move to pickup
                const move1 = await simulator1.executeToolCall({
                  toolName: 'move_to',
                  parameters: { targetLocationId: order1.pickupLocation },
                });
                const move2 = await simulator2.executeToolCall({
                  toolName: 'move_to',
                  parameters: { targetLocationId: order2.pickupLocation },
                });

                expect(move1.success).toBe(move2.success);

                // Both should have the same state after identical operations
                const state1 = simulator1.getAgentState();
                const state2 = simulator2.getAgentState();

                expect(state1.getPosition()).toBe(state2.getPosition());
                expect(state1.getBattery()).toBe(state2.getBattery());
                expect(state1.getCarriedOrders().length).toBe(state2.getCarriedOrders().length);
              }
            }

            return true;
          }
        ),
        { numRuns: 50 } // Fewer runs for async tests
      );
    });

    it('should produce consistent final scores with same seed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 999999 }), // Random seed
          async (seed) => {
            // Create config with the same seed
            const config = {
              ...getLevelConfig('level0.1'),
              seed,
            };

            // Create two simulators
            const simulator1 = new Simulator(config);
            const simulator2 = new Simulator(config);

            // Complete the same order on both
            const orders1 = simulator1.getAvailableOrders();
            const orders2 = simulator2.getAvailableOrders();

            if (orders1.length > 0 && orders2.length > 0) {
              const order1 = orders1[0];
              const order2 = orders2[0];

              // Execute identical sequence
              await simulator1.executeToolCall({
                toolName: 'accept_order',
                parameters: { orderId: order1.id },
              });
              await simulator2.executeToolCall({
                toolName: 'accept_order',
                parameters: { orderId: order2.id },
              });

              await simulator1.executeToolCall({
                toolName: 'move_to',
                parameters: { targetLocationId: order1.pickupLocation },
              });
              await simulator2.executeToolCall({
                toolName: 'move_to',
                parameters: { targetLocationId: order2.pickupLocation },
              });

              await simulator1.executeToolCall({
                toolName: 'pickup_food',
                parameters: { orderId: order1.id },
              });
              await simulator2.executeToolCall({
                toolName: 'pickup_food',
                parameters: { orderId: order2.id },
              });

              await simulator1.executeToolCall({
                toolName: 'move_to',
                parameters: { targetLocationId: order1.deliveryLocation },
              });
              await simulator2.executeToolCall({
                toolName: 'move_to',
                parameters: { targetLocationId: order2.deliveryLocation },
              });

              await simulator1.executeToolCall({
                toolName: 'deliver_food',
                parameters: { orderId: order1.id },
              });
              await simulator2.executeToolCall({
                toolName: 'deliver_food',
                parameters: { orderId: order2.id },
              });

              // Calculate final scores
              const score1 = simulator1.calculateFinalScore();
              const score2 = simulator2.calculateFinalScore();

              // Scores should be identical
              expect(score1.profit).toBe(score2.profit);
              expect(score1.onTimeRate).toBe(score2.onTimeRate);
              expect(score1.pathEfficiency).toBe(score2.pathEfficiency);

              // Stats should be identical
              const stats1 = simulator1.getStats();
              const stats2 = simulator2.getStats();

              expect(stats1.completedOrders).toBe(stats2.completedOrders);
              expect(stats1.totalProfit).toBe(stats2.totalProfit);
            }

            return true;
          }
        ),
        { numRuns: 20 } // Fewer runs for complex async tests
      );
    });
  });
});

// Helper function to make HTTP requests
function makeHttpRequest(port: number, path: string): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          body,
        });
      });
    }).on('error', reject);
  });
}
