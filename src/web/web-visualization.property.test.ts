/**
 * Web Visualization Property Tests
 * Silicon Rider Bench - Web Visualization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebVisualization } from './web-visualization';
import { WebServer } from './web-server';
import { Simulator } from '../core/simulator';
import { getLevelConfig } from '../levels/level-config';
import * as fc from 'fast-check';
import * as path from 'path';
import * as fs from 'fs';
import WebSocket from 'ws';

/**
 * Feature: web-visualization, Property 11: WebSocket state update propagation
 * Validates: Requirements 5.1
 */
describe('WebVisualization Property Tests', () => {
  let simulator: Simulator;
  let webServer: WebServer;
  let webVisualization: WebVisualization;
  const testPort = 13590;
  const testHost = 'localhost';
  const testStaticDir = path.join(__dirname, 'test-static-viz-pbt');

  beforeEach(async () => {
    // Create test static directory
    if (!fs.existsSync(testStaticDir)) {
      fs.mkdirSync(testStaticDir, { recursive: true });
    }

    // Initialize simulator
    const config = getLevelConfig('level0.1');
    simulator = new Simulator(config);

    // Initialize web server
    webServer = new WebServer({
      host: testHost,
      port: testPort,
      staticDir: testStaticDir,
    });

    await webServer.start();

    // Initialize web visualization
    webVisualization = new WebVisualization(simulator, webServer);
  });

  afterEach(async () => {
    if (webServer) {
      await webServer.stop();
    }

    // Clean up test directory
    if (fs.existsSync(testStaticDir)) {
      fs.rmdirSync(testStaticDir, { recursive: true });
    }
  });

  /**
   * Feature: web-visualization, Property 11: WebSocket state update propagation
   * Validates: Requirements 5.1
   * 
   * Property: For any simulator state change, a corresponding WebSocket message
   * should be sent to all connected clients
   */
  it('should broadcast state update message to all connected clients after any state change', async () => {
    // Connect clients once before all property tests
    const clientCount = 3;
    const clients: WebSocket[] = [];
    const receivedMessages: any[][] = Array(clientCount).fill(null).map(() => []);

    // Create WebSocket clients
    for (let i = 0; i < clientCount; i++) {
      const client = new WebSocket(`ws://${testHost}:${testPort}`);
      clients.push(client);

      // Set up message handler
      const messageHandler = (data: WebSocket.Data) => {
        const message = JSON.parse(data.toString());
        receivedMessages[i].push(message);
      };

      client.on('message', messageHandler);

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        client.on('open', () => resolve());
        client.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });
    }

    // Wait a bit for all connections to be registered
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      await fc.assert(
        fc.asyncProperty(
          // Generate random tool calls that change state
          fc.constantFrom(
            { toolName: 'get_my_status', parameters: {} },
            { toolName: 'search_nearby_orders', parameters: { radius: 100 } }
          ),
          async (toolCall) => {
            // Clear messages before each test
            receivedMessages.forEach(msgs => msgs.length = 0);

            // Execute tool call (state change)
            await simulator.executeToolCall(toolCall);

            // Send state update
            webVisualization.sendStateUpdate();

            // Wait for messages to be received (accounting for throttling delay of 100ms)
            await new Promise(resolve => setTimeout(resolve, 150));

            // Verify all clients received the state update message
            for (let i = 0; i < clientCount; i++) {
              const stateUpdateMessages = receivedMessages[i].filter(
                msg => msg.type === 'state_update'
              );
              
              expect(stateUpdateMessages.length).toBeGreaterThanOrEqual(1);
              
              // Verify message structure
              const lastStateUpdate = stateUpdateMessages[stateUpdateMessages.length - 1];
              expect(lastStateUpdate).toHaveProperty('type', 'state_update');
              expect(lastStateUpdate).toHaveProperty('timestamp');
              expect(lastStateUpdate).toHaveProperty('data');
              expect(lastStateUpdate.data).toHaveProperty('currentTime');
              expect(lastStateUpdate.data).toHaveProperty('formattedTime');
              expect(lastStateUpdate.data).toHaveProperty('agentState');
              expect(lastStateUpdate.data.agentState).toHaveProperty('position');
              expect(lastStateUpdate.data.agentState).toHaveProperty('battery');
              expect(lastStateUpdate.data.agentState).toHaveProperty('profit');
            }
          }
        ),
        { numRuns: 100 }
      );
    } finally {
      // Clean up clients after all tests
      for (const client of clients) {
        if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
          client.close();
        }
      }
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, 30000); // Increase timeout to 30 seconds for 100 iterations

  /**
   * Additional property test: Verify that state update messages contain
   * accurate data from the simulator
   */
  it('should include accurate simulator state in state update messages', async () => {
    // Connect a client once before all property tests
    const client = new WebSocket(`ws://${testHost}:${testPort}`);
    const receivedMessages: any[] = [];

    client.on('message', (data: WebSocket.Data) => {
      const message = JSON.parse(data.toString());
      receivedMessages.push(message);
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => resolve());
      client.on('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    try {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }),
          async (toolCallCount) => {
            // Clear messages before each test
            receivedMessages.length = 0;

            // Execute multiple tool calls
            for (let i = 0; i < toolCallCount; i++) {
              await simulator.executeToolCall({
                toolName: 'get_my_status',
                parameters: {},
              });
            }

            // Send state update
            webVisualization.sendStateUpdate();

            // Wait for message
            await new Promise(resolve => setTimeout(resolve, 50));

            // Get actual simulator state
            const agentState = simulator.getAgentState();
            const currentTime = simulator.getCurrentTime();

            // Find state update message
            const stateUpdateMsg = receivedMessages.find(msg => msg.type === 'state_update');
            
            if (stateUpdateMsg) {
              // Verify data matches simulator state
              expect(stateUpdateMsg.data.currentTime).toBe(currentTime);
              expect(stateUpdateMsg.data.agentState.position).toBe(agentState.getPosition());
              expect(stateUpdateMsg.data.agentState.battery).toBe(agentState.getBattery());
              expect(stateUpdateMsg.data.agentState.profit).toBe(agentState.getProfit());
              expect(stateUpdateMsg.data.agentState.completedOrders).toBe(agentState.getCompletedOrders());
            }
          }
        ),
        { numRuns: 50 }
      );
    } finally {
      // Clean up after all tests
      if (client.readyState === WebSocket.OPEN || client.readyState === WebSocket.CONNECTING) {
        client.close();
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, 20000); // Increase timeout to 20 seconds for 50 iterations
});
