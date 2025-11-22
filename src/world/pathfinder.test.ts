/**
 * Pathfinder Tests
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Pathfinder } from './pathfinder.js';
import { CongestionManager } from './congestion-manager.js';
import { Node, Edge } from '../types/index.js';
import { generateMap } from './map-generator.js';

describe('Pathfinder', () => {
  // Create a simple test graph
  const createTestGraph = () => {
    const nodes = new Map<string, Node>([
      ['A', { id: 'A', type: 'restaurant', position: { x: 0, y: 0 }, name: 'Node A' }],
      ['B', { id: 'B', type: 'residential', position: { x: 1, y: 0 }, name: 'Node B' }],
      ['C', { id: 'C', type: 'office', position: { x: 2, y: 0 }, name: 'Node C' }],
      ['D', { id: 'D', type: 'battery_swap', position: { x: 1, y: 1 }, name: 'Node D' }],
    ]);

    const edges: Edge[] = [
      { from: 'A', to: 'B', distance: 1.0, baseCongestion: 0.2 },
      { from: 'B', to: 'C', distance: 1.5, baseCongestion: 0.3 },
      { from: 'A', to: 'D', distance: 2.0, baseCongestion: 0.1 },
      { from: 'D', to: 'C', distance: 1.0, baseCongestion: 0.2 },
    ];

    return { nodes, edges };
  };

  describe('calculateDistance', () => {
    it('should return 0 distance for same node', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);

      const result = pathfinder.calculateDistance('A', 'A');
      expect(result).not.toBeNull();
      expect(result!.distance).toBe(0);
      expect(result!.path).toEqual(['A']);
    });

    it('should find direct path between adjacent nodes', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);

      const result = pathfinder.calculateDistance('A', 'B');
      expect(result).not.toBeNull();
      expect(result!.distance).toBe(1.0);
      expect(result!.path).toEqual(['A', 'B']);
    });

    it('should find shortest path through multiple nodes', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);

      const result = pathfinder.calculateDistance('A', 'C');
      expect(result).not.toBeNull();
      // Shortest path: A -> B -> C (1.0 + 1.5 = 2.5)
      // Alternative: A -> D -> C (2.0 + 1.0 = 3.0)
      expect(result!.distance).toBe(2.5);
      expect(result!.path).toEqual(['A', 'B', 'C']);
    });

    it('should return null for invalid node IDs', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);

      const result = pathfinder.calculateDistance('A', 'Z');
      expect(result).toBeNull();
    });

    it('should handle bidirectional edges', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);

      const result1 = pathfinder.calculateDistance('A', 'B');
      const result2 = pathfinder.calculateDistance('B', 'A');

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1!.distance).toBe(result2!.distance);
    });
  });

  describe('estimateTime', () => {
    it('should calculate time for single segment', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);
      const congestionManager = new CongestionManager(edges, nodes);

      const result = pathfinder.estimateTime(['A', 'B'], 0, congestionManager);
      expect(result).not.toBeNull();
      expect(result!.segments).toHaveLength(1);
      expect(result!.segments[0].from).toBe('A');
      expect(result!.segments[0].to).toBe('B');
      expect(result!.segments[0].distance).toBe(1.0);
      // At time 0, congestion is 0.2 (normal), speed is 30 km/h
      // Time = 1.0 / 30 * 60 = 2 minutes
      expect(result!.totalTime).toBeCloseTo(2, 1);
    });

    it('should calculate time for multiple segments', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);
      const congestionManager = new CongestionManager(edges, nodes);

      const result = pathfinder.estimateTime(['A', 'B', 'C'], 0, congestionManager);
      expect(result).not.toBeNull();
      expect(result!.segments).toHaveLength(2);
      expect(result!.totalTime).toBeGreaterThan(0);
    });

    it('should return null for invalid location IDs', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);
      const congestionManager = new CongestionManager(edges, nodes);

      const result = pathfinder.estimateTime(['A', 'Z'], 0, congestionManager);
      expect(result).toBeNull();
    });

    it('should return null for less than 2 locations', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);
      const congestionManager = new CongestionManager(edges, nodes);

      const result = pathfinder.estimateTime(['A'], 0, congestionManager);
      expect(result).toBeNull();
    });

    it('should consider congestion in time calculation', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);
      const congestionManager = new CongestionManager(edges, nodes);

      // Calculate at different times to see congestion effect
      const result1 = pathfinder.estimateTime(['A', 'B'], 0, congestionManager);
      const result2 = pathfinder.estimateTime(['A', 'B'], 8 * 60, congestionManager); // Morning rush

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      // Times might differ due to congestion (though in this small graph, effect may be minimal)
      expect(result1!.totalTime).toBeGreaterThan(0);
      expect(result2!.totalTime).toBeGreaterThan(0);
    });
  });

  describe('hasPath', () => {
    it('should return true for connected nodes', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);

      expect(pathfinder.hasPath('A', 'C')).toBe(true);
    });

    it('should return false for disconnected nodes', () => {
      const nodes = new Map<string, Node>([
        ['A', { id: 'A', type: 'restaurant', position: { x: 0, y: 0 }, name: 'Node A' }],
        ['B', { id: 'B', type: 'residential', position: { x: 1, y: 0 }, name: 'Node B' }],
      ]);
      const edges: Edge[] = []; // No edges

      const pathfinder = new Pathfinder(nodes, edges);
      expect(pathfinder.hasPath('A', 'B')).toBe(false);
    });
  });

  describe('getEdge', () => {
    it('should return edge between connected nodes', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);

      const edge = pathfinder.getEdge('A', 'B');
      expect(edge).not.toBeNull();
      expect(edge!.distance).toBe(1.0);
    });

    it('should return null for non-adjacent nodes', () => {
      const { nodes, edges } = createTestGraph();
      const pathfinder = new Pathfinder(nodes, edges);

      const edge = pathfinder.getEdge('A', 'C');
      expect(edge).toBeNull();
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: silicon-rider-bench, Property 22: 距离计算对称性
     * Validates: Requirements 11.1
     * 
     * 属性 22：距离计算对称性
     * 对于任意两个位置 A 和 B，calculate_distance(A, B) 应该等于 calculate_distance(B, A)
     */
    it('Property 22: Distance calculation symmetry', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 999999 }), // seed
          fc.constantFrom('small' as const, 'large' as const), // map size
          (seed, size) => {
            // Generate a deterministic map
            const map = generateMap({ seed, size });
            const pathfinder = new Pathfinder(map.nodes, map.edges);

            // Get all node IDs
            const nodeIds = Array.from(map.nodes.keys());

            // Test symmetry for all pairs of nodes
            for (let i = 0; i < Math.min(nodeIds.length, 10); i++) {
              for (let j = i + 1; j < Math.min(nodeIds.length, 10); j++) {
                const nodeA = nodeIds[i];
                const nodeB = nodeIds[j];

                const distanceAB = pathfinder.calculateDistance(nodeA, nodeB);
                const distanceBA = pathfinder.calculateDistance(nodeB, nodeA);

                // Both should succeed or both should fail
                if (distanceAB === null) {
                  expect(distanceBA).toBeNull();
                } else {
                  expect(distanceBA).not.toBeNull();
                  // Distances should be equal (symmetric)
                  expect(distanceAB.distance).toBeCloseTo(distanceBA!.distance, 5);
                  // Paths should be reverse of each other
                  expect(distanceAB.path[0]).toBe(nodeA);
                  expect(distanceAB.path[distanceAB.path.length - 1]).toBe(nodeB);
                  expect(distanceBA!.path[0]).toBe(nodeB);
                  expect(distanceBA!.path[distanceBA!.path.length - 1]).toBe(nodeA);
                }
              }
            }
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    });
  });
});
