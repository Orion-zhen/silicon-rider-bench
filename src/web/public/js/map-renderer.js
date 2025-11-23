/**
 * MapRenderer - Renders the simulation world map with nodes and agent
 * 
 * Performance optimizations:
 * - Uses dirty checking to avoid unnecessary re-renders
 * - Uses requestAnimationFrame for smooth rendering
 */
class MapRenderer {
  constructor(containerElement) {
    this.container = containerElement;
    this.nodes = new Map();
    this.edges = [];
    this.agentPosition = null;
    this.bounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    
    // Dirty checking for rendering optimization
    this.isDirty = false;
    this.renderScheduled = false;
    this.lastAgentPosition = null;
    
    // Agent animation state
    this.agentElement = null;
    this.isAnimating = false;
    this.animationDuration = 800; // ms
    
    // Node type to emoji mapping
    this.NODE_EMOJI_MAP = {
      restaurant: '🍔',
      supermarket: '🛒',
      pharmacy: '💊',
      residential: '🏠',
      office: '🏢',
      battery_swap: '🔋',
    };
  }

  /**
   * Initialize map with nodes and edges data
   */
  initialize(nodes, edges) {
    console.log('[MapRenderer] Initializing with', nodes.length, 'nodes and', edges.length, 'edges');
    
    this.nodes.clear();
    this.edges = edges || [];
    
    // Calculate bounds for coordinate transformation
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    nodes.forEach(node => {
      this.nodes.set(node.id, {
        id: node.id,
        type: node.type,
        name: node.name,
        x: node.position.x,
        y: node.position.y,
        emoji: this.NODE_EMOJI_MAP[node.type] || '❓'
      });
      
      minX = Math.min(minX, node.position.x);
      maxX = Math.max(maxX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxY = Math.max(maxY, node.position.y);
    });
    
    this.bounds = { minX, maxX, minY, maxY };
    console.log('[MapRenderer] Bounds:', this.bounds);
    console.log('[MapRenderer] Container dimensions:', this.container.clientWidth, 'x', this.container.clientHeight);
    
    this.isDirty = true;
    this.scheduleRender();
  }

  /**
   * Update agent position (with animation)
   */
  updateAgentPosition(nodeId) {
    // 只有当位置真正改变时才更新
    if (this.agentPosition !== nodeId) {
      const fromNodeId = this.agentPosition;
      this.agentPosition = nodeId;
      
      // 如果有之前的位置，执行动画
      if (fromNodeId && this.agentElement) {
        this.animateAgentMovement(fromNodeId, nodeId);
      } else {
        // 首次出现或没有动画元素，直接渲染
        this.isDirty = true;
        this.scheduleRender();
      }
    }
  }
  
  /**
   * Find shortest path between two nodes using BFS
   */
  findPath(fromNodeId, toNodeId) {
    if (fromNodeId === toNodeId) {
      return [fromNodeId];
    }
    
    // Build adjacency list from edges
    const adjacency = new Map();
    this.edges.forEach(edge => {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, []);
      }
      if (!adjacency.has(edge.to)) {
        adjacency.set(edge.to, []);
      }
      adjacency.get(edge.from).push(edge.to);
      adjacency.get(edge.to).push(edge.from); // Bidirectional
    });
    
    // BFS to find shortest path
    const queue = [[fromNodeId]];
    const visited = new Set([fromNodeId]);
    
    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      
      if (current === toNodeId) {
        return path;
      }
      
      const neighbors = adjacency.get(current) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      }
    }
    
    // No path found, return direct connection
    console.warn('[MapRenderer] No path found from', fromNodeId, 'to', toNodeId);
    return [fromNodeId, toNodeId];
  }
  
  /**
   * Animate agent movement from one node to another along the path
   */
  animateAgentMovement(fromNodeId, toNodeId) {
    const fromNode = this.nodes.get(fromNodeId);
    const toNode = this.nodes.get(toNodeId);
    
    if (!fromNode || !toNode || !this.agentElement) {
      // 如果节点不存在或没有 agent 元素，直接重新渲染
      this.isDirty = true;
      this.scheduleRender();
      return;
    }
    
    // Find path between nodes
    const path = this.findPath(fromNodeId, toNodeId);
    console.log('[MapRenderer] Animating along path:', path);
    
    // 标记正在动画中
    this.isAnimating = true;
    
    // Animate along the path
    this.animateAlongPath(path, 0);
  }
  
  /**
   * Animate agent along a path of nodes
   */
  animateAlongPath(path, index) {
    if (index >= path.length) {
      // Animation complete
      this.isAnimating = false;
      if (this.agentElement) {
        this.agentElement.style.transition = '';
      }
      return;
    }
    
    const nodeId = path[index];
    const node = this.nodes.get(nodeId);
    
    if (!node || !this.agentElement) {
      this.isAnimating = false;
      return;
    }
    
    const pos = this.worldToScreen(node.x, node.y);
    
    // Calculate duration based on whether this is the first segment
    const segmentDuration = index === 0 ? 0 : this.animationDuration;
    
    if (index === 0) {
      // First node, no animation
      this.agentElement.style.left = `${pos.x}px`;
      this.agentElement.style.top = `${pos.y}px`;
      // Move to next segment immediately
      this.animateAlongPath(path, index + 1);
    } else {
      // Animate to this node
      this.agentElement.style.transition = `left ${segmentDuration}ms linear, top ${segmentDuration}ms linear`;
      this.agentElement.style.left = `${pos.x}px`;
      this.agentElement.style.top = `${pos.y}px`;
      
      // Move to next segment after animation completes
      setTimeout(() => {
        this.animateAlongPath(path, index + 1);
      }, segmentDuration);
    }
  }
  
  /**
   * Schedule a render using requestAnimationFrame
   * Prevents multiple renders in the same frame
   */
  scheduleRender() {
    if (!this.renderScheduled) {
      this.renderScheduled = true;
      requestAnimationFrame(() => {
        if (this.isDirty) {
          this.performRender();
          this.isDirty = false;
        }
        this.renderScheduled = false;
      });
    }
  }

  /**
   * Transform world coordinates to screen coordinates
   */
  worldToScreen(x, y) {
    const padding = 40;
    const width = this.container.clientWidth - padding * 2;
    const height = this.container.clientHeight - padding * 2;
    
    const worldWidth = this.bounds.maxX - this.bounds.minX;
    const worldHeight = this.bounds.maxY - this.bounds.minY;
    
    // Avoid division by zero
    const scaleX = worldWidth > 0 ? width / worldWidth : 1;
    const scaleY = worldHeight > 0 ? height / worldHeight : 1;
    
    // Use the smaller scale to maintain aspect ratio
    const scale = Math.min(scaleX, scaleY);
    
    const screenX = padding + (x - this.bounds.minX) * scale;
    const screenY = padding + (y - this.bounds.minY) * scale;
    
    return { x: screenX, y: screenY };
  }

  /**
   * Public render method (for backward compatibility)
   * Marks as dirty and schedules a render
   */
  render() {
    this.isDirty = true;
    this.scheduleRender();
  }
  
  /**
   * Perform the actual rendering
   * Private method called by scheduleRender
   */
  performRender() {
    console.log('[MapRenderer] Performing render with', this.nodes.size, 'nodes');
    
    // 如果正在动画中，不要清除容器（保留 agent 元素）
    if (!this.isAnimating) {
      this.container.innerHTML = '';
      this.agentElement = null;
    }
    
    // Create SVG for edges (如果不存在)
    let svg = this.container.querySelector('svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '1';
      this.container.appendChild(svg);
      console.log('[MapRenderer] SVG created and appended');
    } else {
      // 清空现有的边
      svg.innerHTML = '';
    }
    
    // Render edges
    this.edges.forEach(edge => {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);
      
      if (fromNode && toNode) {
        const from = this.worldToScreen(fromNode.x, fromNode.y);
        const to = this.worldToScreen(toNode.x, toNode.y);
        
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', from.x);
        line.setAttribute('y1', from.y);
        line.setAttribute('x2', to.x);
        line.setAttribute('y2', to.y);
        line.setAttribute('stroke', '#ddd');
        line.setAttribute('stroke-width', '1');
        svg.appendChild(line);
      }
    });
    
    // Render nodes (如果不在动画中，或者没有现有节点)
    if (!this.isAnimating) {
      let nodeCount = 0;
      this.nodes.forEach(node => {
        const screen = this.worldToScreen(node.x, node.y);
        
        const nodeElement = document.createElement('div');
        nodeElement.className = 'map-node';
        nodeElement.style.position = 'absolute';
        nodeElement.style.left = `${screen.x}px`;
        nodeElement.style.top = `${screen.y}px`;
        nodeElement.style.transform = 'translate(-50%, -50%)';
        nodeElement.style.fontSize = '24px';
        nodeElement.style.cursor = 'pointer';
        nodeElement.style.zIndex = '10';
        nodeElement.title = `${node.name} (${node.type})`;
        
        // Add emoji
        const emoji = document.createElement('span');
        emoji.textContent = node.emoji;
        nodeElement.appendChild(emoji);
        
        this.container.appendChild(nodeElement);
        nodeCount++;
      });
      
      console.log('[MapRenderer] Rendered', nodeCount, 'nodes');
    }
    
    // Render or update agent marker
    if (this.agentPosition) {
      const agentNode = this.nodes.get(this.agentPosition);
      if (agentNode) {
        const screen = this.worldToScreen(agentNode.x, agentNode.y);
        
        if (!this.agentElement) {
          // 创建新的 agent 元素
          this.agentElement = document.createElement('div');
          this.agentElement.className = 'agent-marker';
          this.agentElement.style.position = 'absolute';
          this.agentElement.style.left = `${screen.x}px`;
          this.agentElement.style.top = `${screen.y}px`;
          this.agentElement.style.transform = 'translate(-50%, -50%)';
          this.agentElement.style.fontSize = '32px';
          this.agentElement.style.zIndex = '100';
          this.agentElement.textContent = '🚴';
          this.container.appendChild(this.agentElement);
          console.log('[MapRenderer] Created agent element at', this.agentPosition);
        } else if (!this.isAnimating) {
          // 如果不在动画中，更新位置
          this.agentElement.style.left = `${screen.x}px`;
          this.agentElement.style.top = `${screen.y}px`;
        }
      }
    }
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapRenderer;
}
