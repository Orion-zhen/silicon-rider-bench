/**
 * StatsPanel - Manages the statistics panel display
 * Displays agent state information including time, battery, profit, and orders
 * 
 * Performance optimizations:
 * - Caches DOM elements to avoid repeated queries
 * - Only updates changed values (dirty checking)
 */
class StatsPanel {
  constructor(containerElement) {
    this.container = containerElement;
    
    // Cache for previous values (dirty checking)
    this.previousValues = {
      time: null,
      turn: null,
      tokensLast: null,
      tokensTotal: null,
      toolCalls: null,
      battery: null,
      profit: null,
      carried: null,
      weight: null,
      completed: null,
      ordersHash: null
    };
    
    // Cache DOM elements
    this.elements = {};
    
    // Current game time (in minutes)
    this.currentTime = 0;
    
    this.initialize();
    
    // Subscribe to language changes
    if (typeof i18n !== 'undefined') {
      i18n.subscribe(() => this.updateLabels());
    }
  }

  /**
   * Get translation helper
   */
  t(key) {
    return typeof i18n !== 'undefined' ? i18n.t(key) : key;
  }

  /**
   * Initialize the panel structure
   */
  initialize() {
    console.log('[StatsPanel] Initializing panel structure');
    
    this.container.innerHTML = `
      <div class="stat-section">
        <h3 class="section-title-game">${this.t('stats.gameStatus')}</h3>
        <div class="stat-content">
          <div class="stat-item">
            <span class="stat-label label-connection">${this.t('stats.connection')}:</span>
            <div id="connection-status-inline" class="connection-status disconnected">
              <span class="status-dot"></span>
              <span class="status-text">${this.t('stats.disconnected')}</span>
            </div>
          </div>
          <div class="stat-item">
            <span class="stat-label label-model">${this.t('stats.model')}:</span>
            <span class="stat-value" id="stat-model">--</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-time">${this.t('stats.time')}:</span>
            <span class="stat-value" id="stat-time">--:--</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-turn">${this.t('stats.turn')}:</span>
            <span class="stat-value" id="stat-turn">0/0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-tokens-last">${this.t('stats.tokensLast')}:</span>
            <span class="stat-value" id="stat-tokens-last">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-tokens-total">${this.t('stats.tokensTotal')}:</span>
            <span class="stat-value" id="stat-tokens-total">0</span>
          </div>
        </div>
      </div>
      
      <div class="stat-section">
        <h3 class="section-title-agent">${this.t('stats.agentStatus')}</h3>
        <div class="stat-content">
          <div class="stat-item">
            <span class="stat-label label-tool-calls">${this.t('stats.toolCalls')}:</span>
            <span class="stat-value" id="stat-tool-calls">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-battery">${this.t('stats.battery')}:</span>
            <span class="stat-value" id="stat-battery">--%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-profit">${this.t('stats.profit')}:</span>
            <span class="stat-value" id="stat-profit">¥0.00</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-carried">${this.t('stats.carriedOrders')}:</span>
            <span class="stat-value" id="stat-carried">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-weight">${this.t('stats.totalWeight')}:</span>
            <span class="stat-value" id="stat-weight">0.0 kg</span>
          </div>
          <div class="stat-item">
            <span class="stat-label label-completed">${this.t('stats.completed')}:</span>
            <span class="stat-value" id="stat-completed">0</span>
          </div>
        </div>
      </div>
      
      <div class="stat-section orders-section">
        <h3 class="section-title-orders">${this.t('stats.ordersInBackpack')}</h3>
        <div class="stat-content">
          <div id="orders-list" class="orders-list">
            <div class="no-orders">${this.t('stats.noOrders')}</div>
          </div>
        </div>
      </div>
    `;
    
    // Cache DOM elements
    this.elements = {
      model: document.getElementById('stat-model'),
      time: document.getElementById('stat-time'),
      turn: document.getElementById('stat-turn'),
      tokensLast: document.getElementById('stat-tokens-last'),
      tokensTotal: document.getElementById('stat-tokens-total'),
      toolCalls: document.getElementById('stat-tool-calls'),
      battery: document.getElementById('stat-battery'),
      profit: document.getElementById('stat-profit'),
      carried: document.getElementById('stat-carried'),
      weight: document.getElementById('stat-weight'),
      completed: document.getElementById('stat-completed'),
      ordersList: document.getElementById('orders-list'),
      connectionStatus: document.getElementById('connection-status-inline')
    };
    
    console.log('[StatsPanel] Elements cached:', this.elements);
  }
  
  /**
   * Set model name (called once during initialization)
   * @param {string} modelName - Model name
   */
  setModelName(modelName) {
    if (this.elements.model) {
      this.elements.model.textContent = modelName || 'Unknown';
      this.elements.model.title = modelName; // Add tooltip for long names
    }
  }

  /**
   * Update labels when language changes
   */
  updateLabels() {
    // Update section titles
    const sectionTitleGame = this.container.querySelector('.section-title-game');
    if (sectionTitleGame) sectionTitleGame.textContent = this.t('stats.gameStatus');
    
    const sectionTitleAgent = this.container.querySelector('.section-title-agent');
    if (sectionTitleAgent) sectionTitleAgent.textContent = this.t('stats.agentStatus');
    
    const sectionTitleOrders = this.container.querySelector('.section-title-orders');
    if (sectionTitleOrders) sectionTitleOrders.textContent = this.t('stats.ordersInBackpack');
    
    // Update stat labels
    const labelMappings = {
      '.label-connection': 'stats.connection',
      '.label-model': 'stats.model',
      '.label-time': 'stats.time',
      '.label-turn': 'stats.turn',
      '.label-tokens-last': 'stats.tokensLast',
      '.label-tokens-total': 'stats.tokensTotal',
      '.label-tool-calls': 'stats.toolCalls',
      '.label-battery': 'stats.battery',
      '.label-profit': 'stats.profit',
      '.label-carried': 'stats.carriedOrders',
      '.label-weight': 'stats.totalWeight',
      '.label-completed': 'stats.completed'
    };
    
    Object.entries(labelMappings).forEach(([selector, key]) => {
      const element = this.container.querySelector(selector);
      if (element) {
        element.textContent = this.t(key) + ':';
      }
    });
    
    // Update connection status text
    if (this.elements.connectionStatus) {
      const statusText = this.elements.connectionStatus.querySelector('.status-text');
      if (statusText) {
        if (this.elements.connectionStatus.classList.contains('connected')) {
          statusText.textContent = this.t('stats.connected');
        } else if (this.elements.connectionStatus.classList.contains('reconnecting')) {
          statusText.textContent = this.t('stats.reconnecting');
        } else {
          statusText.textContent = this.t('stats.disconnected');
        }
      }
    }
    
    // Update no orders text
    const noOrders = this.container.querySelector('.no-orders');
    if (noOrders) {
      noOrders.textContent = this.t('stats.noOrders');
    }
  }

  /**
   * Update tool calls count (called when tool_call message is received)
   * @param {number} count - Total tool call count
   */
  updateToolCalls(count) {
    if (this.elements.toolCalls && count !== this.previousValues.toolCalls) {
      const oldValue = this.previousValues.toolCalls || 0;
      this.animateNumberChange(this.elements.toolCalls, oldValue, count, 0);
      this.previousValues.toolCalls = count;
    }
  }

  /**
   * Update statistics display (with dirty checking and animations)
   * @param {Object} agentState - Agent state data
   * @param {string} formattedTime - Formatted time string
   * @param {number} currentIteration - Current iteration number
   * @param {number} maxIterations - Maximum iteration number
   * @param {number} lastTotalTokens - Last call total tokens
   * @param {number} cumulativeTotalTokens - Cumulative total tokens
   * @param {number} currentTime - Current game time in minutes
   */
  update(agentState, formattedTime, currentIteration, maxIterations, lastTotalTokens, cumulativeTotalTokens, currentTime) {
    // Update current time
    if (currentTime !== undefined) {
      this.currentTime = currentTime;
    }
    // Update time (only if changed)
    if (this.elements.time && formattedTime !== this.previousValues.time) {
      this.animateTimeChange(this.elements.time, formattedTime);
      this.previousValues.time = formattedTime;
    }

    // Update turn (only if changed)
    // Use ∞ symbol for unlimited mode (maxIterations === 0)
    if (this.elements.turn && currentIteration !== undefined && maxIterations !== undefined) {
      const maxDisplay = maxIterations === 0 ? '∞' : maxIterations;
      const turnText = `${currentIteration}/${maxDisplay}`;
      if (turnText !== this.previousValues.turn) {
        this.animateTimeChange(this.elements.turn, turnText);
        this.previousValues.turn = turnText;
      }
    }

    // Update last tokens (only if changed)
    if (this.elements.tokensLast && lastTotalTokens !== undefined) {
      const tokensText = this.formatTokens(lastTotalTokens);
      if (tokensText !== this.previousValues.tokensLast) {
        this.animateTimeChange(this.elements.tokensLast, tokensText);
        this.previousValues.tokensLast = tokensText;
      }
    }

    // Update cumulative tokens (only if changed)
    if (this.elements.tokensTotal && cumulativeTotalTokens !== undefined) {
      const tokensText = this.formatTokens(cumulativeTotalTokens);
      if (tokensText !== this.previousValues.tokensTotal) {
        this.animateTimeChange(this.elements.tokensTotal, tokensText);
        this.previousValues.tokensTotal = tokensText;
      }
    }

    // Update battery (only if changed)
    if (this.elements.battery && agentState.battery !== undefined) {
      const newValue = parseFloat(agentState.battery);
      const oldValue = this.previousValues.battery ? parseFloat(this.previousValues.battery) : 0;
      if (newValue !== oldValue) {
        this.animateNumberChange(this.elements.battery, oldValue, newValue, 1, '%');
        this.previousValues.battery = this.formatNumber(newValue, 1);
      }
    }

    // Update profit (only if changed)
    if (this.elements.profit && agentState.profit !== undefined) {
      const newValue = parseFloat(agentState.profit);
      const oldValue = this.previousValues.profit ? parseFloat(this.previousValues.profit) : 0;
      if (newValue !== oldValue) {
        this.animateNumberChange(this.elements.profit, oldValue, newValue, 2, '¥', '');
        this.previousValues.profit = this.formatNumber(newValue, 2);
      }
    }

    // Update carried orders count (only if changed)
    if (this.elements.carried && agentState.carriedOrders !== undefined) {
      const newValue = agentState.carriedOrders.length;
      const oldValue = this.previousValues.carried || 0;
      if (newValue !== oldValue) {
        this.animateNumberChange(this.elements.carried, oldValue, newValue, 0);
        this.previousValues.carried = newValue;
      }
    }

    // Update total weight (only if changed)
    if (this.elements.weight && agentState.totalWeight !== undefined) {
      const newValue = parseFloat(agentState.totalWeight);
      const oldValue = this.previousValues.weight ? parseFloat(this.previousValues.weight) : 0;
      if (newValue !== oldValue) {
        this.animateNumberChange(this.elements.weight, oldValue, newValue, 1, '', ' kg');
        this.previousValues.weight = this.formatNumber(newValue, 1);
      }
    }

    // Update completed orders (only if changed)
    if (this.elements.completed && agentState.completedOrders !== undefined) {
      const newValue = agentState.completedOrders;
      const oldValue = this.previousValues.completed || 0;
      if (newValue !== oldValue) {
        this.animateNumberChange(this.elements.completed, oldValue, newValue, 0);
        this.previousValues.completed = newValue;
      }
    }

    // Update orders list (only if changed)
    if (agentState.carriedOrders) {
      const ordersHash = this.hashOrders(agentState.carriedOrders);
      if (ordersHash !== this.previousValues.ordersHash) {
        this.updateOrders(agentState.carriedOrders);
        this.previousValues.ordersHash = ordersHash;
      }
    }
  }
  
  /**
   * Update statistics display for multi-agent mode (Level 3)
   * @param {Array} allAgentStates - Array of all agent states
   * @param {string} formattedTime - Formatted time string
   * @param {number} currentIteration - Current iteration number
   * @param {number} maxIterations - Maximum iteration number
   * @param {number} lastTotalTokens - Last call total tokens
   * @param {number} cumulativeTotalTokens - Cumulative total tokens
   * @param {number} currentTime - Current game time in minutes
   */
  updateMultiAgent(allAgentStates, formattedTime, currentIteration, maxIterations, lastTotalTokens, cumulativeTotalTokens, currentTime) {
    // Calculate totals across all agents
    let totalProfit = 0;
    let totalCompleted = 0;
    let totalCarried = 0;
    let totalWeight = 0;
    let avgBattery = 0;
    
    if (allAgentStates && allAgentStates.length > 0) {
      allAgentStates.forEach(agent => {
        totalProfit += agent.profit || 0;
        totalCompleted += agent.completedOrders || 0;
        totalCarried += (agent.carriedOrders || []).length;
        totalWeight += agent.totalWeight || 0;
        avgBattery += agent.battery || 0;
      });
      avgBattery = avgBattery / allAgentStates.length;
    }
    
    // Create a synthetic agentState for display
    const syntheticAgentState = {
      battery: avgBattery,
      profit: totalProfit,
      carriedOrders: [], // Don't show individual orders in multi-agent mode
      totalWeight: totalWeight,
      completedOrders: totalCompleted
    };
    
    // Use the regular update method with synthetic state
    this.update(syntheticAgentState, formattedTime, currentIteration, maxIterations, lastTotalTokens, cumulativeTotalTokens, currentTime);
    
    // Update carried orders to show count from all agents
    if (this.elements.carried) {
      const newValue = totalCarried;
      const oldValue = this.previousValues.carried || 0;
      if (newValue !== oldValue) {
        this.animateNumberChange(this.elements.carried, oldValue, newValue, 0);
        this.previousValues.carried = newValue;
      }
    }
  }
  
  /**
   * Animate number change with counting effect
   * @param {HTMLElement} element - Element to update
   * @param {number} from - Starting value
   * @param {number} to - Ending value
   * @param {number} decimals - Number of decimal places
   * @param {string} prefix - Prefix string (e.g., '¥')
   * @param {string} suffix - Suffix string (e.g., '%')
   */
  animateNumberChange(element, from, to, decimals = 0, prefix = '', suffix = '') {
    if (!element) return;
    
    const duration = 500; // Animation duration in ms
    const steps = 20; // Number of animation steps
    const stepDuration = duration / steps;
    const increment = (to - from) / steps;
    
    let current = from;
    let step = 0;
    
    element.classList.add('animating');
    
    const animate = () => {
      step++;
      current += increment;
      
      if (step >= steps) {
        current = to;
        element.textContent = `${prefix}${this.formatNumber(current, decimals)}${suffix}`;
        element.classList.remove('animating');
      } else {
        element.textContent = `${prefix}${this.formatNumber(current, decimals)}${suffix}`;
        setTimeout(animate, stepDuration);
      }
    };
    
    animate();
  }
  
  /**
   * Animate time change (special handling for MM:SS format)
   * @param {HTMLElement} element - Element to update
   * @param {string} newTime - New time string (MM:SS)
   */
  animateTimeChange(element, newTime) {
    if (!element) return;
    
    element.classList.add('animating');
    element.textContent = newTime;
    
    setTimeout(() => {
      element.classList.remove('animating');
    }, 300);
  }
  
  /**
   * Create a simple hash of orders array for change detection
   * @param {Array} orders - Array of order objects
   * @returns {string} Hash string
   */
  hashOrders(orders) {
    if (!orders || orders.length === 0) return 'empty';
    return orders.map(o => `${o.id}-${o.pickedUp}`).join(',');
  }

  /**
   * Update the orders list display
   * @param {Array} carriedOrders - Array of order objects
   */
  updateOrders(carriedOrders) {
    if (!this.elements.ordersList) return;

    if (!carriedOrders || carriedOrders.length === 0) {
      this.elements.ordersList.innerHTML = '<div class="no-orders">No orders</div>';
      return;
    }

    const ordersHTML = carriedOrders.map(order => {
      const status = order.pickedUp ? '📦 Picked up' : '📋 Assigned';
      const deadlineStr = this.formatTime(order.deadline);
      const deliveryFeeStr = order.deliveryFee !== undefined ? `¥${this.formatNumber(order.deliveryFee, 2)}` : '--';
      
      // Calculate remaining time and determine status
      const remainingTime = order.deadline - this.currentTime;
      const deadlineStatus = this.getDeadlineStatus(remainingTime);
      const deadlineClass = `deadline-${deadlineStatus.class}`;
      const borderColorClass = `border-${deadlineStatus.class}`;
      const deadlineLabel = deadlineStatus.overdue ? 'Deadline (OVERDUE):' : 'Deadline:';
      
      // Parse items from JSON string
      let itemsHTML = '';
      try {
        const items = JSON.parse(order.name || '[]');
        if (Array.isArray(items) && items.length > 0) {
          itemsHTML = items.map(item => `<span class="item-badge">${item}</span>`).join('');
        } else {
          itemsHTML = '<span class="item-badge">Unknown</span>';
        }
      } catch (e) {
        // Fallback for old format (string with 、)
        const items = (order.name || 'Unknown').split('、');
        itemsHTML = items.map(item => `<span class="item-badge">${item}</span>`).join('');
      }
      
      return `
        <div class="order-item ${borderColorClass}">
          <div class="order-header">
            <span class="order-id">#${order.id}</span>
            <span class="order-status">${status}</span>
          </div>
          <div class="order-details">
            <div class="order-detail order-name">
              <span class="detail-label">Items:</span>
              <div class="items-container">${itemsHTML}</div>
            </div>
            <div class="order-detail">
              <span class="detail-label">Weight:</span>
              <span class="detail-value">${this.formatNumber(order.weight, 1)} kg</span>
            </div>
            <div class="order-detail">
              <span class="detail-label">Delivery Fee:</span>
              <span class="detail-value">${deliveryFeeStr}</span>
            </div>
            <div class="order-detail">
              <span class="detail-label">${deadlineLabel}</span>
              <span class="detail-value ${deadlineClass}">${deadlineStr}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.elements.ordersList.innerHTML = ordersHTML;
  }

  /**
   * Format a number with specified decimal places
   * @param {number} value - Number to format
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted number string
   */
  formatNumber(value, decimals = 2) {
    if (value === undefined || value === null || isNaN(value)) {
      return '0';
    }
    return Number(value).toFixed(decimals);
  }

  /**
   * Format time in minutes to HH:mm:ss format
   * @param {number} minutes - Time in minutes
   * @returns {string} Formatted time string
   */
  formatTime(minutes) {
    if (minutes === undefined || minutes === null || isNaN(minutes)) {
      return '--:--:--';
    }
    
    const totalSeconds = Math.floor(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Format token count with K/M suffix for large numbers
   * @param {number} tokens - Token count
   * @returns {string} Formatted token string
   */
  formatTokens(tokens) {
    if (tokens === undefined || tokens === null || isNaN(tokens)) {
      return '0';
    }
    
    if (tokens >= 1000000) {
      return (tokens / 1000000).toFixed(1) + 'M';
    } else if (tokens >= 1000) {
      return (tokens / 1000).toFixed(1) + 'K';
    } else {
      return tokens.toString();
    }
  }

  /**
   * Get deadline status based on remaining time
   * @param {number} remainingMinutes - Remaining time in minutes
   * @returns {Object} Status object with class and overdue flag
   */
  getDeadlineStatus(remainingMinutes) {
    if (remainingMinutes < 0) {
      return { class: 'overdue', overdue: true };
    } else if (remainingMinutes < 5) {
      return { class: 'critical', overdue: false };
    } else if (remainingMinutes < 15) {
      return { class: 'warning', overdue: false };
    } else {
      return { class: 'safe', overdue: false };
    }
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatsPanel;
}
