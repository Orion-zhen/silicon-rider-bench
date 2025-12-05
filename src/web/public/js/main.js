/**
 * Silicon Rider Bench - Web Visualization
 * Main Client Logic
 * 
 * Handles WebSocket connection, message routing, and application state management.
 * Uses DataStore for centralized data management.
 * 
 * Version: 2.0.0 - Tab Navigation & DataStore Architecture
 */

// ============================================================================
// Connection State Management
// ============================================================================

class ConnectionManager {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.reconnectTimer = null;
    this.messageHandlers = new Map();
    this.connectionStateCallbacks = [];
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    console.log(`[WebSocket] Connecting to ${wsUrl}...`);
    
    try {
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      this.handleConnectionError();
    }
  }

  setupEventHandlers() {
    this.ws.onopen = () => {
      console.log('[WebSocket] Connected');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      this.notifyConnectionState(true);
    };

    this.ws.onclose = (event) => {
      console.log('[WebSocket] Disconnected', event.code, event.reason);
      this.connected = false;
      this.notifyConnectionState(false);
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      this.handleConnectionError();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };
  }

  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      if (!message.type) {
        console.warn('[WebSocket] Message missing type field:', message);
        return;
      }

      const handlers = this.messageHandlers.get(message.type);
      if (handlers && handlers.length > 0) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error(`[WebSocket] Handler error for type ${message.type}:`, error);
          }
        });
      } else {
        console.warn(`[WebSocket] No handler registered for message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[WebSocket] Failed to parse message:', error, data);
    }
  }

  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  onConnectionStateChange(callback) {
    this.connectionStateCallbacks.push(callback);
  }

  notifyConnectionState(connected, reconnecting = false) {
    this.connectionStateCallbacks.forEach(callback => {
      try {
        callback(connected, reconnecting);
      } catch (error) {
        console.error('[WebSocket] Connection state callback error:', error);
      }
    });
  }

  handleConnectionError() {
    this.connected = false;
    this.notifyConnectionState(false);
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached.');
      this.notifyConnectionState(false);
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    this.notifyConnectionState(false, true);

    this.reconnectTimer = setTimeout(() => {
      console.log('[WebSocket] Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  send(message) {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send message: not connected');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('[WebSocket] Failed to send message:', error);
      return false;
    }
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
  }

  isConnected() {
    return this.connected;
  }
}

// ============================================================================
// Application Main
// ============================================================================

class Application {
  constructor() {
    this.connectionManager = new ConnectionManager();
    this.tabNav = null;
    this.pageRouter = null;
    this.mapRenderer = null;
    this.statsPanel = null;
    this.chatPanel = null;
    this.agentDetailPage = null;
    this.mapPage = null;
    this.pendingSonarToolName = null;
    this.pendingPanelData = [];
    
    // Tool name to Chinese mapping
    this.toolNameMap = {
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
      'get_location_info': '查询位置信息',
      'calculate_distance': '计算距离',
      'estimate_time': '估算时间',
      'wait': '等待',
      'get_receipts': '获取小票',
      'help': '帮助',
    };
  }

  initialize() {
    console.log('[App] Initializing Silicon Rider Bench Web Visualization v2.0...');

    // Initialize Tab Navigation
    const tabNavContainer = document.querySelector('.tab-navigation');
    if (tabNavContainer && typeof TabNav !== 'undefined') {
      this.tabNav = new TabNav(tabNavContainer);
      this.tabNav.onTabChanged((tabId) => this.handleTabChange(tabId));
    }

    // Initialize Page Router
    const pageContainer = document.querySelector('.page-container');
    if (pageContainer && typeof PageRouter !== 'undefined') {
      this.pageRouter = new PageRouter(pageContainer);
      this.registerPages();
      // Navigate to initial page
      this.pageRouter.navigateTo('homepage');
    }

    // Setup connection state handler
    this.connectionManager.onConnectionStateChange((connected, reconnecting) => {
      dataStore.updateConnectionStatus(connected, reconnecting);
      this.updateConnectionStatusUI(connected, reconnecting);
    });

    // Register message handlers
    this.registerMessageHandlers();

    // Connect to server
    this.connectionManager.connect();
  }

  /**
   * Register all pages with the router
   */
  registerPages() {
    // Homepage
    this.pageRouter.registerPage('homepage', {
      title: 'Homepage',
      render: () => `
        <!-- Statistics Panel (Top - Horizontal with Header) -->
        <section class="stats-panel">
          <!-- Header Section -->
          <div class="header-section">
            <div class="header-content">
              <h1>🛵 Silicon Rider Bench</h1>
              <a href="https://github.com/KCORES/silicon-rider-bench" target="_blank" class="github-link">
                github.com/KCORES/silicon-rider-bench
              </a>
            </div>
          </div>
          
          <!-- Stats Content -->
          <div id="stats-panel" class="stats-content">
            <!-- Stats will be rendered here by JavaScript -->
          </div>
        </section>

        <!-- Main Content Area -->
        <div class="container">
          <div class="content-wrapper">
            <!-- Map Area (Left - 50%) -->
            <main class="main-content">
              <div id="map-container" class="map-container">
                <!-- Map will be rendered here by JavaScript -->
              </div>
            </main>

            <!-- Conversation Panel (Right - 50%) -->
            <aside id="chat-panel" class="chat-panel">
              <!-- Chat will be rendered here by JavaScript -->
            </aside>
          </div>
        </div>
      `,
      init: (pageElement) => {
        // Initialize homepage components
        const mapContainer = pageElement.querySelector('#map-container');
        const statsContainer = pageElement.querySelector('#stats-panel');
        const chatContainer = pageElement.querySelector('#chat-panel');

        // Initialize map renderer
        if (typeof MapRenderer !== 'undefined' && mapContainer) {
          this.mapRenderer = new MapRenderer(mapContainer);
          
          // If we have init data, initialize the map
          const state = dataStore.getState();
          if (state.nodes.length > 0) {
            this.mapRenderer.initialize(state.nodes, state.edges);
            
            // Set model name for agent badge
            if (state.modelName) {
              this.mapRenderer.setModelName(state.modelName);
            }
            
            this.mapRenderer.render();
            
            // Update agent position if available
            if (state.agentState.position) {
              this.mapRenderer.updateAgentPosition(state.agentState.position);
              this.mapRenderer.render();
            }
          }
        }

        // Initialize stats panel
        if (typeof StatsPanel !== 'undefined' && statsContainer) {
          this.statsPanel = new StatsPanel(statsContainer);
          
          // Set model name if available
          const modelName = dataStore.get('modelName');
          if (modelName) {
            this.statsPanel.setModelName(modelName);
          }
          
          // Update with current data
          const state = dataStore.getState();
          this.statsPanel.update(
            state.agentState,
            state.formattedTime,
            state.currentIteration,
            state.maxIterations,
            state.lastTotalTokens,
            state.cumulativeTotalTokens,
            state.currentTime
          );
          this.statsPanel.updateToolCalls(state.totalToolCalls);
        }

        // Initialize chat panel
        if (typeof ChatPanel !== 'undefined' && chatContainer) {
          this.chatPanel = new ChatPanel(chatContainer);
          
          // Replay existing conversations
          const conversations = dataStore.get('conversations') || [];
          conversations.forEach(item => {
            if (item.type === 'message') {
              this.chatPanel.addMessage(item.role, item.content);
            } else if (item.type === 'tool_call') {
              this.chatPanel.addToolCall(item.toolName, item.arguments);
            } else if (item.type === 'tool_result') {
              this.chatPanel.addToolResult(item.toolName, item.success, item.result);
            }
          });
        }

        // Update connection status
        const state = dataStore.getState();
        this.updateConnectionStatusUI(state.connected, state.reconnecting);

        return { mapRenderer: this.mapRenderer, statsPanel: this.statsPanel, chatPanel: this.chatPanel };
      },
      update: (instance, dataType, data) => {
        // This is called when navigating back to homepage
        // Refresh all components with current data
        if (this.statsPanel) {
          const state = dataStore.getState();
          this.statsPanel.update(
            state.agentState,
            state.formattedTime,
            state.currentIteration,
            state.maxIterations,
            state.lastTotalTokens,
            state.cumulativeTotalTokens,
            state.currentTime
          );
          this.statsPanel.updateToolCalls(state.totalToolCalls);
        }
      },
      cleanup: () => {
        // Cleanup if needed
      }
    });

    // Map Page
    this.pageRouter.registerPage('map', {
      title: 'Map',
      render: () => {
        if (typeof renderMapPage !== 'undefined') {
          return renderMapPage();
        }
        return '<div class="map-page"><p>Loading...</p></div>';
      },
      init: (pageElement) => {
        if (typeof MapPage !== 'undefined') {
          this.mapPage = new MapPage(pageElement, dataStore);
          
          // Update connection status immediately after init
          const isConnected = this.connectionManager.isConnected();
          this.mapPage.updateConnectionStatus(isConnected);
          
          return this.mapPage;
        }
        return null;
      },
      update: (instance) => {
        if (instance && instance.updateFromDataStore) {
          instance.updateFromDataStore();
        }
        // Also update connection status on page revisit
        if (instance && instance.updateConnectionStatus) {
          instance.updateConnectionStatus(this.connectionManager.isConnected());
        }
      },
      cleanup: () => {
        if (this.mapPage && this.mapPage.cleanup) {
          this.mapPage.cleanup();
        }
      }
    });

    // Agent Detail Page
    this.pageRouter.registerPage('agent-detail', {
      title: 'Agent Detail',
      render: () => {
        if (typeof renderAgentDetailPage !== 'undefined') {
          return renderAgentDetailPage();
        }
        return '<div class="agent-detail-page"><p>Loading...</p></div>';
      },
      init: (pageElement) => {
        if (typeof AgentDetailPage !== 'undefined') {
          this.agentDetailPage = new AgentDetailPage(pageElement, dataStore);
          return this.agentDetailPage;
        }
        return null;
      },
      update: (instance) => {
        if (instance && instance.updateFromDataStore) {
          instance.updateFromDataStore();
        }
      },
      cleanup: () => {
        if (this.agentDetailPage && this.agentDetailPage.cleanup) {
          this.agentDetailPage.cleanup();
        }
      }
    });

    // Settings Page
    this.pageRouter.registerPage('settings', {
      title: 'Settings',
      render: () => {
        if (typeof renderSettingsPage !== 'undefined') {
          return renderSettingsPage();
        }
        return '<div class="settings-page"><p>Loading...</p></div>';
      },
      init: (pageElement) => {
        if (typeof SettingsPage !== 'undefined') {
          this.settingsPage = new SettingsPage(pageElement, this);
          return this.settingsPage;
        }
        return null;
      },
      update: (instance) => {
        // Settings page doesn't need data updates
      },
      cleanup: () => {
        if (this.settingsPage && this.settingsPage.cleanup) {
          this.settingsPage.cleanup();
        }
      }
    });
  }

  /**
   * Handle tab change
   * @param {string} tabId - New tab ID
   */
  handleTabChange(tabId) {
    if (this.pageRouter) {
      this.pageRouter.navigateTo(tabId);
    }
  }

  /**
   * Register handlers for different message types
   */
  registerMessageHandlers() {
    this.connectionManager.on('init', (message) => {
      this.handleInit(message.data);
    });

    this.connectionManager.on('state_update', (message) => {
      this.handleStateUpdate(message.data);
    });

    this.connectionManager.on('conversation', (message) => {
      this.handleConversation(message.data);
    });

    this.connectionManager.on('reasoning', (message) => {
      this.handleReasoning(message.data);
    });

    this.connectionManager.on('tool_call', (message) => {
      this.handleToolCall(message.data);
    });

    this.connectionManager.on('tool_result', (message) => {
      this.handleToolResult(message.data);
    });

    this.connectionManager.on('simulation_end', (message) => {
      this.handleSimulationEnd(message.data);
    });

    this.connectionManager.on('error', (message) => {
      console.error('[App] Server error:', message.data);
    });
  }

  /**
   * Handle initialization message
   */
  handleInit(data) {
    // Update data store
    dataStore.handleInit(data);

    // Initialize map renderer if on homepage
    if (this.mapRenderer) {
      this.mapRenderer.initialize(data.nodes, data.edges);
      
      // Set model name for agent badge
      if (data.config && data.config.modelName) {
        this.mapRenderer.setModelName(data.config.modelName);
      }
      
      this.mapRenderer.render();
    }
    
    // Initialize map page renderer if exists
    if (this.mapPage && this.mapPage.mapRenderer) {
      this.mapPage.mapRenderer.initialize(data.nodes, data.edges);
      
      if (data.config && data.config.modelName) {
        this.mapPage.mapRenderer.setModelName(data.config.modelName);
      }
      
      this.mapPage.mapRenderer.render();
    }

    // Update stats panel
    if (this.statsPanel && data.config && data.config.modelName) {
      this.statsPanel.setModelName(data.config.modelName);
    }

    // Update connection status
    this.updateConnectionStatusUI(this.connectionManager.isConnected(), false);
  }

  /**
   * Handle state update message
   */
  handleStateUpdate(data) {
    // Update data store
    dataStore.handleStateUpdate(data);

    // Update map renderer (homepage)
    if (this.mapRenderer && data.agentState) {
      this.mapRenderer.updateAgentPosition(data.agentState.position);
      this.mapRenderer.render();
    }
    
    // Update map page renderer and status panel
    if (this.mapPage) {
      // Update map renderer
      if (this.mapPage.mapRenderer && data.agentState) {
        this.mapPage.mapRenderer.updateAgentPosition(data.agentState.position);
        this.mapPage.mapRenderer.render();
      }
      
      // Update game status (time, turn, tokens)
      this.mapPage.updateGameStatus({
        formattedTime: data.formattedTime,
        currentIteration: data.currentIteration,
        maxIterations: data.maxIterations,
        lastTotalTokens: data.lastTotalTokens,
        cumulativeTotalTokens: data.cumulativeTotalTokens,
      });
      
      // Update agent state (position, battery, profit, orders)
      if (data.agentState) {
        this.mapPage.updateAgentState(data.agentState);
      }
    }

    // Update stats panel
    if (this.statsPanel) {
      this.statsPanel.update(
        data.agentState,
        data.formattedTime,
        data.currentIteration,
        data.maxIterations,
        data.lastTotalTokens,
        data.cumulativeTotalTokens,
        data.currentTime
      );
    }
  }

  /**
   * Handle conversation message
   */
  handleConversation(data) {
    // Update data store
    dataStore.handleConversation(data);

    // Show action panel for assistant messages (homepage only)
    if (data.role === 'assistant' && data.content) {
      let displayContent = data.content;
      if (displayContent.length > 100) {
        displayContent = displayContent.substring(0, 100) + '...';
      }
      
      const modelName = dataStore.get('modelName');
      const actionText = `${modelName}: ${displayContent}`;
      
      // Only show action panel on homepage, map page uses ActionMenu instead
      if (this.mapRenderer) {
        this.mapRenderer.showActionPanel(actionText, 'conversation');
      }
    }
    
    // Update map page action menu
    if (this.mapPage && this.mapPage.handleConversation) {
      this.mapPage.handleConversation(data);
    }
    
    // Update chat panel
    if (this.chatPanel) {
      this.chatPanel.addMessage(data.role, data.content);
    }
  }

  /**
   * Handle reasoning message
   */
  handleReasoning(data) {
    // Update data store
    dataStore.handleReasoning(data);
    
    // Show reasoning panel (homepage only)
    if (data.content) {
      let displayContent = data.content;
      if (displayContent.length > 150) {
        displayContent = displayContent.substring(0, 150) + '...';
      }
      
      const modelName = dataStore.get('modelName');
      const reasoningText = `${modelName} 💭: ${displayContent}`;
      
      // Only show action panel on homepage, map page uses ActionMenu instead
      if (this.mapRenderer) {
        this.mapRenderer.showActionPanel(reasoningText, 'reasoning');
      }
    }
    
    // Update map page action menu
    if (this.mapPage && this.mapPage.handleReasoning) {
      this.mapPage.handleReasoning(data);
    }
    
    // Update chat panel
    if (this.chatPanel) {
      const modelName = dataStore.get('modelName');
      this.chatPanel.addMessage('system', `💭 ${modelName} 思考过程:\n${data.content}`);
    }
  }

  /**
   * Handle tool call message
   */
  handleToolCall(data) {
    // Update data store
    dataStore.handleToolCall(data);
    
    // Update stats panel
    if (this.statsPanel) {
      this.statsPanel.updateToolCalls(dataStore.get('totalToolCalls'));
    }
    
    const toolNameChinese = this.toolNameMap[data.toolName] || data.toolName;
    const argsStr = JSON.stringify(data.arguments || {});
    const actionHtml = `<span class="tool-action-badge">${toolNameChinese}</span> 调用 tool ${data.toolName}(${argsStr})`;
    
    // Critical hit animation map
    const criticalHitMap = {
      'pickup_food': '➕🍱',
      'pickup_food_by_phone_number': '➕🍱',
      'deliver_food': '➖🍱',
      'swap_battery': '➕🔋',
      'accept_order': '➕📋',
      'get_receipts': '🧾',
    };
    
    // Show action panel for tool call (homepage only, map page uses ActionMenu)
    if (this.mapRenderer) {
      this.mapRenderer.showActionPanel(actionHtml, 'tool-call');
      
      // Show critical hit animation
      if (criticalHitMap[data.toolName]) {
        this.mapRenderer.showCriticalHitAnimation(criticalHitMap[data.toolName]);
      }
    }
    
    // Show critical hit animation on map page (but no action panel)
    if (this.mapPage && this.mapPage.mapRenderer) {
      if (criticalHitMap[data.toolName]) {
        this.mapPage.mapRenderer.showCriticalHitAnimation(criticalHitMap[data.toolName]);
      }
    }
    
    // Show sonar animation for search tools
    if (data.toolName === 'search_nearby_orders' || data.toolName === 'search_nearby_battery_stations') {
      const radius = data.arguments && data.arguments.radius ? data.arguments.radius : 10;
      this.pendingSonarToolName = data.toolName;
      
      if (this.mapRenderer) {
        this.mapRenderer.showSonarAnimation(radius);
      }
      if (this.mapPage && this.mapPage.mapRenderer) {
        this.mapPage.mapRenderer.showSonarAnimation(radius);
      }
    }
    
    // Update map page action menu
    if (this.mapPage && this.mapPage.handleToolCall) {
      this.mapPage.handleToolCall(data);
    }
    
    // Update chat panel
    if (this.chatPanel) {
      this.chatPanel.addToolCall(data.toolName, data.arguments);
    }
  }

  /**
   * Handle tool result message
   */
  handleToolResult(data) {
    // Update data store
    dataStore.handleToolResult(data);
    
    // Show search result panels for search tools
    if (data.success) {
      const resultData = data.result && data.result.data ? data.result.data : data.result;
      
      if (data.toolName === 'search_nearby_orders' && resultData && resultData.orders) {
        const panelDataList = [];
        resultData.orders.forEach((order) => {
          if (order.pickupLocation) {
            let deadlineStr = 'N/A';
            if (order.estimatedTimeLimit) {
              deadlineStr = `${order.estimatedTimeLimit}分钟`;
            }
            
            panelDataList.push({
              locationId: order.pickupLocation,
              type: 'order',
              data: {
                locationName: order.name,
                deliveryFee: order.deliveryFee,
                deadline: deadlineStr
              }
            });
          }
        });
        
        this.showPanelsAfterSonar(panelDataList, this.mapRenderer);
        if (this.mapPage && this.mapPage.mapRenderer) {
          this.showPanelsAfterSonar(panelDataList, this.mapPage.mapRenderer);
        }
        
      } else if (data.toolName === 'search_nearby_battery_stations' && resultData && resultData.stations) {
        const panelDataList = [];
        resultData.stations.forEach((station) => {
          if (station.id) {
            panelDataList.push({
              locationId: station.id,
              type: 'battery_station',
              data: {
                name: station.name
              }
            });
          }
        });
        
        this.showPanelsAfterSonar(panelDataList, this.mapRenderer);
        if (this.mapPage && this.mapPage.mapRenderer) {
          this.showPanelsAfterSonar(panelDataList, this.mapPage.mapRenderer);
        }
        
      } else if (data.toolName === 'get_location_info' && resultData && resultData.id) {
        const locationData = {
          name: resultData.name || 'Unknown',
          type: resultData.type || 'unknown',
          position: resultData.position || { x: 0, y: 0 }
        };
        
        setTimeout(() => {
          if (this.mapRenderer) {
            this.mapRenderer.showLocationInfoPanel(resultData.id, locationData);
          }
          if (this.mapPage && this.mapPage.mapRenderer) {
            this.mapPage.mapRenderer.showLocationInfoPanel(resultData.id, locationData);
          }
        }, 500);
        
      } else if (data.toolName === 'calculate_distance' && resultData && resultData.path) {
        setTimeout(() => {
          const distance = typeof resultData.distance === 'number' ? resultData.distance : 0;
          const pathData = {
            distance: distance.toFixed(2) + ' km'
          };
          
          if (this.mapRenderer) {
            this.mapRenderer.showPathAnimation(resultData.path, 'green', pathData);
          }
          if (this.mapPage && this.mapPage.mapRenderer) {
            this.mapPage.mapRenderer.showPathAnimation(resultData.path, 'green', pathData);
          }
        }, 500);
        
      } else if (data.toolName === 'estimate_time' && resultData) {
        if (resultData.segments) {
          setTimeout(() => {
            const path = [];
            let totalDistance = 0;
            
            if (resultData.segments && resultData.segments.length > 0) {
              resultData.segments.forEach((segment, index) => {
                if (segment.path && segment.path.length > 0) {
                  if (index === 0) {
                    path.push(...segment.path);
                  } else {
                    path.push(...segment.path.slice(1));
                  }
                }
                totalDistance += segment.distance || 0;
              });
            }
            
            const totalTime = typeof resultData.totalTime === 'number' ? resultData.totalTime : 0;
            
            if (path.length >= 2) {
              const pathData = {
                time: totalTime.toFixed(2) + ' 分钟',
                distance: totalDistance.toFixed(2) + ' km'
              };
              
              if (this.mapRenderer) {
                this.mapRenderer.showPathAnimation(path, 'blue', pathData);
              }
              if (this.mapPage && this.mapPage.mapRenderer) {
                this.mapPage.mapRenderer.showPathAnimation(path, 'blue', pathData);
              }
            }
          }, 500);
        }
      }
    }
    
    // Update map page action menu
    if (this.mapPage && this.mapPage.handleToolResult) {
      this.mapPage.handleToolResult(data);
    }
    
    // Update chat panel
    if (this.chatPanel) {
      this.chatPanel.addToolResult(data.toolName, data.success, data.result);
    }
  }
  
  /**
   * Show panels after sonar animation completes
   * @param {Array} panelDataList - List of panel data to show
   * @param {MapRenderer} targetRenderer - The map renderer to show panels on
   */
  showPanelsAfterSonar(panelDataList, targetRenderer) {
    if (!targetRenderer) return;
    
    if (targetRenderer.isSonarAnimating) {
      setTimeout(() => {
        this.showPanelsAfterSonar(panelDataList, targetRenderer);
      }, 100);
    } else {
      const panelsWithDistance = panelDataList.map(panelData => {
        const distance = targetRenderer.calculateDistanceToAgent(panelData.locationId);
        return { ...panelData, distance };
      });
      
      panelsWithDistance.sort((a, b) => a.distance - b.distance);
      
      const delayBetweenPanels = 150;
      
      panelsWithDistance.forEach((panelData, index) => {
        const delay = index * delayBetweenPanels;
        
        setTimeout(() => {
          const autoHideDuration = 10000 + (index * 1000);
          
          targetRenderer.showSearchResultPanel(
            panelData.locationId,
            panelData.type,
            panelData.data,
            autoHideDuration
          );
        }, delay);
      });
    }
  }

  /**
   * Handle simulation end message
   */
  handleSimulationEnd(data) {
    // Update data store
    dataStore.handleSimulationEnd(data);
    
    // Update chat panel
    if (this.chatPanel) {
      this.chatPanel.addMessage('system', `Simulation completed!\n\nFinal Report:\n${data.report}`);
    }
  }
  
  /**
   * Update connection status in UI
   */
  updateConnectionStatusUI(connected, reconnecting = false) {
    // Update stats panel if available
    if (this.statsPanel && this.statsPanel.elements && this.statsPanel.elements.connectionStatus) {
      const statusElement = this.statsPanel.elements.connectionStatus;
      const statusText = statusElement.querySelector('.status-text');
      
      if (connected) {
        if (statusText) statusText.textContent = 'Connected';
        statusElement.className = 'connection-status connected';
      } else if (reconnecting) {
        if (statusText) statusText.textContent = 'Reconnecting...';
        statusElement.className = 'connection-status reconnecting';
      } else {
        if (statusText) statusText.textContent = 'Disconnected';
        statusElement.className = 'connection-status disconnected';
      }
    }
    
    // Update map page connection status
    if (this.mapPage && this.mapPage.updateConnectionStatus) {
      this.mapPage.updateConnectionStatus(connected);
    }
  }
}

// ============================================================================
// Application Entry Point
// ============================================================================

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.app = new Application();
    window.app.initialize();
  });
} else {
  window.app = new Application();
  window.app.initialize();
}
