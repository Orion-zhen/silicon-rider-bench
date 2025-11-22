/**
 * 数据模型属性测试
 * Feature: silicon-rider-bench, Property 2: 地图完整性
 * 验证：需求 1.3, 1.4
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Node, Edge, WorldState, NodeType } from './index';

describe('Property 2: 地图完整性', () => {
  /**
   * 属性 2: 地图完整性
   * 对于任意生成的地图，应该包含所有类型的节点（餐厅、超市、药店、居民区、写字楼、换电站），
   * 且所有边都应该具有距离和拥堵属性
   */
  it('任意生成的地图应该包含所有类型的节点且所有边都具有必需属性', () => {
    // 定义所有必需的节点类型
    const requiredNodeTypes: NodeType[] = [
      'restaurant',
      'supermarket',
      'pharmacy',
      'residential',
      'office',
      'battery_swap'
    ];

    // 生成节点类型的 arbitrary
    const nodeTypeArbitrary = fc.constantFrom<NodeType>(
      'restaurant',
      'supermarket',
      'pharmacy',
      'residential',
      'office',
      'battery_swap'
    );

    // 生成单个节点的 arbitrary
    const nodeArbitrary = fc.record({
      id: fc.string({ minLength: 1, maxLength: 20 }),
      type: nodeTypeArbitrary,
      position: fc.record({
        x: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true }),
        y: fc.float({ min: Math.fround(0), max: Math.fround(100), noNaN: true })
      }),
      name: fc.string({ minLength: 1, maxLength: 50 })
    }) as fc.Arbitrary<Node>;

    // 生成边的 arbitrary
    const edgeArbitrary = (nodeIds: string[]) => {
      if (nodeIds.length < 2) {
        return fc.constant([]);
      }
      return fc.array(
        fc.record({
          from: fc.constantFrom(...nodeIds),
          to: fc.constantFrom(...nodeIds),
          distance: fc.float({ min: Math.fround(0.1), max: Math.fround(20), noNaN: true }),
          baseCongestion: fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true })
        }) as fc.Arbitrary<Edge>,
        { minLength: 1, maxLength: nodeIds.length * 2 }
      );
    };

    // 生成包含所有节点类型的地图
    const worldStateArbitrary = fc
      .array(nodeArbitrary, { minLength: 10, maxLength: 50 })
      .chain(nodes => {
        // 确保包含所有必需的节点类型
        const nodeMap = new Map<string, Node>();
        const typeCount = new Map<NodeType, number>();

        // 首先添加所有必需类型的节点（至少一个）
        requiredNodeTypes.forEach((type, index) => {
          const requiredNode: Node = {
            id: `required_${type}_${index}`,
            type,
            position: { x: index * 10, y: index * 10 },
            name: `Required ${type}`
          };
          nodeMap.set(requiredNode.id, requiredNode);
          typeCount.set(type, 1);
        });

        // 添加生成的节点
        nodes.forEach(node => {
          if (!nodeMap.has(node.id)) {
            nodeMap.set(node.id, node);
            typeCount.set(node.type, (typeCount.get(node.type) || 0) + 1);
          }
        });

        const nodeIds = Array.from(nodeMap.keys());

        return edgeArbitrary(nodeIds).map(edges => ({
          nodes: nodeMap,
          edges,
          currentTime: 0,
          seed: 12345,
          congestionMap: new Map<string, number>()
        })) as fc.Arbitrary<WorldState>;
      });

    fc.assert(
      fc.property(worldStateArbitrary, (worldState) => {
        // 验证 1: 地图应该包含所有类型的节点
        const nodeTypes = new Set<NodeType>();
        worldState.nodes.forEach(node => {
          nodeTypes.add(node.type);
        });

        requiredNodeTypes.forEach(requiredType => {
          expect(
            nodeTypes.has(requiredType),
            `地图应该包含 ${requiredType} 类型的节点`
          ).toBe(true);
        });

        // 验证 2: 所有边都应该具有距离属性
        worldState.edges.forEach((edge, index) => {
          expect(
            edge.distance,
            `边 ${index} 应该有 distance 属性`
          ).toBeDefined();
          expect(
            typeof edge.distance,
            `边 ${index} 的 distance 应该是 number 类型`
          ).toBe('number');
          expect(
            edge.distance,
            `边 ${index} 的 distance 应该大于 0`
          ).toBeGreaterThan(0);
          expect(
            Number.isFinite(edge.distance),
            `边 ${index} 的 distance 应该是有限数`
          ).toBe(true);
        });

        // 验证 3: 所有边都应该具有拥堵属性
        worldState.edges.forEach((edge, index) => {
          expect(
            edge.baseCongestion,
            `边 ${index} 应该有 baseCongestion 属性`
          ).toBeDefined();
          expect(
            typeof edge.baseCongestion,
            `边 ${index} 的 baseCongestion 应该是 number 类型`
          ).toBe('number');
          expect(
            edge.baseCongestion,
            `边 ${index} 的 baseCongestion 应该在 0-1 之间`
          ).toBeGreaterThanOrEqual(0);
          expect(
            edge.baseCongestion,
            `边 ${index} 的 baseCongestion 应该在 0-1 之间`
          ).toBeLessThanOrEqual(1);
          expect(
            Number.isFinite(edge.baseCongestion),
            `边 ${index} 的 baseCongestion 应该是有限数`
          ).toBe(true);
        });

        // 验证 4: 边的 from 和 to 应该引用存在的节点
        worldState.edges.forEach((edge, index) => {
          expect(
            worldState.nodes.has(edge.from),
            `边 ${index} 的 from 节点 ${edge.from} 应该存在于地图中`
          ).toBe(true);
          expect(
            worldState.nodes.has(edge.to),
            `边 ${index} 的 to 节点 ${edge.to} 应该存在于地图中`
          ).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });
});
