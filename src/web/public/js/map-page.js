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
            <div class="dashboard-item" id="map-total-profit-item" style="display: none;">
              <span class="dashboard-label">总盈利</span>
              <span class="dashboard-value profit" id="map-total-profit">¥0.00</span>
            </div>
          </div>
        </div>
        
        <!-- Single Agent Status Dashboard (for Level 1/2) -->
        <div class="map-dashboard-section" id="single-agent-section">
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
        
        <!-- Carried Orders Section (for Level 1/2) -->
        <div class="map-orders-section" id="single-orders-section">
          <div class="map-page-section-header">
            <span class="section-icon">📦</span>
            <span class="section-title">携带订单</span>
            <span class="orders-count" id="map-orders-count">0</span>
          </div>
          <div class="orders-scroll-container" id="map-orders-list">
            <div class="no-orders">暂无订单</div>
          </div>
        </div>
        
        <!-- Multi-Agent Cards Section (for Level 3) -->
        <div class="map-multi-agent-section" id="multi-agent-section" style="display: none;">
          <div class="map-page-section-header">
            <span class="section-icon">🛵</span>
            <span class="section-title">骑手状态</span>
            <span class="agents-count" id="map-agents-count">0</span>
          </div>
          <div class="multi-agent-cards-container" id="multi-agent-cards">
            <!-- Agent cards will be rendered here -->
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
    this.actionMenu = null; // Single agent mode ActionMenu
    this.receiptPanel = null; // Single agent mode ReceiptPanel
    this.actionMenus = new Map(); // Multi-agent mode: agentId -> ActionMenu
    this.receiptPanels = new Map(); // Multi-agent mode: agentId -> ReceiptPanel
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
      totalProfitItem: null,
      totalProfit: null,
      // Single agent status
      singleAgentSection: null,
      agentTabs: null,
      toolCalls: null,
      completedOrders: null,
      agentProfit: null,
      agentBattery: null,
      batteryFill: null,
      // Single agent orders
      singleOrdersSection: null,
      ordersCount: null,
      ordersList: null,
      // Multi-agent mode
      multiAgentSection: null,
      agentsCount: null,
      multiAgentCards: null,
    };
    
    // Track tool calls count per agent
    this.toolCallsCount = 0;
    this.toolCallsCounts = new Map(); // agentId -> count
    
    // Track multi-agent mode
    this.isMultiAgentMode = false;
    
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
    this.elements.totalProfitItem = this.pageElement.querySelector('#map-total-profit-item');
    this.elements.totalProfit = this.pageElement.querySelector('#map-total-profit');
    // Single agent status
    this.elements.singleAgentSection = this.pageElement.querySelector('#single-agent-section');
    this.elements.agentTabs = this.pageElement.querySelector('#map-agent-tabs');
    this.elements.toolCalls = this.pageElement.querySelector('#map-tool-calls');
    this.elements.completedOrders = this.pageElement.querySelector('#map-completed-orders');
    this.elements.agentProfit = this.pageElement.querySelector('#map-agent-profit');
    this.elements.agentBattery = this.pageElement.querySelector('#map-agent-battery');
    this.elements.batteryFill = this.pageElement.querySelector('#map-battery-fill');
    // Single agent orders
    this.elements.singleOrdersSection = this.pageElement.querySelector('#single-orders-section');
    this.elements.ordersCount = this.pageElement.querySelector('#map-orders-count');
    this.elements.ordersList = this.pageElement.querySelector('#map-orders-list');
    // Multi-agent mode
    this.elements.multiAgentSection = this.pageElement.querySelector('#multi-agent-section');
    this.elements.agentsCount = this.pageElement.querySelector('#map-agents-count');
    this.elements.multiAgentCards = this.pageElement.querySelector('#multi-agent-cards');
    
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
        
        // Check for multi-agent mode (Level 3)
        if (state.isMultiAgentMode && state.allAgentStates && state.allAgentStates.length > 1) {
          // Enable multi-agent mode
          this.mapRenderer.enableMultiAgentMode(state.allAgentStates);
          this.mapRenderer.updateAllAgentPositions(state.allAgentStates);
        } else if (state.agentState && state.agentState.position) {
          // Single agent mode - Set agent position FIRST, then render
          this.mapRenderer.agentPosition = state.agentState.position;
        }
        
        // Render will create the agentElement(s)
        this.mapRenderer.render();
      }
    }
    
    // Initialize ActionMenu and ReceiptPanel AFTER mapRenderer has rendered
    if (typeof ActionMenu !== 'undefined' && this.mapRenderer && this.elements.mapContainer) {
      const state = this.dataStore.getState();
      
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        // Load saved settings from localStorage
        const savedMode = localStorage.getItem('mapSubmenuMode') || 'brief';
        const savedOpacity = parseFloat(localStorage.getItem('mapPanelOpacity') || '0.9');
        this.submenuDisplayMode = savedMode;
        
        // Check for multi-agent mode
        if (state.isMultiAgentMode && state.allAgentStates && state.allAgentStates.length > 1) {
          // Multi-agent mode: create ActionMenu and ReceiptPanel for each agent
          this.initializeMultiAgentPanels(state.allAgentStates);
        } else {
          // Single agent mode
          this.actionMenu = new ActionMenu(this.elements.mapContainer, this.mapRenderer);
          this.actionMenu.setDisplayMode(savedMode);
          this.actionMenu.setOpacity(savedOpacity);
          
          if (typeof ReceiptPanel !== 'undefined') {
            this.receiptPanel = new ReceiptPanel(this.elements.mapContainer, this.mapRenderer);
            this.receiptPanel.setOpacity(savedOpacity);
          }
        }
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
   * Initialize ActionMenu and ReceiptPanel for each agent (multi-agent mode)
   * @param {Array} agentStates - Array of agent state objects
   */
  initializeMultiAgentPanels(agentStates) {
    if (!this.elements.mapContainer || !this.mapRenderer) return;
    
    const savedMode = localStorage.getItem('mapSubmenuMode') || 'brief';
    const savedOpacity = parseFloat(localStorage.getItem('mapPanelOpacity') || '0.9');
    
    agentStates.forEach(agent => {
      const agentId = agent.id;
      
      // Create ActionMenu for this agent
      if (typeof ActionMenu !== 'undefined' && !this.actionMenus.has(agentId)) {
        const menu = new ActionMenu(this.elements.mapContainer, this.mapRenderer, agentId);
        menu.setDisplayMode(savedMode);
        menu.setOpacity(savedOpacity);
        this.actionMenus.set(agentId, menu);
      }
      
      // Create ReceiptPanel for this agent
      if (typeof ReceiptPanel !== 'undefined' && !this.receiptPanels.has(agentId)) {
        const panel = new ReceiptPanel(this.elements.mapContainer, this.mapRenderer, agentId);
        panel.setOpacity(savedOpacity);
        this.receiptPanels.set(agentId, panel);
      }
      
      // Initialize tool calls count for this agent
      if (!this.toolCallsCounts.has(agentId)) {
        this.toolCallsCounts.set(agentId, 0);
      }
    });
    
    console.log(`[MapPage] Initialized ${this.actionMenus.size} ActionMenus and ${this.receiptPanels.size} ReceiptPanels`);
  }
  
  /**
   * Set submenu display mode (called from settings page)
   * @param {string} mode - 'off', 'brief', 'full'
   */
  setSubmenuDisplayMode(mode) {
    this.submenuDisplayMode = mode;
    
    // Update single ActionMenu
    if (this.actionMenu) {
      this.actionMenu.setDisplayMode(mode);
    }
    
    // Update all ActionMenus (multi-agent mode)
    this.actionMenus.forEach(menu => {
      menu.setDisplayMode(mode);
    });
  }
  
  /**
   * Set panel opacity (called from settings page)
   * @param {number} opacity - Opacity value between 0 and 1
   */
  setPanelOpacity(opacity) {
    // Update single ActionMenu
    if (this.actionMenu) {
      this.actionMenu.setOpacity(opacity);
    }
    
    // Update all ActionMenus (multi-agent mode)
    this.actionMenus.forEach(menu => {
      menu.setOpacity(opacity);
    });
    
    // Update single ReceiptPanel
    if (this.receiptPanel) {
      this.receiptPanel.setOpacity(opacity);
    }
    
    // Update all ReceiptPanels (multi-agent mode)
    this.receiptPanels.forEach(panel => {
      panel.setOpacity(opacity);
    });
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
    
    // Check for multi-agent mode
    const isMultiAgentMode = state.isMultiAgentMode && state.allAgentStates && state.allAgentStates.length > 1;
    
    // Update agent states
    if (isMultiAgentMode) {
      // Multi-agent mode: update all agent states
      this.updateAllAgentStates(state.allAgentStates);
    } else {
      // Single agent mode
      this.updateAgentState(state.agentState);
    }
    
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
      
      // Multi-agent mode handling
      if (isMultiAgentMode) {
        // Enable multi-agent mode if not already
        if (!this.mapRenderer.isMultiAgentMode) {
          this.mapRenderer.enableMultiAgentMode(state.allAgentStates);
        }
        this.mapRenderer.updateAllAgentPositions(state.allAgentStates);
        
        // Initialize multi-agent panels if not done yet
        if (this.actionMenus.size === 0) {
          requestAnimationFrame(() => {
            this.initializeMultiAgentPanels(state.allAgentStates);
          });
        }
      } else if (state.agentState && state.agentState.position) {
        // Single agent mode - Set agent position FIRST (before render)
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
    
    // Update total profit for multi-agent mode
    if (state.allAgentStates && state.allAgentStates.length > 1) {
      const totalProfit = state.allAgentStates.reduce((sum, agent) => sum + (agent.profit || 0), 0);
      if (this.elements.totalProfit) {
        this.elements.totalProfit.textContent = `¥${totalProfit.toFixed(2)}`;
      }
      if (this.elements.totalProfitItem) {
        this.elements.totalProfitItem.style.display = '';
      }
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
   * Update agent state (single agent mode)
   * @param {Object} agentState
   */
  updateAgentState(agentState) {
    if (!agentState) return;
    
    // Switch to single agent mode UI
    this.setSingleAgentMode();
    
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
   * Update all agent states (multi-agent mode / Level 3)
   * @param {Array} allAgentStates - Array of agent state objects
   */
  updateAllAgentStates(allAgentStates) {
    if (!allAgentStates || allAgentStates.length === 0) return;
    
    // Switch to multi-agent mode UI
    this.setMultiAgentMode();
    
    // Update agents count
    if (this.elements.agentsCount) {
      this.elements.agentsCount.textContent = allAgentStates.length;
    }
    
    // Store all agent states
    allAgentStates.forEach(agentState => {
      const agentId = agentState.id || `agent_${this.agents.size + 1}`;
      const modelName = agentState.modelName || this.dataStore.get('modelName') || 'Unknown';
      this.agents.set(agentId, {
        ...agentState,
        modelName: modelName,
      });
    });
    
    // Render all agent cards
    this.renderAllAgentCards(allAgentStates);
  }
  
  /**
   * Switch to single agent mode UI
   */
  setSingleAgentMode() {
    if (this.isMultiAgentMode) {
      this.isMultiAgentMode = false;
      
      // Show single agent sections
      if (this.elements.singleAgentSection) {
        this.elements.singleAgentSection.style.display = '';
      }
      if (this.elements.singleOrdersSection) {
        this.elements.singleOrdersSection.style.display = '';
      }
      
      // Hide multi-agent section
      if (this.elements.multiAgentSection) {
        this.elements.multiAgentSection.style.display = 'none';
      }
      
      // Hide total profit
      if (this.elements.totalProfitItem) {
        this.elements.totalProfitItem.style.display = 'none';
      }
    }
  }
  
  /**
   * Switch to multi-agent mode UI
   */
  setMultiAgentMode() {
    if (!this.isMultiAgentMode) {
      this.isMultiAgentMode = true;
      
      // Hide single agent sections
      if (this.elements.singleAgentSection) {
        this.elements.singleAgentSection.style.display = 'none';
      }
      if (this.elements.singleOrdersSection) {
        this.elements.singleOrdersSection.style.display = 'none';
      }
      
      // Show multi-agent section
      if (this.elements.multiAgentSection) {
        this.elements.multiAgentSection.style.display = '';
      }
      
      // Show total profit
      if (this.elements.totalProfitItem) {
        this.elements.totalProfitItem.style.display = '';
      }
    }
  }
  
  /**
   * Render all agent cards
   * @param {Array} allAgentStates
   */
  renderAllAgentCards(allAgentStates) {
    if (!this.elements.multiAgentCards) return;
    
    // Agent colors (matching map-renderer.js)
    const agentColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'];
    
    const cardsHTML = allAgentStates.map((agent, index) => {
      const agentId = agent.id || `agent_${index + 1}`;
      const displayId = agentId.replace('agent_', '#');
      const color = agentColors[index % agentColors.length];
      const battery = agent.battery !== undefined ? agent.battery : 100;
      const profit = agent.profit !== undefined ? agent.profit : 0;
      const completedOrders = agent.completedOrders !== undefined ? agent.completedOrders : 0;
      const carriedOrders = agent.carriedOrders || [];
      
      // Battery color
      let batteryClass = 'good';
      if (battery < 20) batteryClass = 'critical';
      else if (battery < 50) batteryClass = 'warning';
      
      // Carried orders display
      const ordersHTML = carriedOrders.length > 0 
        ? carriedOrders.map(order => {
            const statusIcon = order.pickedUp ? '📦' : '📋';
            return `<span class="mini-order-badge" title="${order.name || '订单'}">${statusIcon}</span>`;
          }).join('')
        : '<span class="no-orders-text">无</span>';
      
      return `
        <div class="agent-card" data-agent-id="${agentId}" style="border-left-color: ${color};">
          <div class="agent-card-header">
            <span class="agent-card-id" style="background-color: ${color};">🛵 ${displayId}</span>
            <span class="agent-card-profit">¥${profit.toFixed(2)}</span>
          </div>
          <div class="agent-card-body">
            <div class="agent-card-stat">
              <span class="stat-label">电量</span>
              <div class="mini-battery-display">
                <div class="mini-battery-bar">
                  <div class="mini-battery-fill ${batteryClass}" style="width: ${Math.min(100, Math.max(0, battery))}%"></div>
                </div>
                <span class="mini-battery-text">${battery.toFixed(0)}%</span>
              </div>
            </div>
            <div class="agent-card-stat">
              <span class="stat-label">完成</span>
              <span class="stat-value">${completedOrders}</span>
            </div>
            <div class="agent-card-stat">
              <span class="stat-label">携带</span>
              <div class="carried-orders-mini">${ordersHTML}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    this.elements.multiAgentCards.innerHTML = cardsHTML;
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
   * Get ActionMenu for specific agent (multi-agent mode) or default
   * @param {string} agentId - Agent ID
   * @returns {ActionMenu|null}
   */
  getActionMenuForAgent(agentId) {
    if (agentId && this.actionMenus.has(agentId)) {
      return this.actionMenus.get(agentId);
    }
    return this.actionMenu;
  }
  
  /**
   * Get ReceiptPanel for specific agent (multi-agent mode) or default
   * @param {string} agentId - Agent ID
   * @returns {ReceiptPanel|null}
   */
  getReceiptPanelForAgent(agentId) {
    if (agentId && this.receiptPanels.has(agentId)) {
      return this.receiptPanels.get(agentId);
    }
    return this.receiptPanel;
  }
  
  /**
   * Handle tool call event
   * @param {Object} data - Tool call data
   */
  handleToolCall(data) {
    const agentId = data.agentId;
    
    // Increment tool calls count
    if (agentId && this.toolCallsCounts.has(agentId)) {
      this.toolCallsCounts.set(agentId, this.toolCallsCounts.get(agentId) + 1);
    } else {
      this.toolCallsCount++;
    }
    
    if (this.elements.toolCalls) {
      this.elements.toolCalls.textContent = this.toolCallsCount.toString();
    }
    
    // Get ActionMenu for this agent
    const actionMenu = this.getActionMenuForAgent(agentId);
    if (actionMenu) {
      actionMenu.highlightAction('tool', data.toolName);
      actionMenu.showSubmenu('tool', data);
    }
    
    // Handle move_to: schedule receipt panel to hide after 2s
    if (data.toolName === 'move_to') {
      const receiptPanel = this.getReceiptPanelForAgent(agentId);
      if (receiptPanel && receiptPanel.isShowing()) {
        receiptPanel.scheduleHide();
      }
    }
  }
  
  /**
   * Handle tool result event
   * @param {Object} data - Tool result data
   */
  handleToolResult(data) {
    const agentId = data.agentId;
    
    // Get ActionMenu for this agent
    const actionMenu = this.getActionMenuForAgent(agentId);
    if (actionMenu) {
      actionMenu.highlightAction('result');
      actionMenu.showSubmenu('result', data);
    }
    
    // Handle get_receipts result: show receipt panel
    if (data.toolName === 'get_receipts' && data.success && data.result) {
      this.handleGetReceiptsResult(data.result, agentId);
    }
    
    // Handle pickup_food_by_phone_number result: highlight the picked up receipt
    if (data.toolName === 'pickup_food_by_phone_number' && data.success && data.result) {
      this.handlePickupByPhoneResult(data.result, agentId);
    }
  }
  
  /**
   * Handle get_receipts tool result
   * Shows the receipt panel with receipt images
   * @param {Object} result - Tool result data
   * @param {string} agentId - Agent ID
   */
  handleGetReceiptsResult(result, agentId) {
    const receiptPanel = this.getReceiptPanelForAgent(agentId);
    if (!receiptPanel) {
      return;
    }
    
    const resultData = result.data || result;
    const receipts = resultData.receipts || [];
    
    if (receipts.length > 0) {
      receiptPanel.showReceipts(receipts);
    }
  }
  
  /**
   * Handle pickup_food_by_phone_number tool result
   * Highlights the selected receipt with green glow
   * @param {Object} result - Tool result data
   * @param {string} agentId - Agent ID
   */
  handlePickupByPhoneResult(result, agentId) {
    const receiptPanel = this.getReceiptPanelForAgent(agentId);
    if (!receiptPanel) return;
    
    const resultData = result.data || result;
    const orderId = resultData.orderId;
    
    if (orderId) {
      receiptPanel.highlightReceipt(orderId);
    }
  }
  
  /**
   * Handle conversation event
   * @param {Object} data - Conversation data
   */
  handleConversation(data) {
    if (data.role !== 'assistant') return;
    
    // In multi-agent mode, broadcast to all ActionMenus (conversation is global)
    if (this.actionMenus.size > 0) {
      this.actionMenus.forEach(menu => {
        menu.highlightAction('message', null, data.content);
        menu.showSubmenu('message', data);
      });
    } else if (this.actionMenu) {
      this.actionMenu.highlightAction('message', null, data.content);
      this.actionMenu.showSubmenu('message', data);
    }
  }
  
  /**
   * Handle reasoning event
   * @param {Object} data - Reasoning data
   */
  handleReasoning(data) {
    // In multi-agent mode, broadcast to all ActionMenus (reasoning is global)
    if (this.actionMenus.size > 0) {
      this.actionMenus.forEach(menu => {
        menu.highlightAction('thinking', null, data.content);
        menu.showSubmenu('thinking', data);
      });
    } else if (this.actionMenu) {
      this.actionMenu.highlightAction('thinking', null, data.content);
      this.actionMenu.showSubmenu('thinking', data);
    }
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    // Cleanup single agent mode panels
    if (this.actionMenu) {
      this.actionMenu.cleanup();
    }
    if (this.receiptPanel) {
      this.receiptPanel.cleanup();
    }
    
    // Cleanup multi-agent mode panels
    this.actionMenus.forEach(menu => {
      menu.cleanup();
    });
    this.actionMenus.clear();
    
    this.receiptPanels.forEach(panel => {
      panel.cleanup();
    });
    this.receiptPanels.clear();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { renderMapPage, MapPage };
}

