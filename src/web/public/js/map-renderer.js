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
    
    // Search result panels tracking
    this.searchPanels = new Map(); // locationId -> { panel: element, timer: timeoutId }
    
    // Action panels tracking (follows agent)
    this.actionPanels = []; // Array of { panel: element, timer: timeoutId }
    this.actionPanelQueue = []; // Queue for sequential display
    this.isShowingActionPanel = false;
    
    // Sonar animation queue
    this.sonarQueue = [];
    this.isSonarAnimating = false;
    
    // Panel auto-hide duration (10 seconds)
    this.panelAutoHideDuration = 10000;
    
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
        // Use emoji from backend if available, otherwise fallback to default
        emoji: node.emoji || this.NODE_EMOJI_MAP[node.type] || '❓'
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
      
      // 不再在移动时清除面板，让它们自动过期
      // this.clearSearchPanels();
      
      // Update action panel positions
      this.updateActionPanelPositions();
      
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
      
      // Update action panel positions
      this.updateActionPanelPositions();
      
      // Move to next segment immediately
      this.animateAlongPath(path, index + 1);
    } else {
      // Animate to this node
      this.agentElement.style.transition = `left ${segmentDuration}ms linear, top ${segmentDuration}ms linear`;
      this.agentElement.style.left = `${pos.x}px`;
      this.agentElement.style.top = `${pos.y}px`;
      
      // Update action panel positions (they will follow with transition)
      this.updateActionPanelPositions();
      
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
   * Show sonar animation from agent position (queued)
   * Adds animation to queue to ensure sequential playback
   * @param {number} radiusKm - Search radius in kilometers (optional)
   * @param {Function} onComplete - Callback function to execute after animation completes
   */
  showSonarAnimation(radiusKm, onComplete) {
    console.log('[MapRenderer] showSonarAnimation called with radius:', radiusKm, 'km');
    this.sonarQueue.push({ radiusKm: radiusKm || 10, onComplete });
    this.processNextSonar();
  }
  
  /**
   * Process next sonar animation in queue
   */
  processNextSonar() {
    // If already animating or queue is empty, return
    if (this.isSonarAnimating || this.sonarQueue.length === 0) {
      return;
    }
    
    // Remove from queue
    const sonarData = this.sonarQueue.shift();
    const radiusKm = sonarData.radiusKm;
    const onComplete = sonarData.onComplete;
    
    if (!this.agentPosition || !this.agentElement) {
      console.log('[MapRenderer] Cannot show sonar: no agent position or element');
      // Try next in queue
      this.processNextSonar();
      return;
    }
    
    const agentNode = this.nodes.get(this.agentPosition);
    if (!agentNode) {
      console.log('[MapRenderer] Cannot show sonar: agent node not found');
      // Try next in queue
      this.processNextSonar();
      return;
    }
    
    console.log('[MapRenderer] Starting sonar animation with radius:', radiusKm, 'km');
    this.isSonarAnimating = true;
    
    const pos = this.worldToScreen(agentNode.x, agentNode.y);
    
    // Calculate sonar radius in pixels based on world coordinates
    // Map is 20km x 20km, world coordinates go from bounds.minX to bounds.maxX
    const worldWidth = this.bounds.maxX - this.bounds.minX;
    const worldHeight = this.bounds.maxY - this.bounds.minY;
    
    // Assuming world coordinates represent kilometers (20km map)
    const kmPerWorldUnit = 20 / Math.max(worldWidth, worldHeight);
    const worldRadius = radiusKm / kmPerWorldUnit;
    
    // Convert world radius to screen pixels
    const padding = 40;
    const screenWidth = this.container.clientWidth - padding * 2;
    const screenHeight = this.container.clientHeight - padding * 2;
    const scaleX = worldWidth > 0 ? screenWidth / worldWidth : 1;
    const scaleY = worldHeight > 0 ? screenHeight / worldHeight : 1;
    const scale = Math.min(scaleX, scaleY);
    
    const radiusPixels = worldRadius * scale * 2 * 1.2; // Diameter + 20% increase
    
    console.log('[MapRenderer] Sonar animation details:');
    console.log('  - World radius:', worldRadius, 'units');
    console.log('  - Screen radius:', radiusPixels, 'pixels (with 20% increase)');
    console.log('  - Scale:', scale);
    
    // Create sonar wave element
    const sonarWave = document.createElement('div');
    sonarWave.className = 'sonar-wave';
    sonarWave.style.left = `${pos.x}px`;
    sonarWave.style.top = `${pos.y}px`;
    
    // Set custom animation with calculated radius
    sonarWave.style.setProperty('--sonar-max-size', `${radiusPixels}px`);
    
    this.container.appendChild(sonarWave);
    console.log('[MapRenderer] Sonar wave element created and appended');
    
    // Animation duration: 1.33s (1330ms)
    const animationDuration = 1330;
    
    // Remove after animation completes and process next
    setTimeout(() => {
      if (sonarWave.parentNode) {
        sonarWave.parentNode.removeChild(sonarWave);
      }
      console.log('[MapRenderer] Sonar animation completed');
      this.isSonarAnimating = false;
      
      // Execute callback if provided
      if (onComplete && typeof onComplete === 'function') {
        console.log('[MapRenderer] Executing onComplete callback');
        onComplete();
      }
      
      // Process next sonar in queue after a small delay
      setTimeout(() => {
        this.processNextSonar();
      }, 300); // 300ms delay between animations
    }, animationDuration);
  }
  
  /**
   * Calculate distance from agent to a location
   * @param {string} locationId - The location ID
   * @returns {number} - Distance in world units
   */
  calculateDistanceToAgent(locationId) {
    if (!this.agentPosition) {
      return Infinity;
    }
    
    const agentNode = this.nodes.get(this.agentPosition);
    const targetNode = this.nodes.get(locationId);
    
    if (!agentNode || !targetNode) {
      return Infinity;
    }
    
    // Calculate Euclidean distance
    const dx = targetNode.x - agentNode.x;
    const dy = targetNode.y - agentNode.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance;
  }
  
  /**
   * Show action panel near agent (queued for sequential display)
   * @param {string} content - Panel content
   * @param {string} type - 'tool-call' or 'conversation'
   */
  showActionPanel(content, type = 'tool-call') {
    console.log('[MapRenderer] Queueing action panel:', content, type);
    this.actionPanelQueue.push({ content, type });
    this.processNextActionPanel();
  }
  
  /**
   * Process next action panel in queue
   */
  processNextActionPanel() {
    // If already showing a panel or queue is empty, return
    if (this.isShowingActionPanel || this.actionPanelQueue.length === 0) {
      return;
    }
    
    const panelData = this.actionPanelQueue.shift();
    this.isShowingActionPanel = true;
    
    console.log('[MapRenderer] Showing action panel:', panelData.content);
    
    if (!this.agentPosition || !this.agentElement) {
      console.warn('[MapRenderer] Cannot show action panel: no agent');
      this.isShowingActionPanel = false;
      this.processNextActionPanel();
      return;
    }
    
    const agentNode = this.nodes.get(this.agentPosition);
    if (!agentNode) {
      console.warn('[MapRenderer] Cannot show action panel: agent node not found');
      this.isShowingActionPanel = false;
      this.processNextActionPanel();
      return;
    }
    
    const pos = this.worldToScreen(agentNode.x, agentNode.y);
    
    // Create action panel
    const panel = document.createElement('div');
    panel.className = `action-panel ${panelData.type}`;
    panel.style.left = `${pos.x}px`;
    panel.style.top = `${pos.y}px`;
    panel.style.transform = 'translate(10px, -100%)'; // Right-top of agent
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'action-panel-content';
    contentDiv.textContent = panelData.content;
    panel.appendChild(contentDiv);
    
    this.container.appendChild(panel);
    
    // Set up auto-hide timer (10 seconds)
    const timer = setTimeout(() => {
      console.log('[MapRenderer] Auto-hiding action panel');
      this.removeActionPanel(panel);
      
      // Wait 1 second before showing next panel
      setTimeout(() => {
        this.isShowingActionPanel = false;
        this.processNextActionPanel();
      }, 1000);
    }, this.panelAutoHideDuration);
    
    // Track the panel
    this.actionPanels.push({ panel, timer });
    console.log('[MapRenderer] Action panel created and tracked');
  }
  
  /**
   * Remove an action panel
   */
  removeActionPanel(panelElement) {
    const index = this.actionPanels.findIndex(p => p.panel === panelElement);
    if (index !== -1) {
      const panelData = this.actionPanels[index];
      
      // Clear timer
      if (panelData.timer) {
        clearTimeout(panelData.timer);
      }
      
      // Remove from DOM
      if (panelData.panel && panelData.panel.parentNode) {
        panelData.panel.parentNode.removeChild(panelData.panel);
      }
      
      // Remove from tracking
      this.actionPanels.splice(index, 1);
      console.log('[MapRenderer] Action panel removed');
    }
  }
  
  /**
   * Update action panel positions when agent moves
   */
  updateActionPanelPositions() {
    if (!this.agentPosition || this.actionPanels.length === 0) {
      return;
    }
    
    const agentNode = this.nodes.get(this.agentPosition);
    if (!agentNode) {
      return;
    }
    
    const pos = this.worldToScreen(agentNode.x, agentNode.y);
    
    // Update all action panel positions
    this.actionPanels.forEach(panelData => {
      if (panelData.panel) {
        panelData.panel.style.left = `${pos.x}px`;
        panelData.panel.style.top = `${pos.y}px`;
      }
    });
  }
  
  /**
   * Show search result panel for a location
   * @param {string} locationId - The location ID
   * @param {string} type - 'order' or 'battery_station'
   * @param {object} data - Panel data (name, locationName, fee, deadline, etc.)
   * @param {number} autoHideDuration - Custom auto-hide duration in ms (optional)
   */
  showSearchResultPanel(locationId, type, data, autoHideDuration) {
    console.log('[MapRenderer] showSearchResultPanel called');
    console.log('[MapRenderer] locationId:', locationId);
    console.log('[MapRenderer] type:', type);
    console.log('[MapRenderer] data:', data);
    console.log('[MapRenderer] Current panels count:', this.searchPanels.size);
    
    // If panel already exists, reset its timer
    if (this.searchPanels.has(locationId)) {
      console.log('[MapRenderer] Panel already exists for', locationId, '- resetting timer');
      const panelData = this.searchPanels.get(locationId);
      
      // Clear old timer
      if (panelData.timer) {
        clearTimeout(panelData.timer);
      }
      
      // Use custom duration or default
      const duration = autoHideDuration || this.panelAutoHideDuration;
      
      // Set new timer
      const newTimer = setTimeout(() => {
        console.log('[MapRenderer] Auto-hiding panel for', locationId, 'after', duration / 1000, 'seconds');
        this.removePanelById(locationId);
      }, duration);
      
      panelData.timer = newTimer;
      console.log('[MapRenderer] Timer reset for existing panel with', duration / 1000, 's duration');
      return;
    }
    
    console.log('[MapRenderer] Looking for node:', locationId);
    console.log('[MapRenderer] Available nodes:', Array.from(this.nodes.keys()));
    
    const node = this.nodes.get(locationId);
    if (!node) {
      console.warn('[MapRenderer] Node not found for panel:', locationId);
      console.warn('[MapRenderer] Available nodes count:', this.nodes.size);
      return;
    }
    
    console.log('[MapRenderer] Found node:', node);
    
    const pos = this.worldToScreen(node.x, node.y);
    console.log('[MapRenderer] Screen position:', pos);
    
    // Create panel element
    const panel = document.createElement('div');
    panel.className = `search-result-panel ${type === 'battery_station' ? 'battery-station' : 'order'}`;
    panel.style.left = `${pos.x}px`;
    panel.style.top = `${pos.y}px`;
    
    console.log('[MapRenderer] Panel element created with class:', panel.className);
    console.log('[MapRenderer] Panel position:', panel.style.left, panel.style.top);
    
    // Build panel content
    let content = '';
    
    if (type === 'battery_station') {
      // Battery station panel - only show name
      content = `
        <div class="panel-header">🔋 ${data.name || node.name}</div>
      `;
      console.log('[MapRenderer] Battery station panel content created');
    } else if (type === 'order') {
      // Order panel - show location name, dish name, fee, deadline
      const locationName = node.name; // 地点名称
      const dishName = data.locationName || '未知菜品'; // 菜品名称
      
      // Format delivery fee to 2 decimal places
      const deliveryFee = typeof data.deliveryFee === 'number' 
        ? data.deliveryFee.toFixed(2) 
        : '0.00';
      
      content = `
        <div class="panel-header">📦 ${locationName}</div>
        <div class="panel-content">
          <div class="panel-row">
            <span class="panel-label">菜品:</span>
            <span class="panel-value">${dishName}</span>
          </div>
          <div class="panel-row">
            <span class="panel-label">配送费:</span>
            <span class="panel-value">¥${deliveryFee}</span>
          </div>
          <div class="panel-row">
            <span class="panel-label">时限:</span>
            <span class="panel-value">${data.deadline || 'N/A'}</span>
          </div>
        </div>
      `;
      console.log('[MapRenderer] Order panel content created');
      console.log('[MapRenderer] Location name:', locationName);
      console.log('[MapRenderer] Dish name:', dishName);
      console.log('[MapRenderer] Delivery fee (formatted):', deliveryFee);
    }
    
    panel.innerHTML = content;
    console.log('[MapRenderer] Panel innerHTML set');
    
    console.log('[MapRenderer] Container element:', this.container);
    console.log('[MapRenderer] Container children before append:', this.container.children.length);
    
    this.container.appendChild(panel);
    console.log('[MapRenderer] Panel appended to container');
    console.log('[MapRenderer] Container children after append:', this.container.children.length);
    
    // Use custom duration or default
    const duration = autoHideDuration || this.panelAutoHideDuration;
    
    // Set up auto-hide timer
    const timer = setTimeout(() => {
      console.log('[MapRenderer] Auto-hiding panel for', locationId, 'after', duration / 1000, 'seconds');
      this.removePanelById(locationId);
    }, duration);
    
    // Track the panel with its timer
    this.searchPanels.set(locationId, { panel, timer });
    console.log('[MapRenderer] Panel tracked in searchPanels map with', duration / 1000, 's auto-hide timer');
    console.log('[MapRenderer] New panels count:', this.searchPanels.size);
    
    console.log('[MapRenderer] ✅ Successfully created search result panel for', locationId, type);
  }
  
  /**
   * Remove a specific panel by location ID
   */
  removePanelById(locationId) {
    const panelData = this.searchPanels.get(locationId);
    if (panelData) {
      // Clear the timer
      if (panelData.timer) {
        clearTimeout(panelData.timer);
      }
      
      // Remove the panel element
      if (panelData.panel && panelData.panel.parentNode) {
        panelData.panel.parentNode.removeChild(panelData.panel);
      }
      
      // Remove from tracking
      this.searchPanels.delete(locationId);
      console.log('[MapRenderer] Removed panel for', locationId);
    }
  }
  
  /**
   * Clear all search result panels
   */
  clearSearchPanels() {
    this.searchPanels.forEach((panelData, locationId) => {
      // Clear the timer
      if (panelData.timer) {
        clearTimeout(panelData.timer);
      }
      
      // Remove the panel element
      if (panelData.panel && panelData.panel.parentNode) {
        panelData.panel.parentNode.removeChild(panelData.panel);
      }
    });
    this.searchPanels.clear();
    console.log('[MapRenderer] Cleared all search result panels');
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
    
    // 如果正在动画中，不要清除容器（保留 agent 元素和面板）
    if (!this.isAnimating) {
      // 不能直接清空 innerHTML，因为会删除面板
      // 只删除非面板、非 agent 的元素
      const elementsToRemove = [];
      Array.from(this.container.children).forEach(child => {
        // 保留面板和 agent 元素
        if (!child.classList.contains('search-result-panel') && 
            !child.classList.contains('agent-marker') &&
            !child.classList.contains('sonar-wave') &&
            !child.classList.contains('action-panel')) {
          elementsToRemove.push(child);
        }
      });
      elementsToRemove.forEach(el => el.remove());
      
      // 如果没有 agent 元素，重置引用
      if (!this.container.querySelector('.agent-marker')) {
        this.agentElement = null;
      }
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
          this.agentElement.style.transform = 'translate(-50%, -50%) scale(1.5)';
          this.agentElement.style.fontSize = '32px';
          this.agentElement.style.zIndex = '100';
          this.agentElement.textContent = '🛵';
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
