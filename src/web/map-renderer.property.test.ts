/**
 * Property-Based Tests for MapRenderer
 * Feature: web-visualization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

// Load the MapRenderer class from the client-side JavaScript file
const mapRendererCode = fs.readFileSync(
  path.join(__dirname, 'public/js/map-renderer.js'),
  'utf-8'
);

// Create a DOM environment for testing
function createTestEnvironment() {
  const dom = new JSDOM('<!DOCTYPE html><div id="map-container" style="width: 800px; height: 600px;"></div>');
  const window = dom.window;
  const document = window.document;
  
  // Inject document and requestAnimationFrame into global scope
  (global as any).document = document;
  (global as any).requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 0) as any;
  };
  
  // Execute the MapRenderer code in the context with document available
  const scriptCode = `
    ${mapRendererCode}
    return MapRenderer;
  `;
  
  const script = new Function(scriptCode);
  const MapRenderer = script();
  
  return { MapRenderer, document, window };
}

describe('MapRenderer Property Tests', () => {
  /**
   * Property 4: Node emoji mapping
   * For any node type in the system, the rendered HTML should contain 
   * the corresponding emoji icon from the NODE_EMOJI_MAP
   * Validates: Requirements 2.3
   */
  describe('Property 4: Node emoji mapping', () => {
    it('should map all node types to their corresponding emoji icons', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('restaurant', 'supermarket', 'pharmacy', 'residential', 'office', 'battery_swap'),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.float({ min: 0, max: 100 }),
          fc.float({ min: 0, max: 100 }),
          async (nodeType, nodeName, x, y) => {
            const { MapRenderer, document } = createTestEnvironment();
            const container = document.getElementById('map-container');
            const renderer = new MapRenderer(container);
            
            // Expected emoji mapping
            const expectedEmoji: Record<string, string> = {
              restaurant: '🍔',
              supermarket: '🛒',
              pharmacy: '💊',
              residential: '🏠',
              office: '🏢',
              battery_swap: '🔋',
            };
            
            // Initialize with a single node
            const nodes = [{
              id: 'test-node',
              type: nodeType,
              name: nodeName,
              position: { x, y }
            }];
            
            renderer.initialize(nodes, []);
            
            // Wait for render to complete (requestAnimationFrame is async)
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                resolve();
              }, 10);
            });
            
            // Check that the rendered HTML contains the expected emoji
            const containerHTML = container.innerHTML;
            const expectedEmojiIcon = expectedEmoji[nodeType];
            
            expect(containerHTML).toContain(expectedEmojiIcon);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Coordinate transformation consistency
   * For any two nodes with positions (x1, y1) and (x2, y2), 
   * if x1 < x2, then screenX1 < screenX2, and similarly for y coordinates
   * Validates: Requirements 2.5
   */
  describe('Property 5: Coordinate transformation consistency', () => {
    it('should preserve relative positions when transforming coordinates', () => {
      fc.assert(
        fc.property(
          fc.record({
            x1: fc.float({ min: 0, max: 100 }),
            y1: fc.float({ min: 0, max: 100 }),
            x2: fc.float({ min: 0, max: 100 }),
            y2: fc.float({ min: 0, max: 100 }),
          }),
          (coords) => {
            // Tolerance for floating point comparison - if coordinates are too close,
            // they may map to the same screen coordinate
            const tolerance = 0.5;
            
            const { MapRenderer, document } = createTestEnvironment();
            const container = document.getElementById('map-container');
            
            // Set container size
            Object.defineProperty(container, 'clientWidth', { value: 800, writable: true });
            Object.defineProperty(container, 'clientHeight', { value: 600, writable: true });
            
            const renderer = new MapRenderer(container);
            
            // Initialize with two nodes
            const nodes = [
              {
                id: 'node1',
                type: 'restaurant',
                name: 'Node 1',
                position: { x: coords.x1, y: coords.y1 }
              },
              {
                id: 'node2',
                type: 'supermarket',
                name: 'Node 2',
                position: { x: coords.x2, y: coords.y2 }
              }
            ];
            
            renderer.initialize(nodes, []);
            
            // Transform coordinates
            const screen1 = renderer.worldToScreen(coords.x1, coords.y1);
            const screen2 = renderer.worldToScreen(coords.x2, coords.y2);
            
            // Check that relative positions are preserved
            // Only check if the difference is significant enough
            const xDiff = coords.x2 - coords.x1;
            const yDiff = coords.y2 - coords.y1;
            
            if (xDiff > tolerance) {
              expect(screen1.x).toBeLessThan(screen2.x);
            } else if (xDiff < -tolerance) {
              expect(screen1.x).toBeGreaterThan(screen2.x);
            }
            
            if (yDiff > tolerance) {
              expect(screen1.y).toBeLessThan(screen2.y);
            } else if (yDiff < -tolerance) {
              expect(screen1.y).toBeGreaterThan(screen2.y);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Client position update
   * For any position update message received by the client, 
   * the agent's displayed position on the map should match the position in the message
   * Validates: Requirements 5.2
   */
  describe('Property 12: Client position update', () => {
    it('should update agent position to match the received message', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 10 }),
              type: fc.constantFrom('restaurant', 'supermarket', 'pharmacy', 'residential', 'office', 'battery_swap'),
              name: fc.string({ minLength: 1, maxLength: 20 }),
              x: fc.float({ min: 0, max: 100 }),
              y: fc.float({ min: 0, max: 100 }),
            }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.nat(),
          async (nodeConfigs, agentPositionIndex) => {
            // Ensure unique node IDs
            const uniqueNodes = Array.from(
              new Map(nodeConfigs.map(n => [n.id, n])).values()
            );
            
            if (uniqueNodes.length < 2) {
              return true; // Skip if not enough unique nodes
            }
            
            const { MapRenderer, document } = createTestEnvironment();
            const container = document.getElementById('map-container');
            const renderer = new MapRenderer(container);
            
            // Initialize with nodes
            const nodes = uniqueNodes.map(n => ({
              id: n.id,
              type: n.type,
              name: n.name,
              position: { x: n.x, y: n.y }
            }));
            
            renderer.initialize(nodes, []);
            
            // Update agent position to a specific node
            const targetNodeId = nodes[agentPositionIndex % nodes.length].id;
            renderer.updateAgentPosition(targetNodeId);
            
            // Wait for render to complete (requestAnimationFrame is async)
            await new Promise<void>((resolve) => {
              setTimeout(() => {
                resolve();
              }, 10);
            });
            
            // Check that the agent marker is present and associated with the correct node
            const containerHTML = container.innerHTML;
            
            // The agent emoji should be present (using scooter emoji from map-renderer.js)
            expect(containerHTML).toContain('🛵');
            
            // The agent position should be stored correctly
            expect(renderer.agentPosition).toBe(targetNodeId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
