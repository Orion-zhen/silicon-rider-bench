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
    this.panelUpdateInterval = null; // Interval for updating panel positions during animation
    
    // Sonar animation queue
    this.sonarQueue = [];
    this.isSonarAnimating = false;
    this.currentSonarWave = null;
    
    // Panel auto-hide duration (10 seconds)
    this.panelAutoHideDuration = 10000;
    
    // Location info panels tracking
    this.locationInfoPanels = new Map(); // locationId -> { panel: element, timer: timeoutId }
    
    // Path animation tracking
    this.pathAnimations = []; // Array of { lines: SVGElement[], panel: element, timer: timeoutId }
    
    // Node type to emoji mapping
    this.NODE_EMOJI_MAP = {
      restaurant: '🍔',
      supermarket: '🛒',
      pharmacy: '💊',
      residential: '🏠',
      office: '🏢',
      battery_swap: '🔋',
    };
    
    // Model name for agent badge
    this.modelName = '';
  }

  /**
   * Set the model name for the agent badge
   * @param {string} modelName - Full model name (e.g., "openai/gpt-4" or "claude-3")
   */
  setModelName(modelName) {
    this.modelName = modelName || '';
    
    // Update existing agent badge if present
    this.updateAgentBadge();
  }

  /**
   * Get the display name for the model (part after "/" if present)
   * @returns {string} Display name
   */
  getModelDisplayName() {
    if (!this.modelName) return '';
    
    const trimmed = this.modelName.trim();
    const slashIndex = trimmed.lastIndexOf('/');
    
    if (slashIndex !== -1 && slashIndex < trimmed.length - 1) {
      return trimmed.substring(slashIndex + 1);
    }
    
    return trimmed;
  }

  /**
   * Update the agent badge with current model name
   */
  updateAgentBadge() {
    if (!this.agentElement) return;
    
    let badge = this.agentElement.querySelector('.agent-model-badge');
    const displayName = this.getModelDisplayName();
    
    if (!displayName) {
      // Remove badge if no model name
      if (badge) {
        badge.remove();
      }
      return;
    }
    
    if (!badge) {
      // Create badge
      badge = document.createElement('div');
      badge.className = 'agent-model-badge';
      this.agentElement.appendChild(badge);
    }
    
    badge.textContent = displayName;
  }

  /**
   * Initialize map with nodes and edges data
   */
  initialize(nodes, edges) {
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
      // Clear the update interval
      if (this.panelUpdateInterval) {
        clearInterval(this.panelUpdateInterval);
        this.panelUpdateInterval = null;
      }
      return;
    }
    
    const nodeId = path[index];
    const node = this.nodes.get(nodeId);
    
    if (!node || !this.agentElement) {
      this.isAnimating = false;
      if (this.panelUpdateInterval) {
        clearInterval(this.panelUpdateInterval);
        this.panelUpdateInterval = null;
      }
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
      
      // Start continuous update interval for action panels
      if (!this.panelUpdateInterval && this.actionPanels.length > 0) {
        this.panelUpdateInterval = setInterval(() => {
          this.updateActionPanelPositions();
        }, 16); // Update every ~16ms (60fps)
      }
      
      // Move to next segment immediately
      this.animateAlongPath(path, index + 1);
    } else {
      // Animate to this node
      this.agentElement.style.transition = `left ${segmentDuration}ms linear, top ${segmentDuration}ms linear`;
      this.agentElement.style.left = `${pos.x}px`;
      this.agentElement.style.top = `${pos.y}px`;
      
      // Ensure update interval is running if we have action panels
      if (!this.panelUpdateInterval && this.actionPanels.length > 0) {
        this.panelUpdateInterval = setInterval(() => {
          this.updateActionPanelPositions();
        }, 16); // Update every ~16ms (60fps)
      }
      
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
    // Use percentage-based padding (8%) to prevent emoji overflow
    const containerSize = Math.min(this.container.clientWidth, this.container.clientHeight);
    const padding = Math.max(40, containerSize * 0.08);
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
      // Try next in queue
      this.processNextSonar();
      return;
    }
    
    const agentNode = this.nodes.get(this.agentPosition);
    if (!agentNode) {
      // Try next in queue
      this.processNextSonar();
      return;
    }
    
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
    
    // Create sonar wave element
    const sonarWave = document.createElement('div');
    sonarWave.className = 'sonar-wave';
    sonarWave.style.left = `${pos.x}px`;
    sonarWave.style.top = `${pos.y}px`;
    
    // Set custom animation with calculated radius
    sonarWave.style.setProperty('--sonar-max-size', `${radiusPixels}px`);
    
    this.container.appendChild(sonarWave);
    
    // Store reference to sonar wave for position updates
    this.currentSonarWave = sonarWave;
    
    // Update sonar position to follow agent element's actual position during movement
    const updateInterval = setInterval(() => {
      if (this.agentElement && sonarWave.parentNode) {
        // Get agent element's current computed position (during animation)
        const agentLeft = parseFloat(this.agentElement.style.left) || pos.x;
        const agentTop = parseFloat(this.agentElement.style.top) || pos.y;
        
        sonarWave.style.left = `${agentLeft}px`;
        sonarWave.style.top = `${agentTop}px`;
      }
    }, 16); // Update every ~16ms (60fps)
    
    // Animation duration: 1.33s (1330ms)
    const animationDuration = 1330;
    
    // Remove after animation completes and process next
    setTimeout(() => {
      clearInterval(updateInterval);
      if (sonarWave.parentNode) {
        sonarWave.parentNode.removeChild(sonarWave);
      }
      this.currentSonarWave = null;
      this.isSonarAnimating = false;
      
      // Execute callback if provided
      if (onComplete && typeof onComplete === 'function') {
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
   * Show critical hit animation near agent (game-style popup)
   * @param {string} emoji - Emoji to display (e.g., "➕🍱", "➖🍱", "➕🔋", "➕📋")
   */
  showCriticalHitAnimation(emoji) {
    console.log('[MapRenderer] 🎯 showCriticalHitAnimation called with emoji:', emoji);
    console.log('[MapRenderer] Container exists:', !!this.container);
    console.log('[MapRenderer] Agent position:', this.agentPosition);
    console.log('[MapRenderer] Agent element exists:', !!this.agentElement);
    
    // If agent element doesn't exist yet, try to get position from agentPosition
    let agentLeft, agentTop;
    
    if (this.agentElement) {
      agentLeft = parseFloat(this.agentElement.style.left);
      agentTop = parseFloat(this.agentElement.style.top);
      console.log('[MapRenderer] ✅ Got position from agent element:', agentLeft, agentTop);
    } else {
      console.log('[MapRenderer] ⚠️  Agent element not available, using fallback');
    }
    
    // Fallback: calculate position from agentPosition node
    if (isNaN(agentLeft) || isNaN(agentTop)) {
      console.log('[MapRenderer] Position is NaN, calculating from node...');
      
      if (!this.agentPosition) {
        console.error('[MapRenderer] ❌ Cannot show critical hit: no agent position');
        return;
      }
      
      const agentNode = this.nodes.get(this.agentPosition);
      if (!agentNode) {
        console.error('[MapRenderer] ❌ Cannot show critical hit: agent node not found for:', this.agentPosition);
        return;
      }
      
      const pos = this.worldToScreen(agentNode.x, agentNode.y);
      agentLeft = pos.x;
      agentTop = pos.y;
      console.log('[MapRenderer] ✅ Calculated position from node:', agentLeft, agentTop, 'node:', agentNode);
    }
    
    // Create critical hit element
    const criticalHit = document.createElement('div');
    criticalHit.className = 'critical-hit-animation';
    criticalHit.textContent = emoji;
    
    // Position at top-left of agent (offset by -30px)
    criticalHit.style.left = `${agentLeft}px`;
    criticalHit.style.top = `${agentTop}px`;
    // Use transform to offset from agent position
    criticalHit.style.transformOrigin = 'center center';
    
    console.log('[MapRenderer] 💥 Critical hit element created:');
    console.log('  - Position:', criticalHit.style.left, criticalHit.style.top);
    console.log('  - Class:', criticalHit.className);
    console.log('  - Content:', criticalHit.textContent);
    console.log('  - Element:', criticalHit);
    
    this.container.appendChild(criticalHit);
    console.log('[MapRenderer] ✅ Critical hit appended to container');
    console.log('  - Container children count:', this.container.children.length);
    console.log('  - Element in DOM:', document.body.contains(criticalHit));
    
    // Remove after animation completes (1.2s)
    setTimeout(() => {
      if (criticalHit.parentNode) {
        criticalHit.parentNode.removeChild(criticalHit);
        console.log('[MapRenderer] 🗑️  Critical hit removed after animation');
      } else {
        console.warn('[MapRenderer] ⚠️  Critical hit already removed from DOM');
      }
    }, 1200);
  }
  
  /**
   * Show action panel near agent (non-blocking, stacks vertically)
   * @param {string} content - Panel content
   * @param {string} type - 'tool-call' or 'conversation'
   */
  showActionPanel(content, type = 'tool-call') {
    if (!this.agentPosition || !this.agentElement) {
      return;
    }
    
    const agentNode = this.nodes.get(this.agentPosition);
    if (!agentNode) {
      return;
    }
    
    const pos = this.worldToScreen(agentNode.x, agentNode.y);
    
    // Make all existing panels of the same type semi-transparent (85%)
    this.actionPanels.forEach(panelData => {
      if (panelData.panel && panelData.type === type) {
        panelData.panel.style.opacity = '0.85';
      }
    });
    
    // Create action panel
    const panel = document.createElement('div');
    panel.className = `action-panel ${type}`;
    panel.style.left = `${pos.x}px`;
    panel.style.top = `${pos.y}px`;
    panel.style.opacity = '1'; // New panel is fully opaque
    
    // Position at bottom (closest to agent) - no offset for first panel
    panel.style.transform = `translate(10px, -100%)`; // Start at bottom position
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'action-panel-content';
    
    // Use innerHTML for tool-call to support badge styling, textContent for conversation for security
    if (type === 'tool-call') {
      contentDiv.innerHTML = content;
    } else {
      contentDiv.textContent = content;
    }
    
    panel.appendChild(contentDiv);
    
    this.container.appendChild(panel);
    
    // Set up auto-hide timer (10 seconds)
    const timer = setTimeout(() => {
      this.removeActionPanel(panel);
    }, this.panelAutoHideDuration);
    
    // Track the panel with its type (insert at beginning so new panels are at index 0)
    this.actionPanels.unshift({ panel, timer, type });
    
    // Update all panel positions after adding new one
    this.updateActionPanelPositions();
  }
  
  /**
   * Remove an action panel
   */
  removeActionPanel(panelElement) {
    const index = this.actionPanels.findIndex(p => p.panel === panelElement);
    if (index !== -1) {
      const panelData = this.actionPanels[index];
      const removedType = panelData.type;
      
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
      
      // If no more action panels, stop the update interval
      if (this.actionPanels.length === 0 && this.panelUpdateInterval) {
        clearInterval(this.panelUpdateInterval);
        this.panelUpdateInterval = null;
      }
      
      // Update opacity: the newest panel of the same type should be fully opaque
      let foundNewest = false;
      for (let i = 0; i < this.actionPanels.length; i++) {
        const pd = this.actionPanels[i];
        if (pd.panel && pd.type === removedType) {
          if (!foundNewest) {
            pd.panel.style.opacity = '1'; // Newest of this type
            foundNewest = true;
          } else {
            pd.panel.style.opacity = '0.85'; // Older panels
          }
        }
      }
      
      // Update positions of remaining panels
      this.updateActionPanelPositions();
    }
  }
  
  /**
   * Update action panel positions when agent moves
   */
  updateActionPanelPositions() {
    if (!this.agentElement || this.actionPanels.length === 0) {
      return;
    }
    
    // Get agent element's current computed position (during animation)
    const agentLeft = parseFloat(this.agentElement.style.left);
    const agentTop = parseFloat(this.agentElement.style.top);
    
    if (isNaN(agentLeft) || isNaN(agentTop)) {
      return;
    }
    
    // Update all action panel positions
    // Index 0 is the newest (bottom, closest to agent)
    // Higher indices are older (stacked upward)
    let cumulativeOffset = 0;
    
    for (let i = 0; i < this.actionPanels.length; i++) {
      const panelData = this.actionPanels[i];
      
      if (panelData.panel) {
        panelData.panel.style.left = `${agentLeft}px`;
        panelData.panel.style.top = `${agentTop}px`;
        panelData.panel.style.transform = `translate(10px, calc(-100% - ${cumulativeOffset}px))`;
        
        // Add this panel's height plus gap for next panel (going upward)
        if (panelData.panel.offsetHeight) {
          cumulativeOffset += panelData.panel.offsetHeight + 10; // 10px gap
        }
      }
    }
  }
  
  /**
   * Show search result panel for a location
   * @param {string} locationId - The location ID
   * @param {string} type - 'order' or 'battery_station'
   * @param {object} data - Panel data (name, locationName, fee, deadline, etc.)
   * @param {number} autoHideDuration - Custom auto-hide duration in ms (optional)
   */
  showSearchResultPanel(locationId, type, data, autoHideDuration) {
    
    // If panel already exists, reset its timer
    if (this.searchPanels.has(locationId)) {
      const panelData = this.searchPanels.get(locationId);
      
      // Clear old timer
      if (panelData.timer) {
        clearTimeout(panelData.timer);
      }
      
      // Use custom duration or default
      const duration = autoHideDuration || this.panelAutoHideDuration;
      
      // Set new timer
      const newTimer = setTimeout(() => {
        this.removePanelById(locationId);
      }, duration);
      
      panelData.timer = newTimer;
      return;
    }
    
    const node = this.nodes.get(locationId);
    if (!node) {
      console.warn('[MapRenderer] Node not found for panel:', locationId);
      return;
    }
    
    const pos = this.worldToScreen(node.x, node.y);
    
    // Create panel element
    const panel = document.createElement('div');
    panel.className = `search-result-panel ${type === 'battery_station' ? 'battery-station' : 'order'}`;
    panel.style.left = `${pos.x}px`;
    panel.style.top = `${pos.y}px`;
    
    // Build panel content
    let content = '';
    
    if (type === 'battery_station') {
      // Battery station panel - only show name
      content = `
        <div class="panel-header">🔋 ${data.name || node.name}</div>
      `;
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
    }
    
    panel.innerHTML = content;
    this.container.appendChild(panel);
    
    // Use custom duration or default
    const duration = autoHideDuration || this.panelAutoHideDuration;
    
    // Set up auto-hide timer
    const timer = setTimeout(() => {
      this.removePanelById(locationId);
    }, duration);
    
    // Track the panel with its timer
    this.searchPanels.set(locationId, { panel, timer });
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
    }
  }
  
  /**
   * Clear all search result panels
   */
  clearSearchPanels() {
    this.searchPanels.forEach((panelData) => {
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
  }
  
  /**
   * Show location info panel at target location (right-top corner with blue border)
   * Multiple panels at same location will stack vertically
   * @param {string} locationId - The location ID
   * @param {object} data - Location data (name, type, position)
   */
  showLocationInfoPanel(locationId, data) {
    const node = this.nodes.get(locationId);
    if (!node) {
      console.warn('[MapRenderer] Node not found for location info panel:', locationId);
      return;
    }
    
    const pos = this.worldToScreen(node.x, node.y);
    
    // Count existing panels at this location to calculate vertical offset
    let panelsAtLocation = 0;
    this.locationInfoPanels.forEach((panelData, id) => {
      if (id.startsWith(locationId + '_')) {
        panelsAtLocation++;
      }
    });
    
    // Generate unique panel ID with index
    const panelId = `${locationId}_${Date.now()}_${panelsAtLocation}`;
    const verticalOffset = panelsAtLocation * 100; // 100px spacing between panels
    
    // Create panel element
    const panel = document.createElement('div');
    panel.className = 'location-info-panel';
    panel.style.left = `${pos.x}px`;
    panel.style.top = `${pos.y}px`;
    panel.style.transform = `translate(10px, calc(-100% - ${verticalOffset}px))`; // Stack vertically
    
    // Build panel content
    const content = `
      <div class="panel-header">📍 ${data.name}</div>
      <div class="panel-content">
        <div class="panel-row">
          <span class="panel-label">类型:</span>
          <span class="panel-value">${data.type}</span>
        </div>
        <div class="panel-row">
          <span class="panel-label">坐标:</span>
          <span class="panel-value">(${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)})</span>
        </div>
      </div>
    `;
    
    panel.innerHTML = content;
    this.container.appendChild(panel);
    
    // Set up auto-hide timer
    const timer = setTimeout(() => {
      this.removeLocationInfoPanel(panelId);
    }, this.panelAutoHideDuration);
    
    // Track the panel with its timer
    this.locationInfoPanels.set(panelId, { panel, timer, locationId });
  }
  
  /**
   * Remove a location info panel by location ID
   */
  removeLocationInfoPanel(locationId) {
    const panelData = this.locationInfoPanels.get(locationId);
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
      this.locationInfoPanels.delete(locationId);
    }
  }
  
  /**
   * Show path animation from start to end with colored line
   * @param {string[]} path - Array of location IDs representing the path
   * @param {string} color - Line color ('green', 'yellow', or 'blue')
   * @param {object} data - Data to show in panel (distance, time, etc.)
   */
  showPathAnimation(path, color, data) {
    if (!path || path.length < 2) {
      console.warn('[MapRenderer] Invalid path for animation');
      return;
    }
    
    // Get or create SVG for path lines
    let svg = this.container.querySelector('svg.path-animation-svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('path-animation-svg');
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '5';
      this.container.appendChild(svg);
    }
    
    // Determine line color
    let lineColor;
    if (color === 'green') {
      lineColor = '#22c55e';
    } else if (color === 'blue') {
      lineColor = '#3b82f6';
    } else {
      lineColor = '#f59e0b'; // yellow
    }
    
    // Create path segments
    const lines = [];
    let totalLength = 0;
    
    for (let i = 0; i < path.length - 1; i++) {
      const fromNode = this.nodes.get(path[i]);
      const toNode = this.nodes.get(path[i + 1]);
      
      if (!fromNode || !toNode) {
        console.warn('[MapRenderer] Node not found in path:', path[i], path[i + 1]);
        continue;
      }
      
      const from = this.worldToScreen(fromNode.x, fromNode.y);
      const to = this.worldToScreen(toNode.x, toNode.y);
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', from.x);
      line.setAttribute('y1', from.y);
      line.setAttribute('x2', to.x);
      line.setAttribute('y2', to.y);
      line.setAttribute('stroke', lineColor);
      line.setAttribute('stroke-width', '4');
      line.setAttribute('stroke-linecap', 'round');
      
      // Calculate line length for animation
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      totalLength += length;
      
      // Set up dash animation
      line.style.strokeDasharray = length;
      line.style.strokeDashoffset = length;
      
      svg.appendChild(line);
      lines.push({ element: line, length });
    }
    
    // Animate lines sequentially
    let currentDelay = 0;
    const segmentDuration = 400; // ms per segment
    
    lines.forEach((lineData, index) => {
      setTimeout(() => {
        lineData.element.style.transition = `stroke-dashoffset ${segmentDuration}ms linear`;
        lineData.element.style.strokeDashoffset = '0';
      }, currentDelay);
      
      currentDelay += segmentDuration;
    });
    
    // Show panel at the end location after animation completes
    const endLocationId = path[path.length - 1];
    const endNode = this.nodes.get(endLocationId);
    
    if (endNode) {
      setTimeout(() => {
        const pos = this.worldToScreen(endNode.x, endNode.y);
        
        // Create panel element
        const panel = document.createElement('div');
        panel.className = `path-result-panel ${color}`;
        panel.style.left = `${pos.x}px`;
        panel.style.top = `${pos.y}px`;
        panel.style.transform = 'translate(10px, -100%)'; // Right-top of end location
        
        // Build panel content
        let content = '<div class="panel-header">';
        if (color === 'green') {
          content += '📏 距离信息';
        } else if (color === 'blue') {
          content += '⏱️ 时间估算';
        } else {
          content += '⏱️ 时间估算'; // yellow - fallback
        }
        content += '</div><div class="panel-content">';
        
        if (data.distance) {
          content += `
            <div class="panel-row">
              <span class="panel-label">距离:</span>
              <span class="panel-value">${data.distance}</span>
            </div>
          `;
        }
        
        if (data.time) {
          content += `
            <div class="panel-row">
              <span class="panel-label">时间:</span>
              <span class="panel-value">${data.time}</span>
            </div>
          `;
        }
        
        content += '</div>';
        panel.innerHTML = content;
        
        this.container.appendChild(panel);
        
        // Set up auto-hide timer (1.5 seconds after animation completes)
        const timer = setTimeout(() => {
          // Remove panel
          if (panel && panel.parentNode) {
            panel.parentNode.removeChild(panel);
          }
          
          // Remove lines
          lines.forEach(lineData => {
            if (lineData.element && lineData.element.parentNode) {
              lineData.element.parentNode.removeChild(lineData.element);
            }
          });
          
          // Remove from tracking
          const index = this.pathAnimations.findIndex(anim => anim.panel === panel);
          if (index !== -1) {
            this.pathAnimations.splice(index, 1);
          }
        }, 1500); // 1.5 seconds
        
        // Track the animation
        this.pathAnimations.push({
          lines: lines.map(l => l.element),
          panel,
          timer
        });
      }, currentDelay);
    }
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
    // 如果正在动画中，不要清除容器（保留 agent 元素和面板）
    if (!this.isAnimating) {
      // 不能直接清空 innerHTML，因为会删除面板
      // 只删除非面板、非 agent 的元素
      const elementsToRemove = [];
      Array.from(this.container.children).forEach(child => {
        // 保留面板、agent 元素、动画元素和 ActionMenu
        // 特别注意：保留 path-animation-svg（路径动画）和 action-menu（操作列表）
        if (!child.classList.contains('search-result-panel') && 
            !child.classList.contains('agent-marker') &&
            !child.classList.contains('sonar-wave') &&
            !child.classList.contains('action-panel') &&
            !child.classList.contains('critical-hit-animation') &&
            !child.classList.contains('location-info-panel') &&
            !child.classList.contains('path-result-panel') &&
            !child.classList.contains('path-animation-svg') &&
            !child.classList.contains('action-menu') &&
            !child.classList.contains('action-submenu')) {
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
    let svg = this.container.querySelector('svg.map-edges-svg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('map-edges-svg');
      svg.style.position = 'absolute';
      svg.style.top = '0';
      svg.style.left = '0';
      svg.style.width = '100%';
      svg.style.height = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex = '1';
      this.container.appendChild(svg);
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
      });
    }
    
    // Render or update agent marker
    if (this.agentPosition) {
      const agentNode = this.nodes.get(this.agentPosition);
      if (agentNode) {
        const screen = this.worldToScreen(agentNode.x, agentNode.y);
        
        if (!this.agentElement) {
          // 创建新的 agent 元素（包含 emoji 和 badge 容器）
          this.agentElement = document.createElement('div');
          this.agentElement.className = 'agent-marker';
          this.agentElement.style.position = 'absolute';
          this.agentElement.style.left = `${screen.x}px`;
          this.agentElement.style.top = `${screen.y}px`;
          this.agentElement.style.zIndex = '100';
          
          // Create emoji element
          const emojiSpan = document.createElement('span');
          emojiSpan.className = 'agent-emoji';
          emojiSpan.textContent = '🛵';
          this.agentElement.appendChild(emojiSpan);
          
          this.container.appendChild(this.agentElement);
          
          // Add model badge if model name is set
          this.updateAgentBadge();
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
