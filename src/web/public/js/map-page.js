/**
 * MapPage - Map-focused view with action menu
 * 
 * Layout: 9:9 (56.25%) map area + 7:9 (43.75%) info panel
 * Features:
 * - 1:1 aspect ratio map with padding for emoji overflow
 * - Multi-agent status display with tabs
 * - Action menu following agent emoji
 */

/**
 * Render the Map page HTML
 */
function renderMapPage() {
  return `
    <div class="map-page">
      <!-- Left: Map Area (9:9 ratio, 56.25% width) -->
      <div class="map-page-left">
        <div class="map-page-map-wrapper">
          <div id="map-page-container" class="map-page-map-container">
            <!-- Map will be rendered here -->
          </div>
        </div>
      </div>
      
      <!-- Right: Info Panel (7:9 ratio, 43.75% width) -->
      <div class="map-page-right">
        <!-- Game Status Dashboard -->
        <div class="map-dashboard-section">
          <div class="map-page-section-header">
            <span class="section-icon">🎮</span>
            <span class="section-title">游戏状态</span>
          </div>
          <div class="dashboard-grid">
            <div class="dashboard-item">
              <span class="dashboard-label">连接</span>
              <span class="dashboard-value" id="map-connection-status">
                <span class="connection-bar disconnected"></span>
              </span>
            </div>
            <div class="dashboard-item">
              <span class="dashboard-label">时间</span>
              <span class="dashboard-value" id="map-game-time">--:--</span>
            </div>
            <div class="dashboard-item">
              <span class="dashboard-label">回合</span>
              <span class="dashboard-value" id="map-game-turn">0/0</span>
            </div>
            <div class="dashboard-item">
              <span class="dashboard-label">本次Tokens</span>
              <span class="dashboard-value" id="map-tokens-last">0</span>
            </div>
            <div class="dashboard-item">
              <span class="dashboard-label">总计Tokens</span>
              <span class="dashboard-value" id="map-tokens-total">0</span>
            </div>
          </div>
        </div>
        
        <!-- Agent Status Dashboard -->
        <div class="map-dashboard-section">
          <div class="map-page-section-header">
            <span class="section-icon">🤖</span>
            <span class="section-title">代理状态</span>
            <div class="map-agent-tabs" id="map-agent-tabs">
              <div class="agent-tab active" data-agent-id="default">
                <span class="agent-tab-name">default</span>
              </div>
            </div>
          </div>
          <div class="dashboard-grid">
            <div class="dashboard-item">
              <span class="dashboard-label">工具调用</span>
              <span class="dashboard-value" id="map-tool-calls">0</span>
            </div>
            <div class="dashboard-item">
              <span class="dashboard-label">完成订单</span>
              <span class="dashboard-value" id="map-completed-orders">0</span>
            </div>
            <div class="dashboard-item">
              <span class="dashboard-label">收益</span>
              <span class="dashboard-value profit" id="map-agent-profit">¥0.00</span>
            </div>
            <div class="dashboard-item battery-item">
              <span class="dashboard-label">电量</span>
              <div class="battery-display">
                <div class="battery-bar">
                  <div class="battery-fill" id="map-battery-fill" style="width: 100%"></div>
                </div>
                <span class="battery-text" id="map-agent-battery">100%</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Carried Orders Section -->
        <div class="map-orders-section">
          <div class="map-page-section-header">
            <span class="section-icon">📦</span>
            <span class="section-title">携带订单</span>
            <span class="orders-count" id="map-orders-count">0</span>
          </div>
          <div class="orders-scroll-container" id="map-orders-list">
            <div class="no-orders">暂无订单</div>
          </div>
        </div>
        
      </div>
    </div>
  `;
}

/**
 * MapPage class - Handles Map page initialization and updates
 */
class MapPage {
  constructor(pageElement, dataStoreRef) {
    this.pageElement = pageElement;
    this.dataStore = dataStoreRef;
    this.mapRenderer = null;
    this.actionMenu = null;
    this.agents = new Map(); // agentId -> agent state
    this.activeAgentId = 'default';
    this.submenuDisplayMode = 'brief'; // 'off', 'brief', 'full'
    
    // DOM element references
    this.elements = {
      mapContainer: null,
      // Game status
      connectionStatus: null,
      gameTime: null,
      gameTurn: null,
      tokensLast: null,
      tokensTotal: null,
      // Agent status
      agentTabs: null,
      toolCalls: null,
      completedOrders: null,
      agentProfit: null,
      agentBattery: null,
      batteryFill: null,
      // Orders
      ordersCount: null,
      ordersList: null,
    };
    
    // Track tool calls count
    this.toolCallsCount = 0;
    
    this.initialize();
  }
  
  /**
   * Initialize the Map page
   */
  initialize() {
    // Cache DOM elements
    this.elements.mapContainer = this.pageElement.querySelector('#map-page-container');
    // Game status
    this.elements.connectionStatus = this.pageElement.querySelector('#map-connection-status');
    this.elements.gameTime = this.pageElement.querySelector('#map-game-time');
    this.elements.gameTurn = this.pageElement.querySelector('#map-game-turn');
    this.elements.tokensLast = this.pageElement.querySelector('#map-tokens-last');
    this.elements.tokensTotal = this.pageElement.querySelector('#map-tokens-total');
    // Agent status
    this.elements.agentTabs = this.pageElement.querySelector('#map-agent-tabs');
    this.elements.toolCalls = this.pageElement.querySelector('#map-tool-calls');
    this.elements.completedOrders = this.pageElement.querySelector('#map-completed-orders');
    this.elements.agentProfit = this.pageElement.querySelector('#map-agent-profit');
    this.elements.agentBattery = this.pageElement.querySelector('#map-agent-battery');
    this.elements.batteryFill = this.pageElement.querySelector('#map-battery-fill');
    // Orders
    this.elements.ordersCount = this.pageElement.querySelector('#map-orders-count');
    this.elements.ordersList = this.pageElement.querySelector('#map-orders-list');
    
    // Initialize MapRenderer
    if (typeof MapRenderer !== 'undefined' && this.elements.mapContainer) {
      this.mapRenderer = new MapRenderer(this.elements.mapContainer);
      
      // Load map data from dataStore
      const state = this.dataStore.getState();
      if (state.nodes.length > 0) {
        this.mapRenderer.initialize(state.nodes, state.edges);
        
        if (state.modelName) {
          this.mapRenderer.setModelName(state.modelName);
        }
        
        // Set agent position FIRST, then render
        if (state.agentState && state.agentState.position) {
          this.mapRenderer.agentPosition = state.agentState.position;
        }
        
        // Render will create the agentElement
        this.mapRenderer.render();
      }
    }
    
    // Initialize ActionMenu AFTER mapRenderer has rendered (with a small delay to ensure agentElement exists)
    if (typeof ActionMenu !== 'undefined' && this.mapRenderer && this.elements.mapContainer) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        this.actionMenu = new ActionMenu(this.elements.mapContainer, this.mapRenderer);
        
        // Load saved submenu mode from localStorage
        const savedMode = localStorage.getItem('mapSubmenuMode') || 'brief';
        this.submenuDisplayMode = savedMode;
        this.actionMenu.setDisplayMode(savedMode);
      });
    }
    
    // Bind events
    this.bindEvents();
    
    // Initial update
    this.updateFromDataStore();
  }
  
  /**
   * Bind event handlers
   */
  bindEvents() {
    // Agent tab click handler
    if (this.elements.agentTabs) {
      this.elements.agentTabs.addEventListener('click', (e) => {
        const tab = e.target.closest('.agent-tab');
        if (tab) {
          const agentId = tab.dataset.agentId;
          this.selectAgent(agentId);
        }
      });
    }
  }
  
  /**
   * Set submenu display mode (called from settings page)
   * @param {string} mode - 'off', 'brief', 'full'
   */
  setSubmenuDisplayMode(mode) {
    this.submenuDisplayMode = mode;
    
    // Update ActionMenu
    if (this.actionMenu) {
      this.actionMenu.setDisplayMode(mode);
    }
  }
  
  /**
   * Select an agent by ID
   * @param {string} agentId
   */
  selectAgent(agentId) {
    this.activeAgentId = agentId;
    
    // Update tab UI
    const tabs = this.elements.agentTabs.querySelectorAll('.agent-tab');
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.agentId === agentId);
    });
    
    // Update agent info panel
    this.updateAgentInfoPanel();
    
    // Update map to show selected agent
    const agent = this.agents.get(agentId);
    if (agent && this.mapRenderer) {
      this.mapRenderer.updateAgentPosition(agent.position);
      if (agent.modelName) {
        this.mapRenderer.setModelName(agent.modelName);
      }
    }
  }
  
  /**
   * Update from dataStore
   */
  updateFromDataStore() {
    const state = this.dataStore.getState();
    
    // Update game status
    this.updateGameStatus(state);
    
    // Update agent state
    this.updateAgentState(state.agentState);
    
    // Update map
    if (this.mapRenderer && state.nodes.length > 0) {
      // Check if map needs initialization
      if (this.mapRenderer.nodes.size === 0) {
        this.mapRenderer.initialize(state.nodes, state.edges);
        
        // Set model name for agent badge
        if (state.modelName) {
          this.mapRenderer.setModelName(state.modelName);
        }
      }
      
      // Set agent position FIRST (before render)
      if (state.agentState && state.agentState.position) {
        this.mapRenderer.agentPosition = state.agentState.position;
      }
      
      // Render the map
      this.mapRenderer.render();
    }
  }
  
  /**
   * Update game status display
   * @param {Object} state
   */
  updateGameStatus(state) {
    if (this.elements.gameTime) {
      this.elements.gameTime.textContent = state.formattedTime || '--:--';
    }
    
    if (this.elements.gameTurn) {
      const current = state.currentIteration || 0;
      const max = state.maxIterations || 0;
      this.elements.gameTurn.textContent = `${current}/${max}`;
    }
    
    if (this.elements.tokensLast) {
      const tokensLast = state.lastTotalTokens || 0;
      this.elements.tokensLast.textContent = tokensLast.toLocaleString();
    }
    
    if (this.elements.tokensTotal) {
      const tokensTotal = state.cumulativeTotalTokens || 0;
      this.elements.tokensTotal.textContent = tokensTotal.toLocaleString();
    }
  }
  
  /**
   * Update connection status display
   * @param {boolean} connected
   */
  updateConnectionStatus(connected) {
    if (this.elements.connectionStatus) {
      const bar = this.elements.connectionStatus.querySelector('.connection-bar');
      if (bar) {
        bar.classList.remove('connected', 'disconnected');
        bar.classList.add(connected ? 'connected' : 'disconnected');
      }
    }
  }
  
  /**
   * Update agent state
   * @param {Object} agentState
   */
  updateAgentState(agentState) {
    if (!agentState) return;
    
    // Get agent ID (default to 'default' for backward compatibility)
    const agentId = agentState.id || 'default';
    const modelName = agentState.modelName || this.dataStore.get('modelName') || 'Unknown';
    
    // Store agent state
    this.agents.set(agentId, {
      ...agentState,
      modelName: modelName,
    });
    
    // Update tabs if new agent
    this.updateAgentTabs();
    
    // Update info panel if this is the active agent
    if (agentId === this.activeAgentId) {
      this.updateAgentInfoPanel();
    }
  }
  
  /**
   * Update agent tabs
   */
  updateAgentTabs() {
    if (!this.elements.agentTabs) return;
    
    // Generate tabs HTML
    const tabsHTML = Array.from(this.agents.entries()).map(([agentId, agent]) => {
      const isActive = agentId === this.activeAgentId;
      const displayName = this.getAgentDisplayName(agent.modelName, agentId);
      return `
        <div class="agent-tab ${isActive ? 'active' : ''}" data-agent-id="${agentId}">
          <span class="agent-tab-name">${displayName}</span>
        </div>
      `;
    }).join('');
    
    this.elements.agentTabs.innerHTML = tabsHTML;
  }
  
  /**
   * Get display name for agent
   * @param {string} modelName
   * @param {string} agentId
   * @returns {string}
   */
  getAgentDisplayName(modelName, agentId) {
    if (!modelName || modelName === 'Unknown') {
      return agentId;
    }
    
    // Extract short name from model name (e.g., "openai/gpt-4" -> "gpt-4")
    const parts = modelName.split('/');
    const shortName = parts[parts.length - 1];
    
    // If agentId contains the short name, just use agentId
    if (agentId.includes(shortName) || agentId === 'default') {
      return shortName;
    }
    
    return agentId;
  }
  
  /**
   * Update agent info panel
   */
  updateAgentInfoPanel() {
    const agent = this.agents.get(this.activeAgentId);
    if (!agent) return;
    
    // Update tool calls count
    if (this.elements.toolCalls) {
      this.elements.toolCalls.textContent = this.toolCallsCount.toString();
    }
    
    // Update completed orders
    if (this.elements.completedOrders) {
      const completed = agent.completedOrders !== undefined ? agent.completedOrders : 0;
      this.elements.completedOrders.textContent = completed.toString();
    }
    
    // Update profit
    if (this.elements.agentProfit) {
      const profit = agent.profit !== undefined ? agent.profit : 0;
      this.elements.agentProfit.textContent = `¥${profit.toFixed(2)}`;
    }
    
    // Update battery with progress bar
    const battery = agent.battery !== undefined ? agent.battery : 100;
    if (this.elements.agentBattery) {
      this.elements.agentBattery.textContent = `${battery.toFixed(0)}%`;
    }
    if (this.elements.batteryFill) {
      this.elements.batteryFill.style.width = `${Math.min(100, Math.max(0, battery))}%`;
      
      // Update color based on battery level
      this.elements.batteryFill.classList.remove('critical', 'warning', 'good');
      if (battery < 20) {
        this.elements.batteryFill.classList.add('critical');
      } else if (battery < 50) {
        this.elements.batteryFill.classList.add('warning');
      } else {
        this.elements.batteryFill.classList.add('good');
      }
    }
    
    // Update orders count
    const orders = agent.carriedOrders || [];
    if (this.elements.ordersCount) {
      this.elements.ordersCount.textContent = orders.length.toString();
    }
    
    // Update orders list
    this.updateOrdersList(orders);
  }
  
  /**
   * Update orders list (horizontal scroll)
   * @param {Array} orders
   */
  updateOrdersList(orders) {
    if (!this.elements.ordersList) return;
    
    if (orders.length === 0) {
      this.elements.ordersList.innerHTML = '<div class="no-orders">暂无订单</div>';
      return;
    }
    
    const ordersHTML = orders.map(order => {
      const statusClass = order.pickedUp ? 'picked-up' : 'assigned';
      const statusIcon = order.pickedUp ? '📦' : '📋';
      
      return `
        <div class="order-card-mini ${statusClass}">
          <div class="order-card-icon">${statusIcon}</div>
          <div class="order-card-info">
            <span class="order-card-name">${order.name || '未知'}</span>
            <span class="order-card-fee">¥${(order.deliveryFee || 0).toFixed(1)}</span>
          </div>
        </div>
      `;
    }).join('');
    
    this.elements.ordersList.innerHTML = ordersHTML;
  }
  
  /**
   * Handle tool call event
   * @param {Object} data - Tool call data
   */
  handleToolCall(data) {
    // Increment tool calls count
    this.toolCallsCount++;
    if (this.elements.toolCalls) {
      this.elements.toolCalls.textContent = this.toolCallsCount.toString();
    }
    
    if (this.actionMenu) {
      this.actionMenu.highlightAction('tool', data.toolName);
      this.actionMenu.showSubmenu('tool', data);
    }
  }
  
  /**
   * Handle tool result event
   * @param {Object} data - Tool result data
   */
  handleToolResult(data) {
    if (this.actionMenu) {
      this.actionMenu.highlightAction('result');
      this.actionMenu.showSubmenu('result', data);
    }
  }
  
  /**
   * Handle conversation event
   * @param {Object} data - Conversation data
   */
  handleConversation(data) {
    if (this.actionMenu && data.role === 'assistant') {
      this.actionMenu.highlightAction('message', null, data.content);
      this.actionMenu.showSubmenu('message', data);
    }
  }
  
  /**
   * Handle reasoning event
   * @param {Object} data - Reasoning data
   */
  handleReasoning(data) {
    if (this.actionMenu) {
      this.actionMenu.highlightAction('thinking', null, data.content);
      this.actionMenu.showSubmenu('thinking', data);
    }
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.actionMenu) {
      this.actionMenu.cleanup();
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderMapPage, MapPage };
}

