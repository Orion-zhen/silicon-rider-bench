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
   * Update agent position (with dirty checking)
   */
  updateAgentPosition(nodeId) {
    // 只有当位置真正改变时才标记为脏
    if (this.agentPosition !== nodeId) {
      this.agentPosition = nodeId;
      this.isDirty = true;
      this.scheduleRender();
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
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create SVG for edges
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    this.container.appendChild(svg);
    
    console.log('[MapRenderer] SVG created and appended');
    
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
    
    // Render nodes
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
      nodeElement.title = `${node.name} (${node.type})`;
      
      // Add emoji
      const emoji = document.createElement('span');
      emoji.textContent = node.emoji;
      nodeElement.appendChild(emoji);
      
      // Add agent marker if this is the agent's position
      if (this.agentPosition === node.id) {
        const agent = document.createElement('div');
        agent.className = 'agent-marker';
        agent.style.position = 'absolute';
        agent.style.top = '-30px';
        agent.style.left = '50%';
        agent.style.transform = 'translateX(-50%)';
        agent.style.fontSize = '28px';
        agent.textContent = '🚴';
        nodeElement.appendChild(agent);
      }
      
      this.container.appendChild(nodeElement);
      nodeCount++;
    });
    
    console.log('[MapRenderer] Rendered', nodeCount, 'nodes');
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapRenderer;
}
