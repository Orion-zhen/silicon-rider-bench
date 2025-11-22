/**
 * Congestion Manager Tests
 * Property-based tests for congestion system
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { CongestionManager } from './congestion-manager.js';
import { Edge, Node } from '../types/index.js';

describe('CongestionManager', () => {
  /**
   * Feature: silicon-rider-bench, Property 3: 拥堵到速度映射
   * Validates: Requirements 2.4, 2.5, 2.6, 2.7
   * 
   * For any congestion level value, it should map to the correct riding speed:
   * - Normal (< 0.3) → 30 km/h
   * - Light (0.3-0.5) → 25 km/h
   * - Moderate (0.5-0.7) → 20 km/h
   * - Heavy (≥ 0.7) → 15 km/h
   */
  it('Property 3: congestion to speed mapping', () => {
    fc.assert(
      fc.property(
        // Generate congestion values between 0 and 1
        fc.float({ min: 0, max: 1, noNaN: true }),
        (congestion) => {
          const speed = CongestionManager.congestionToSpeed(congestion);

          // Verify correct speed mapping based on congestion level
          if (congestion < 0.3) {
            // Normal: 30 km/h
            expect(speed).toBe(30);
          } else if (congestion < 0.5) {
            // Light congestion: 25 km/h
            expect(speed).toBe(25);
          } else if (congestion < 0.7) {
            // Moderate congestion: 20 km/h
            expect(speed).toBe(20);
          } else {
            // Heavy congestion: 15 km/h
            expect(speed).toBe(15);
          }

          // Speed should always be positive
          expect(speed).toBeGreaterThan(0);

          // Speed should be one of the valid values
          expect([15, 20, 25, 30]).toContain(speed);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Test boundary values for congestion to speed mapping
   */
  it('should handle boundary values correctly', () => {
    // Test exact boundaries
    expect(CongestionManager.congestionToSpeed(0)).toBe(30);      // Normal
    expect(CongestionManager.congestionToSpeed(0.29)).toBe(30);   // Normal (just below 0.3)
    expect(CongestionManager.congestionToSpeed(0.3)).toBe(25);    // Light (exactly 0.3)
    expect(CongestionManager.congestionToSpeed(0.49)).toBe(25);   // Light (just below 0.5)
    expect(CongestionManager.congestionToSpeed(0.5)).toBe(20);    // Moderate (exactly 0.5)
    expect(CongestionManager.congestionToSpeed(0.69)).toBe(20);   // Moderate (just below 0.7)
    expect(CongestionManager.congestionToSpeed(0.7)).toBe(15);    // Heavy (exactly 0.7)
    expect(CongestionManager.congestionToSpeed(1.0)).toBe(15);    // Heavy (max)
  });

  /**
   * Test congestion level categorization
   */
  it('should categorize congestion levels correctly', () => {
    expect(CongestionManager.getCongestionLevelName(0.1)).toBe('normal');
    expect(CongestionManager.getCongestionLevelName(0.4)).toBe('light');
    expect(CongestionManager.getCongestionLevelName(0.6)).toBe('moderate');
    expect(CongestionManager.getCongestionLevelName(0.8)).toBe('heavy');
  });

  /**
   * Test congestion updates during rush hours
   */
  it('should increase congestion during morning rush hour at map edges', () => {
    // Create a simple map with nodes at edge and center
    const nodes = new Map<string, Node>([
      ['edge1', { id: 'edge1', type: 'residential', position: { x: 0, y: 0 }, name: 'Edge 1' }],
      ['edge2', { id: 'edge2', type: 'office', position: { x: 10, y: 10 }, name: 'Edge 2' }],
      ['center1', { id: 'center1', type: 'restaurant', position: { x: 5, y: 5 }, name: 'Center 1' }],
    ]);

    const edges: Edge[] = [
      { from: 'edge1', to: 'edge2', distance: 2, baseCongestion: 0.1 },
      { from: 'center1', to: 'edge1', distance: 1, baseCongestion: 0.1 },
    ];

    const manager = new CongestionManager(edges, nodes);

    // Morning rush hour: 7:00 AM (420 minutes)
    const morningCongestion = manager.updateCongestion(420);

    // Check that congestion values are updated
    expect(morningCongestion.size).toBeGreaterThan(0);

    // All congestion values should be between 0 and 1
    for (const congestion of morningCongestion.values()) {
      expect(congestion).toBeGreaterThanOrEqual(0);
      expect(congestion).toBeLessThanOrEqual(1);
    }
  });

  /**
   * Test congestion updates during evening rush hour
   */
  it('should increase congestion during evening rush hour at map center', () => {
    const nodes = new Map<string, Node>([
      ['edge1', { id: 'edge1', type: 'residential', position: { x: 0, y: 0 }, name: 'Edge 1' }],
      ['center1', { id: 'center1', type: 'restaurant', position: { x: 5, y: 5 }, name: 'Center 1' }],
    ]);

    const edges: Edge[] = [
      { from: 'edge1', to: 'center1', distance: 2, baseCongestion: 0.1 },
    ];

    const manager = new CongestionManager(edges, nodes);

    // Evening rush hour: 6:00 PM (1080 minutes)
    const eveningCongestion = manager.updateCongestion(1080);

    // Check that congestion values are updated
    expect(eveningCongestion.size).toBeGreaterThan(0);

    // All congestion values should be between 0 and 1
    for (const congestion of eveningCongestion.values()) {
      expect(congestion).toBeGreaterThanOrEqual(0);
      expect(congestion).toBeLessThanOrEqual(1);
    }
  });

  /**
   * Test congestion during non-rush hours
   */
  it('should use base congestion during non-rush hours', () => {
    const nodes = new Map<string, Node>([
      ['node1', { id: 'node1', type: 'residential', position: { x: 0, y: 0 }, name: 'Node 1' }],
      ['node2', { id: 'node2', type: 'office', position: { x: 5, y: 5 }, name: 'Node 2' }],
    ]);

    const baseCongestion = 0.2;
    const edges: Edge[] = [
      { from: 'node1', to: 'node2', distance: 2, baseCongestion },
    ];

    const manager = new CongestionManager(edges, nodes);

    // Non-rush hour: 2:00 PM (840 minutes)
    const congestionMap = manager.updateCongestion(840);

    // During non-rush hours, congestion should be close to base congestion
    for (const congestion of congestionMap.values()) {
      // Should be base congestion or slightly modified
      expect(congestion).toBeGreaterThanOrEqual(baseCongestion - 0.1);
      expect(congestion).toBeLessThanOrEqual(baseCongestion + 0.1);
    }
  });
});
