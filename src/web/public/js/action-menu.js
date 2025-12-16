/**
 * ActionMenu - Context menu style action list that follows the agent
 * 
 * Features:
 * - Follows agent emoji position
 * - Shows action list: Thinking, Message, Tool (with slot machine effect), Result
 * - Highlights current action with pulse effect
 * - Submenu displays action details (content, arguments, results)
 * - Tool name scrolls like a slot machine when called
 */

class ActionMenu {
  constructor(containerElement, mapRenderer, agentId = null) {
    this.container = containerElement;
    this.mapRenderer = mapRenderer;
    this.agentId = agentId; // Which agent to follow (null = first agent)
    this.menuElement = null;
    this.submenuElement = null;
    this.toolLabelElement = null;
    
    // State
    this.tools = [];
    this.currentAction = null;
    this.currentToolName = null;
    this.displayMode = 'brief'; // 'off', 'brief', 'full'
    
    // Position update interval
    this.positionUpdateInterval = null;
    
    // Submenu auto-hide timer
    this.submenuHideTimer = null;
    
    // Highlight auto-hide timer
    this.highlightHideTimer = null;
    
    // Slot machine animation state
    this.isSlotAnimating = false;
    this.slotAnimationTimer = null;
    
    // Minimum display duration (2 seconds)
    this.minDisplayDuration = 2000;
    
    // Initialize
    this.initialize();
    this.fetchTools();
  }
  
  /**
   * Initialize the action menu
   */
  initialize() {
    // Create menu element
    this.menuElement = document.createElement('div');
    this.menuElement.className = 'action-menu';
    this.menuElement.innerHTML = this.renderMenuHTML();
    // Start hidden until agent element is available
    this.menuElement.style.opacity = '0';
    this.menuElement.style.transition = 'opacity 0.3s ease';
    this.container.appendChild(this.menuElement);
    
    // Create submenu element
    this.submenuElement = document.createElement('div');
    this.submenuElement.className = 'action-submenu';
    this.submenuElement.style.display = 'none';
    this.container.appendChild(this.submenuElement);
    
    // Cache elements
    this.toolLabelElement = this.menuElement.querySelector('.action-tool-label');
    this.thinkingMarquee = this.menuElement.querySelector('.thinking-marquee');
    this.messageMarquee = this.menuElement.querySelector('.message-marquee');
    
    // Start position tracking
    this.startPositionTracking();
  }
  
  /**
   * Render menu HTML - Flat structure with tool name in main list
   */
  renderMenuHTML() {
    return `
      <div class="action-menu-items">
        <div class="action-menu-item" data-action="thinking">
          <span class="action-icon">💭</span>
          <span class="action-label">思考</span>
          <span class="action-marquee-container">
            <span class="action-marquee thinking-marquee"></span>
          </span>
        </div>
        <div class="action-menu-item" data-action="message">
          <span class="action-icon">💬</span>
          <span class="action-label">消息</span>
          <span class="action-marquee-container">
            <span class="action-marquee message-marquee"></span>
          </span>
        </div>
        <div class="action-menu-item" data-action="tool">
          <span class="action-icon">🔧</span>
          <span class="action-label action-tool-label">工具</span>
        </div>
        <div class="action-menu-item" data-action="result">
          <span class="action-icon">✓</span>
          <span class="action-label">结果</span>
        </div>
      </div>
    `;
  }
  
  /**
   * Fetch tools list from API
   */
  async fetchTools() {
    try {
      const response = await fetch('/api/tools');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success && Array.isArray(data.tools)) {
        this.tools = data.tools;
      }
    } catch (error) {
      console.error('[ActionMenu] Failed to fetch tools:', error);
    }
  }
  
  /**
   * Get display name for tool
   * @param {string} toolName
   * @returns {string}
   */
  getToolDisplayName(toolName) {
    const displayNames = {
      'get_my_status': '查询状态',
      'get_map': '获取地图',
      'search_nearby_orders': '搜索订单',
      'search_nearby_battery_stations': '搜索换电站',
      'accept_order': '接受订单',
      'move_to': '移动',
      'pickup_food': '取餐',
      'pickup_food_by_phone_number': '凭手机号取餐',
      'deliver_food': '送餐',
      'swap_battery': '换电',
      'get_location_info': '位置信息',
      'calculate_distance': '计算距离',
      'estimate_time': '估算时间',
      'wait': '等待',
      'help': '帮助',
      'get_receipts': '获取小票',
    };
    
    return displayNames[toolName] || toolName;
  }
  
  /**
   * Get full tool display text (Chinese name + English function name)
   * @param {string} toolName
   * @returns {string}
   */
  getToolFullDisplay(toolName) {
    const chineseName = this.getToolDisplayName(toolName);
    return `${chineseName} ${toolName}()`;
  }
  
  /**
   * Truncate text to specified length
   * @param {string} text
   * @param {number} maxLength
   * @returns {string}
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  }
  
  /**
   * Start position tracking
   */
  startPositionTracking() {
    // Update position every 50ms
    this.positionUpdateInterval = setInterval(() => {
      this.updatePosition();
    }, 50);
    
    // Initial position update (with retry if agentElement not ready)
    this.waitForAgentElement();
  }
  
  /**
   * Wait for agent element to be available, then update position
   */
  waitForAgentElement() {
    // Check for multi-agent mode first
    if (this.mapRenderer && this.mapRenderer.isMultiAgentMode && this.mapRenderer.agentElements.size > 0) {
      // Check if our target agent has a valid element
      let hasValidAgent = false;
      if (this.agentId && this.mapRenderer.agentElements.has(this.agentId)) {
        const data = this.mapRenderer.agentElements.get(this.agentId);
        hasValidAgent = !!data.element;
      } else {
        // No specific agentId, check first agent
        for (const [id, data] of this.mapRenderer.agentElements) {
          if (data.element) {
            hasValidAgent = true;
            break;
          }
        }
      }
      if (hasValidAgent) {
        this.updatePosition();
        this.menuElement.style.opacity = '1';
        return;
      }
    }
    
    // Single agent mode
    if (this.mapRenderer && this.mapRenderer.agentElement) {
      this.updatePosition();
      // Show menu once agent is available
      this.menuElement.style.opacity = '1';
    } else {
      // Retry after a short delay
      setTimeout(() => this.waitForAgentElement(), 100);
    }
  }
  
  /**
   * Update menu position to follow agent
   * Menu's bottom-left corner aligns with agent position (menu appears at top-right of agent)
   */
  updatePosition() {
    if (!this.mapRenderer) {
      return;
    }
    
    // Try to get position from agentElement first
    let agentLeft, agentTop;
    
    // Multi-agent mode: get position from specific agent or first agent
    if (this.mapRenderer.isMultiAgentMode && this.mapRenderer.agentElements.size > 0) {
      // Try to get specific agent by agentId
      if (this.agentId && this.mapRenderer.agentElements.has(this.agentId)) {
        const data = this.mapRenderer.agentElements.get(this.agentId);
        if (data.element) {
          agentLeft = parseFloat(data.element.style.left);
          agentTop = parseFloat(data.element.style.top);
        }
        // Fallback: calculate from node position
        if ((isNaN(agentLeft) || isNaN(agentTop)) && data.position) {
          const agentNode = this.mapRenderer.nodes.get(data.position);
          if (agentNode) {
            const pos = this.mapRenderer.worldToScreen(agentNode.x, agentNode.y);
            agentLeft = pos.x;
            agentTop = pos.y;
          }
        }
      } else {
        // No specific agentId, use first agent
        for (const [id, data] of this.mapRenderer.agentElements) {
          if (data.element) {
            agentLeft = parseFloat(data.element.style.left);
            agentTop = parseFloat(data.element.style.top);
            if (!isNaN(agentLeft) && !isNaN(agentTop)) {
              break;
            }
          }
        }
        
        // Fallback: calculate from node position
        if (isNaN(agentLeft) || isNaN(agentTop)) {
          for (const [id, data] of this.mapRenderer.agentElements) {
            if (data.position) {
              const agentNode = this.mapRenderer.nodes.get(data.position);
              if (agentNode) {
                const pos = this.mapRenderer.worldToScreen(agentNode.x, agentNode.y);
                agentLeft = pos.x;
                agentTop = pos.y;
                break;
              }
            }
          }
        }
      }
    } else if (this.mapRenderer.agentElement) {
      // Single agent mode
      agentLeft = parseFloat(this.mapRenderer.agentElement.style.left);
      agentTop = parseFloat(this.mapRenderer.agentElement.style.top);
    }
    
    // Fallback: calculate from agentPosition if agentElement position is invalid
    if ((isNaN(agentLeft) || isNaN(agentTop)) && this.mapRenderer.agentPosition) {
      const agentNode = this.mapRenderer.nodes.get(this.mapRenderer.agentPosition);
      if (agentNode) {
        const pos = this.mapRenderer.worldToScreen(agentNode.x, agentNode.y);
        agentLeft = pos.x;
        agentTop = pos.y;
      }
    }
    
    if (isNaN(agentLeft) || isNaN(agentTop)) {
      return;
    }
    
    // Get menu height for bottom-left alignment
    const menuHeight = this.menuElement.offsetHeight || 150;
    
    // Position menu so its bottom-left corner is at the agent position (top-right of agent)
    const menuOffsetX = 30; // pixels to the right
    const menuOffsetY = -10; // small offset up from agent center
    
    this.menuElement.style.left = `${agentLeft + menuOffsetX}px`;
    this.menuElement.style.top = `${agentTop - menuHeight + menuOffsetY}px`;
    
    // Position submenu based on menu position
    if (this.submenuElement.style.display !== 'none') {
      this.updateSubmenuPosition();
    }
  }
  
  /**
   * Update submenu position
   */
  updateSubmenuPosition() {
    const menuRect = this.menuElement.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();
    
    // Position submenu to the right of the menu
    const submenuLeft = menuRect.right - containerRect.left + 5;
    const submenuTop = menuRect.top - containerRect.top;
    
    this.submenuElement.style.left = `${submenuLeft}px`;
    this.submenuElement.style.top = `${submenuTop}px`;
  }
  
  /**
   * Play slot machine animation for tool name
   * @param {string} targetToolName - The final tool name to display
   * @param {Function} onComplete - Callback when animation completes
   */
  playSlotMachineAnimation(targetToolName, onComplete) {
    if (!this.toolLabelElement || this.tools.length === 0) {
      // No tools loaded, just show target directly
      if (this.toolLabelElement) {
        this.toolLabelElement.textContent = this.getToolFullDisplay(targetToolName);
        this.toolLabelElement.classList.add('slot-selected');
      }
      if (onComplete) onComplete();
      return;
    }
    
    this.isSlotAnimating = true;
    
    // Remove selected class and add animating class (gray color during spin)
    this.toolLabelElement.classList.remove('slot-selected');
    this.toolLabelElement.classList.add('slot-animating');
    
    // Get random tools for the spinning effect
    const toolNames = this.tools.map(t => t.name);
    let spinCount = 0;
    const totalSpins = 10; // Number of spins before stopping
    const spinInterval = 40; // ms between each spin (fast start)
    
    const spin = () => {
      if (spinCount < totalSpins) {
        // Show random tool name
        const randomIndex = Math.floor(Math.random() * toolNames.length);
        const randomTool = toolNames[randomIndex];
        this.toolLabelElement.textContent = this.getToolFullDisplay(randomTool);
        spinCount++;
        
        // Slow down as we approach the end (exponential slowdown)
        const delay = spinInterval + (spinCount * spinCount * 3);
        this.slotAnimationTimer = setTimeout(spin, delay);
      } else {
        // Final: show target tool with selected style (purple color)
        this.toolLabelElement.textContent = this.getToolFullDisplay(targetToolName);
        this.toolLabelElement.classList.remove('slot-animating');
        this.toolLabelElement.classList.add('slot-selected');
        this.isSlotAnimating = false;
        
        if (onComplete) onComplete();
      }
    };
    
    // Start spinning
    spin();
  }
  
  /**
   * Reset tool label to default
   */
  resetToolLabel() {
    if (this.toolLabelElement) {
      this.toolLabelElement.textContent = '工具';
      this.toolLabelElement.classList.remove('slot-animating');
      this.toolLabelElement.classList.remove('slot-selected');
    }
  }
  
  /**
   * Highlight an action
   * @param {string} action - 'thinking', 'message', 'tool', 'result'
   * @param {string} toolName - Tool name (for 'tool' action)
   * @param {string} content - Content to display in marquee (for thinking/message)
   */
  highlightAction(action, toolName = null, content = null) {
    // Clear previous highlight timer
    if (this.highlightHideTimer) {
      clearTimeout(this.highlightHideTimer);
      this.highlightHideTimer = null;
    }
    
    // Remove previous highlight from menu items
    const items = this.menuElement.querySelectorAll('.action-menu-item');
    items.forEach(item => item.classList.remove('active'));
    
    // Add new highlight
    const targetItem = this.menuElement.querySelector(`.action-menu-item[data-action="${action}"]`);
    if (targetItem) {
      targetItem.classList.add('active');
    }
    
    // If tool action, play slot machine animation
    if (action === 'tool' && toolName) {
      this.currentToolName = toolName;
      
      // Cancel previous slot animation if running
      if (this.slotAnimationTimer) {
        clearTimeout(this.slotAnimationTimer);
        this.slotAnimationTimer = null;
      }
      
      // Play slot machine animation - highlight stays until next tool call
      this.playSlotMachineAnimation(toolName);
    } else if (action === 'thinking' && content) {
      // Update thinking marquee
      this.updateMarquee('thinking', content);
      
      // For non-tool actions, set timer to remove highlight after minimum duration
      this.highlightHideTimer = setTimeout(() => {
        if (targetItem) {
          targetItem.classList.remove('active');
        }
      }, this.minDisplayDuration);
    } else if (action === 'message' && content) {
      // Update message marquee
      this.updateMarquee('message', content);
      
      // For non-tool actions, set timer to remove highlight after minimum duration
      this.highlightHideTimer = setTimeout(() => {
        if (targetItem) {
          targetItem.classList.remove('active');
        }
      }, this.minDisplayDuration);
    } else {
      // For other actions, set timer to remove highlight after minimum duration
      this.highlightHideTimer = setTimeout(() => {
        if (targetItem) {
          targetItem.classList.remove('active');
        }
      }, this.minDisplayDuration);
    }
    
    this.currentAction = action;
  }
  
  /**
   * Update marquee content for thinking or message
   * @param {string} type - 'thinking' or 'message'
   * @param {string} content - Content to display
   */
  updateMarquee(type, content) {
    const marqueeElement = type === 'thinking' ? this.thinkingMarquee : this.messageMarquee;
    if (!marqueeElement) return;
    
    // Clean content - remove extra whitespace and newlines
    const cleanContent = content.replace(/\s+/g, ' ').trim();
    
    // Set content and restart animation
    marqueeElement.textContent = cleanContent;
    marqueeElement.classList.remove('scrolling');
    
    // Calculate animation duration based on content length
    // Max speed: 20 characters per second
    // The marquee needs to scroll: container width (20ch) + content length
    // So total distance in characters is roughly: 20 + content.length
    const maxCharsPerSecond = 10;
    const containerWidthChars = 20; // .action-marquee-container width is 20ch
    const totalScrollChars = containerWidthChars + cleanContent.length;
    const animationDuration = Math.max(2, totalScrollChars / maxCharsPerSecond); // minimum 2 seconds
    
    // Set custom animation duration
    marqueeElement.style.animationDuration = `${animationDuration}s`;
    
    // Force reflow to restart animation
    void marqueeElement.offsetWidth;
    marqueeElement.classList.add('scrolling');
  }
  
  /**
   * Show submenu with content
   * @param {string} action - Action type
   * @param {Object} data - Action data
   */
  showSubmenu(action, data) {
    if (this.displayMode === 'off') {
      this.submenuElement.style.display = 'none';
      return;
    }
    
    // Clear previous auto-hide timer
    if (this.submenuHideTimer) {
      clearTimeout(this.submenuHideTimer);
      this.submenuHideTimer = null;
    }
    
    let content = '';
    let title = '';
    
    switch (action) {
      case 'thinking':
        title = '💭 思考';
        content = this.formatThinkingContent(data);
        break;
        
      case 'message':
        title = '💬 消息';
        content = this.formatMessageContent(data);
        break;
        
      case 'tool':
        title = `🔧 ${this.getToolDisplayName(data.toolName)}`;
        content = this.formatToolContent(data);
        break;
        
      case 'result':
        title = data.success ? '✓ 成功' : '✗ 失败';
        content = this.formatResultContent(data);
        break;
        
      default:
        return;
    }
    
    this.submenuElement.innerHTML = `
      <div class="submenu-header">${title}</div>
      <div class="submenu-content">${content}</div>
    `;
    
    this.submenuElement.style.display = 'block';
    this.updateSubmenuPosition();
    
    // Auto-hide after minimum duration (at least 2 seconds, scales with content)
    const contentLength = content.length || 0;
    const hideDelay = Math.max(this.minDisplayDuration, Math.min(contentLength * 30, 8000));
    
    this.submenuHideTimer = setTimeout(() => {
      this.hideSubmenu();
    }, hideDelay);
  }
  
  /**
   * Hide submenu
   */
  hideSubmenu() {
    this.submenuElement.style.display = 'none';
  }
  
  /**
   * Format thinking content
   * @param {Object} data
   * @returns {string}
   */
  formatThinkingContent(data) {
    const content = data.content || '';
    
    if (this.displayMode === 'brief') {
      return `<p>${this.escapeHtml(this.truncateText(content, 100))}</p>`;
    }
    
    return `<p>${this.escapeHtml(content)}</p>`;
  }
  
  /**
   * Format message content
   * @param {Object} data
   * @returns {string}
   */
  formatMessageContent(data) {
    const content = data.content || '';
    
    if (this.displayMode === 'brief') {
      return `<p>${this.escapeHtml(this.truncateText(content, 100))}</p>`;
    }
    
    return `<p>${this.escapeHtml(content)}</p>`;
  }
  
  /**
   * Format tool content (shows tool arguments)
   * @param {Object} data
   * @returns {string}
   */
  formatToolContent(data) {
    const args = data.arguments || {};
    const argsStr = JSON.stringify(args, null, 2);
    
    if (this.displayMode === 'brief') {
      // Show brief args
      const briefArgs = Object.entries(args)
        .slice(0, 3)
        .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
        .join(', ');
      return `<code class="brief-args">${this.escapeHtml(this.truncateText(briefArgs, 80))}</code>`;
    }
    
    return `<pre class="full-args">${this.escapeHtml(argsStr)}</pre>`;
  }
  
  /**
   * Format result content (shows tool result)
   * @param {Object} data
   * @returns {string}
   */
  formatResultContent(data) {
    const result = data.result;
    
    if (!result) {
      return '<p>无结果数据</p>';
    }
    
    // Get actual data from result
    const resultData = result.data || result;
    
    if (this.displayMode === 'brief') {
      // Show brief result
      if (typeof resultData === 'object') {
        const briefEntries = Object.entries(resultData)
          .slice(0, 3)
          .map(([k, v]) => {
            const valueStr = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return `${k}: ${this.truncateText(valueStr, 30)}`;
          })
          .join('<br>');
        return `<div class="brief-result">${briefEntries}</div>`;
      }
      return `<p>${this.escapeHtml(this.truncateText(String(resultData), 100))}</p>`;
    }
    
    // Full mode
    return `<pre class="full-result">${this.escapeHtml(JSON.stringify(resultData, null, 2))}</pre>`;
  }
  
  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  /**
   * Set display mode
   * @param {string} mode - 'off', 'brief', 'full'
   */
  setDisplayMode(mode) {
    this.displayMode = mode;
    
    if (mode === 'off') {
      this.hideSubmenu();
    }
  }
  
  /**
   * Set panel opacity
   * @param {number} opacity - Opacity value between 0 and 1
   */
  setOpacity(opacity) {
    if (this.menuElement) {
      this.menuElement.style.opacity = opacity;
    }
    if (this.submenuElement) {
      this.submenuElement.style.opacity = opacity;
    }
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
    
    if (this.submenuHideTimer) {
      clearTimeout(this.submenuHideTimer);
      this.submenuHideTimer = null;
    }
    
    if (this.highlightHideTimer) {
      clearTimeout(this.highlightHideTimer);
      this.highlightHideTimer = null;
    }
    
    if (this.slotAnimationTimer) {
      clearTimeout(this.slotAnimationTimer);
      this.slotAnimationTimer = null;
    }
    
    if (this.menuElement && this.menuElement.parentNode) {
      this.menuElement.parentNode.removeChild(this.menuElement);
    }
    
    if (this.submenuElement && this.submenuElement.parentNode) {
      this.submenuElement.parentNode.removeChild(this.submenuElement);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ActionMenu;
}
