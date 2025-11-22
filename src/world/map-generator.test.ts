/**
 * Map Generator Unit Tests
 * Tests for deterministic map generation
 */

import { describe, it, expect } from 'vitest';
import { generateMap } from './map-generator.js';
import { NodeType } from '../types/index.js';

describe('Map Generator', () => {
  describe('Seed Determinism', () => {
    it('should generate identical maps with the same seed', () => {
      const seed = 12345;
      const map1 = generateMap({ seed, size: 'small' });
      const map2 = generateMap({ seed, size: 'small' });
      
      // Check same number of nodes
      expect(map1.nodes.size).toBe(map2.nodes.size);
      
      // Check same number of edges
      expect(map1.edges.length).toBe(map2.edges.length);
      
      // Check nodes are identical
      for (const [id, node1] of map1.nodes) {
        const node2 = map2.nodes.get(id);
        expect(node2).toBeDefined();
        expect(node1.type).toBe(node2!.type);
        expect(node1.position.x).toBeCloseTo(node2!.position.x, 5);
        expect(node1.position.y).toBeCloseTo(node2!.position.y, 5);
        expect(node1.name).toBe(node2!.name);
      }
      
      // Check edges are identical
      for (let i = 0; i < map1.edges.length; i++) {
        const edge1 = map1.edges[i];
        const edge2 = map2.edges[i];
        expect(edge1.from).toBe(edge2.from);
        expect(edge1.to).toBe(edge2.to);
        expect(edge1.distance).toBeCloseTo(edge2.distance, 5);
        expect(edge1.baseCongestion).toBeCloseTo(edge2.baseCongestion, 5);
      }
    });
    
    it('should generate different maps with different seeds', () => {
      const map1 = generateMap({ seed: 12345, size: 'small' });
      const map2 = generateMap({ seed: 67890, size: 'small' });
      
      // Maps should have same structure but different details
      expect(map1.nodes.size).toBe(map2.nodes.size);
      
      // At least some nodes should have different positions
      let differentPositions = 0;
      for (const [id, node1] of map1.nodes) {
        const node2 = map2.nodes.get(id);
        if (node2) {
          if (Math.abs(node1.position.x - node2.position.x) > 0.01 ||
              Math.abs(node1.position.y - node2.position.y) > 0.01) {
            differentPositions++;
          }
        }
      }
      
      expect(differentPositions).toBeGreaterThan(0);
    });
  });
  
  describe('Node Type Distribution', () => {
    it('should include all node types', () => {
      const map = generateMap({ seed: 12345, size: 'large' });
      
      const nodeTypes = new Set<NodeType>();
      for (const node of map.nodes.values()) {
        nodeTypes.add(node.type);
      }
      
      // All 6 types should be present
      expect(nodeTypes.has('restaurant')).toBe(true);
      expect(nodeTypes.has('supermarket')).toBe(true);
      expect(nodeTypes.has('pharmacy')).toBe(true);
      expect(nodeTypes.has('residential')).toBe(true);
      expect(nodeTypes.has('office')).toBe(true);
      expect(nodeTypes.has('battery_swap')).toBe(true);
    });
    
    it('should respect node type distribution ranges', () => {
      const map = generateMap({ seed: 12345, size: 'large' });
      const totalNodes = map.nodes.size;
      
      const typeCounts: Record<NodeType, number> = {
        restaurant: 0,
        supermarket: 0,
        pharmacy: 0,
        residential: 0,
        office: 0,
        battery_swap: 0,
      };
      
      for (const node of map.nodes.values()) {
        typeCounts[node.type]++;
      }
      
      // Check distribution ranges (with some tolerance)
      expect(typeCounts.restaurant / totalNodes).toBeGreaterThanOrEqual(0.25);
      expect(typeCounts.restaurant / totalNodes).toBeLessThanOrEqual(0.45);
      
      expect(typeCounts.supermarket / totalNodes).toBeGreaterThanOrEqual(0.05);
      expect(typeCounts.supermarket / totalNodes).toBeLessThanOrEqual(0.20);
      
      expect(typeCounts.pharmacy / totalNodes).toBeGreaterThanOrEqual(0.02);
      expect(typeCounts.pharmacy / totalNodes).toBeLessThanOrEqual(0.15);
      
      expect(typeCounts.residential / totalNodes).toBeGreaterThanOrEqual(0.15);
      expect(typeCounts.residential / totalNodes).toBeLessThanOrEqual(0.35);
      
      expect(typeCounts.office / totalNodes).toBeGreaterThanOrEqual(0.05);
      expect(typeCounts.office / totalNodes).toBeLessThanOrEqual(0.20);
      
      expect(typeCounts.battery_swap / totalNodes).toBeGreaterThanOrEqual(0.02);
      expect(typeCounts.battery_swap / totalNodes).toBeLessThanOrEqual(0.15);
    });
    
    it('should generate correct number of nodes for small maps', () => {
      const map = generateMap({ seed: 12345, size: 'small' });
      expect(map.nodes.size).toBe(10);
    });
    
    it('should generate correct number of nodes for large maps', () => {
      const map = generateMap({ seed: 12345, size: 'large' });
      expect(map.nodes.size).toBe(50);
    });
  });
  
  describe('Edge Generation', () => {
    it('should generate edges with distance and congestion properties', () => {
      const map = generateMap({ seed: 12345, size: 'small' });
      
      expect(map.edges.length).toBeGreaterThan(0);
      
      for (const edge of map.edges) {
        // Check edge has required properties
        expect(edge.from).toBeDefined();
        expect(edge.to).toBeDefined();
        expect(edge.distance).toBeGreaterThan(0);
        expect(edge.baseCongestion).toBeGreaterThanOrEqual(0.1);
        expect(edge.baseCongestion).toBeLessThanOrEqual(0.3);
        
        // Check nodes exist
        expect(map.nodes.has(edge.from)).toBe(true);
        expect(map.nodes.has(edge.to)).toBe(true);
      }
    });
    
    it('should create a connected graph', () => {
      const map = generateMap({ seed: 12345, size: 'small' });
      
      // Build adjacency list
      const adjacency = new Map<string, Set<string>>();
      for (const [id] of map.nodes) {
        adjacency.set(id, new Set());
      }
      
      for (const edge of map.edges) {
        adjacency.get(edge.from)!.add(edge.to);
        adjacency.get(edge.to)!.add(edge.from);
      }
      
      // BFS to check connectivity
      const visited = new Set<string>();
      const startNode = Array.from(map.nodes.keys())[0];
      const queue = [startNode];
      visited.add(startNode);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        for (const neighbor of adjacency.get(current)!) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      
      // All nodes should be reachable
      expect(visited.size).toBe(map.nodes.size);
    });
    
    it('should have reasonable edge count', () => {
      const map = generateMap({ seed: 12345, size: 'small' });
      
      // For K-nearest neighbors with K=3, expect roughly 1.5 * N edges
      // (each node connects to 3 neighbors, but edges are undirected)
      const minEdges = map.nodes.size - 1; // Minimum for connectivity
      const maxEdges = map.nodes.size * 3; // Maximum if all K connections succeed
      
      expect(map.edges.length).toBeGreaterThanOrEqual(minEdges);
      expect(map.edges.length).toBeLessThanOrEqual(maxEdges);
    });
  });
  
  describe('Map Size Configurations', () => {
    it('should generate small maps with correct parameters', () => {
      const map = generateMap({ seed: 12345, size: 'small' });
      
      expect(map.nodes.size).toBe(10);
      expect(map.seed).toBe(12345);
      
      // Check positions are within grid bounds
      for (const node of map.nodes.values()) {
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.x).toBeLessThanOrEqual(5);
        expect(node.position.y).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeLessThanOrEqual(5);
      }
    });
    
    it('should generate large maps with correct parameters', () => {
      const map = generateMap({ seed: 67890, size: 'large' });
      
      expect(map.nodes.size).toBe(50);
      expect(map.seed).toBe(67890);
      
      // Check positions are within grid bounds
      for (const node of map.nodes.values()) {
        expect(node.position.x).toBeGreaterThanOrEqual(0);
        expect(node.position.x).toBeLessThanOrEqual(15);
        expect(node.position.y).toBeGreaterThanOrEqual(0);
        expect(node.position.y).toBeLessThanOrEqual(15);
      }
    });
  });
});
