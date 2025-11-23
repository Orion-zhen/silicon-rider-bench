/**
 * Map Generator
 * Generates deterministic maps from seeds for the Silicon Rider Bench
 */

import { SeededRNG } from '../utils/seeded-rng.js';
import { Node, Edge, NodeType } from '../types/index.js';

/**
 * Map generation configuration
 */
export interface MapConfig {
  seed: number;
  size: 'small' | 'large';
}

/**
 * Generated map result
 */
export interface GeneratedMap {
  nodes: Map<string, Node>;
  edges: Edge[];
  seed: number;
}

/**
 * Node type distribution configuration
 */
const NODE_TYPE_DISTRIBUTION = {
  restaurant: { min: 0.30, max: 0.40 },
  supermarket: { min: 0.10, max: 0.15 },
  pharmacy: { min: 0.05, max: 0.10 },
  residential: { min: 0.20, max: 0.30 },
  office: { min: 0.10, max: 0.15 },
  battery_swap: { min: 0.05, max: 0.10 },
};

/**
 * Map size configurations
 */
const MAP_SIZE_CONFIG = {
  small: {
    nodeCount: 10,
    gridSize: 5,
    maxEdgeDistance: 3,
  },
  large: {
    nodeCount: 100,
    gridSize: 15,
    maxEdgeDistance: 5,
  },
};

/**
 * Generate a deterministic map from a seed
 */
export function generateMap(config: MapConfig): GeneratedMap {
  const rng = new SeededRNG(config.seed);
  const sizeConfig = MAP_SIZE_CONFIG[config.size];
  
  // Generate nodes
  const nodes = generateNodes(rng, sizeConfig.nodeCount, sizeConfig.gridSize);
  
  // Generate edges
  const edges = generateEdges(rng, nodes, sizeConfig.maxEdgeDistance);
  
  return {
    nodes,
    edges,
    seed: config.seed,
  };
}

/**
 * Generate nodes with type distribution and positions
 */
function generateNodes(
  rng: SeededRNG,
  nodeCount: number,
  gridSize: number
): Map<string, Node> {
  const nodes = new Map<string, Node>();
  
  // Determine node type counts based on distribution
  const typeCounts = determineNodeTypeCounts(rng, nodeCount);
  
  // Generate all node types
  const nodeTypes: NodeType[] = [];
  for (const [type, count] of Object.entries(typeCounts)) {
    for (let i = 0; i < count; i++) {
      nodeTypes.push(type as NodeType);
    }
  }
  
  // Shuffle to randomize placement
  const shuffledTypes = rng.shuffle(nodeTypes);
  
  // Generate positions for each node
  const usedPositions = new Set<string>();
  
  for (let i = 0; i < shuffledTypes.length; i++) {
    const type = shuffledTypes[i];
    let position: { x: number; y: number };
    let posKey: string;
    
    // Find unique position
    do {
      position = {
        x: rng.nextFloatRange(0, gridSize),
        y: rng.nextFloatRange(0, gridSize),
      };
      posKey = `${position.x.toFixed(2)},${position.y.toFixed(2)}`;
    } while (usedPositions.has(posKey));
    
    usedPositions.add(posKey);
    
    const node: Node = {
      id: `node_${i}`,
      type,
      position,
      name: generateNodeName(type, i),
    };
    
    nodes.set(node.id, node);
  }
  
  return nodes;
}

/**
 * Determine how many nodes of each type to generate
 */
function determineNodeTypeCounts(
  rng: SeededRNG,
  totalNodes: number
): Record<NodeType, number> {
  const counts: Record<NodeType, number> = {
    restaurant: 0,
    supermarket: 0,
    pharmacy: 0,
    residential: 0,
    office: 0,
    battery_swap: 0,
  };
  
  let remaining = totalNodes;
  const types = Object.keys(NODE_TYPE_DISTRIBUTION) as NodeType[];
  
  // First pass: ensure at least one of each type
  for (const type of types) {
    counts[type] = 1;
    remaining--;
  }
  
  // Second pass: distribute remaining nodes based on distribution
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const dist = NODE_TYPE_DISTRIBUTION[type];
    
    if (i === types.length - 1) {
      // Last type gets all remaining nodes
      counts[type] += remaining;
    } else {
      // Calculate additional count within distribution range
      const minCount = Math.max(0, Math.floor(totalNodes * dist.min) - 1);
      const maxCount = Math.max(0, Math.floor(totalNodes * dist.max) - 1);
      const additionalCount = Math.min(rng.nextInt(minCount, maxCount), remaining);
      counts[type] += additionalCount;
      remaining -= additionalCount;
    }
  }
  
  return counts;
}

/**
 * Generate a name for a node based on its type
 */
function generateNodeName(type: NodeType, index: number): string {
  const names: Record<NodeType, string> = {
    restaurant: '餐厅',
    supermarket: '超市',
    pharmacy: '药店',
    residential: '居民区',
    office: '写字楼',
    battery_swap: '换电站',
  };
  
  return `${names[type]}_${index}`;
}

/**
 * Generate edges connecting nodes using K-nearest neighbors approach
 */
function generateEdges(
  rng: SeededRNG,
  nodes: Map<string, Node>,
  maxEdgeDistance: number
): Edge[] {
  const edges: Edge[] = [];
  const nodeArray = Array.from(nodes.values());
  const edgeSet = new Set<string>();
  
  // For each node, connect to K nearest neighbors
  const K = Math.min(3, nodeArray.length - 1); // Connect to 3 nearest neighbors
  
  for (const node of nodeArray) {
    // Calculate distances to all other nodes
    const distances = nodeArray
      .filter(other => other.id !== node.id)
      .map(other => ({
        node: other,
        distance: calculateEuclideanDistance(node.position, other.position),
      }))
      .sort((a, b) => a.distance - b.distance);
    
    // Connect to K nearest neighbors
    for (let i = 0; i < Math.min(K, distances.length); i++) {
      const target = distances[i].node;
      const distance = distances[i].distance;
      
      // Only create edge if within max distance
      if (distance <= maxEdgeDistance) {
        const edgeKey1 = `${node.id}-${target.id}`;
        const edgeKey2 = `${target.id}-${node.id}`;
        
        // Avoid duplicate edges (undirected graph)
        if (!edgeSet.has(edgeKey1) && !edgeSet.has(edgeKey2)) {
          edgeSet.add(edgeKey1);
          
          const edge: Edge = {
            from: node.id,
            to: target.id,
            distance,
            baseCongestion: rng.nextFloatRange(0.1, 0.3),
          };
          
          edges.push(edge);
        }
      }
    }
  }
  
  // Ensure graph connectivity by adding additional edges if needed
  ensureConnectivity(rng, nodeArray, edges, edgeSet);
  
  return edges;
}

/**
 * Calculate Euclidean distance between two positions
 */
function calculateEuclideanDistance(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number }
): number {
  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Ensure the graph is connected by adding edges between disconnected components
 */
function ensureConnectivity(
  rng: SeededRNG,
  nodes: Node[],
  edges: Edge[],
  edgeSet: Set<string>
): void {
  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) {
    adjacency.set(node.id, new Set());
  }
  
  for (const edge of edges) {
    adjacency.get(edge.from)!.add(edge.to);
    adjacency.get(edge.to)!.add(edge.from);
  }
  
  // Find connected components using BFS
  const visited = new Set<string>();
  const components: string[][] = [];
  
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      const component: string[] = [];
      const queue = [node.id];
      visited.add(node.id);
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        component.push(current);
        
        for (const neighbor of adjacency.get(current)!) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
      
      components.push(component);
    }
  }
  
  // Connect components if there are multiple
  if (components.length > 1) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    for (let i = 1; i < components.length; i++) {
      // Connect component i to component 0
      const comp1 = components[0];
      const comp2 = components[i];
      
      // Find closest pair of nodes between components
      let minDistance = Infinity;
      let bestPair: [string, string] | null = null;
      
      for (const id1 of comp1) {
        for (const id2 of comp2) {
          const node1 = nodeMap.get(id1)!;
          const node2 = nodeMap.get(id2)!;
          const distance = calculateEuclideanDistance(node1.position, node2.position);
          
          if (distance < minDistance) {
            minDistance = distance;
            bestPair = [id1, id2];
          }
        }
      }
      
      if (bestPair) {
        const [id1, id2] = bestPair;
        const edgeKey = `${id1}-${id2}`;
        
        if (!edgeSet.has(edgeKey) && !edgeSet.has(`${id2}-${id1}`)) {
          edgeSet.add(edgeKey);
          edges.push({
            from: id1,
            to: id2,
            distance: minDistance,
            baseCongestion: rng.nextFloatRange(0.1, 0.3),
          });
          
          // Update adjacency
          adjacency.get(id1)!.add(id2);
          adjacency.get(id2)!.add(id1);
        }
      }
    }
  }
}
