/**
 * Silicon Rider Bench - Web Visualization
 * Main Client Logic
 * 
 * Handles WebSocket connection, message routing, and connection state management
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
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.reconnectTimer = null;
    this.messageHandlers = new Map();
    this.connectionStateCallbacks = [];
  }

  /**
   * Connect to WebSocket server
   */
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

  /**
   * Setup WebSocket event handlers
   */
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

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      
      console.log('[WebSocket] Received message:', message.type, message);
      
      if (!message.type) {
        console.warn('[WebSocket] Message missing type field:', message);
        return;
      }

      // Route message to registered handlers
      const handlers = this.messageHandlers.get(message.type);
      if (handlers && handlers.length > 0) {
        console.log(`[WebSocket] Routing to ${handlers.length} handler(s) for type: ${message.type}`);
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

  /**
   * Register a message handler for a specific message type
   */
  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  /**
   * Register a connection state change callback
   */
  onConnectionStateChange(callback) {
    this.connectionStateCallbacks.push(callback);
  }

  /**
   * Notify all connection state callbacks
   */
  notifyConnectionState(connected, reconnecting = false) {
    this.connectionStateCallbacks.forEach(callback => {
      try {
        callback(connected, reconnecting);
      } catch (error) {
        console.error('[WebSocket] Connection state callback error:', error);
      }
    });
  }

  /**
   * Handle connection error
   */
  handleConnectionError() {
    this.connected = false;
    this.notifyConnectionState(false);
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnection attempts reached. Please refresh the page to try again.');
      this.notifyConnectionState(false);
      return;
    }

    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    // Notify that we're reconnecting
    this.notifyConnectionState(false, true);

    this.reconnectTimer = setTimeout(() => {
      console.log('[WebSocket] Attempting to reconnect...');
      this.connect();
    }, delay);
  }

  /**
   * Send a message to the server
   */
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

  /**
   * Close the connection
   */
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

  /**
   * Get connection status
   */
  isConnected() {
    return this.connected;
  }
}

// ============================================================================
// UI State Management
// ============================================================================

class UIManager {
  constructor() {
    this.connectionIndicator = null;
    this.mapContainer = null;
    this.statsContainer = null;
    this.chatContainer = null;
  }

  /**
   * Initialize UI elements
   */
  initialize() {
    console.log('[UI] Initializing UI elements...');
    
    this.mapContainer = document.getElementById('map-container');
    this.statsContainer = document.getElementById('stats-panel');
    this.chatContainer = document.getElementById('chat-panel');

    console.log('[UI] Map container:', this.mapContainer);
    console.log('[UI] Stats container:', this.statsContainer);
    console.log('[UI] Chat container:', this.chatContainer);

    if (!this.mapContainer) {
      console.error('[UI] ❌ Map container element not found');
    } else {
      console.log('[UI] ✓ Map container found');
    }
    if (!this.statsContainer) {
      console.error('[UI] ❌ Stats container element not found');
    } else {
      console.log('[UI] ✓ Stats container found');
    }
    if (!this.chatContainer) {
      console.error('[UI] ❌ Chat container element not found');
    } else {
      console.log('[UI] ✓ Chat container found');
    }
  }

  /**
   * Update connection status indicator (now in stats panel)
   */
  updateConnectionStatus(connected, reconnecting = false) {
    // Connection status is now managed by StatsPanel
    // We'll update it through the app's statsPanel reference
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error('[UI] Error:', message);
    // Could add a toast notification or error banner here
  }
}

// ============================================================================
// Application Main
// ============================================================================

class Application {
  constructor() {
    this.connectionManager = new ConnectionManager();
    this.uiManager = new UIManager();
    this.mapRenderer = null;
    this.statsPanel = null;
    this.chatPanel = null;
    this.pendingSonarToolName = null;
    this.pendingPanelData = [];
    this.modelName = 'AI';
    
    // Tool name to Chinese mapping
    this.toolNameMap = {
      'get_my_status': '查询状态',
      'search_nearby_orders': '搜索订单',
      'search_nearby_battery_stations': '搜索换电站',
      'accept_order': '接受订单',
      'move_to': '移动',
      'pickup_food': '取餐',
      'deliver_food': '送餐',
      'swap_battery': '换电',
      'get_location_info': '查询位置信息',
      'calculate_distance': '计算距离',
    };
  }

  /**
   * Initialize the application
   */
  initialize() {
    console.log('[App] Initializing Silicon Rider Bench Web Visualization...');

    // Initialize UI
    this.uiManager.initialize();

    // Setup connection state handler
    this.connectionManager.onConnectionStateChange((connected, reconnecting) => {
      this.updateConnectionStatusInStats(connected, reconnecting);
    });

    // Register message handlers
    this.registerMessageHandlers();

    // Connect to server
    this.connectionManager.connect();
  }

  /**
   * Register handlers for different message types
   */
  registerMessageHandlers() {
    // Handle initialization message
    this.connectionManager.on('init', (message) => {
      console.log('[App] Received init message:', message.data);
      this.handleInit(message.data);
    });

    // Handle state updates
    this.connectionManager.on('state_update', (message) => {
      this.handleStateUpdate(message.data);
    });

    // Handle conversation messages
    this.connectionManager.on('conversation', (message) => {
      this.handleConversation(message.data);
    });

    // Handle tool calls
    this.connectionManager.on('tool_call', (message) => {
      this.handleToolCall(message.data);
    });

    // Handle tool results
    this.connectionManager.on('tool_result', (message) => {
      this.handleToolResult(message.data);
    });

    // Handle simulation end
    this.connectionManager.on('simulation_end', (message) => {
      console.log('[App] Simulation ended:', message.data);
      this.handleSimulationEnd(message.data);
    });

    // Handle errors
    this.connectionManager.on('error', (message) => {
      console.error('[App] Server error:', message.data);
      this.uiManager.showError(message.data.message);
    });
  }

  /**
   * Handle initialization message
   */
  handleInit(data) {
    console.log('[App] Initializing with data:', data);
    
    // Initialize map renderer when available
    if (typeof MapRenderer !== 'undefined' && this.uiManager.mapContainer) {
      console.log('[App] Creating MapRenderer...');
      this.mapRenderer = new MapRenderer(this.uiManager.mapContainer);
      this.mapRenderer.initialize(data.nodes, data.edges);
      this.mapRenderer.render();
      console.log('[App] MapRenderer initialized');
    } else {
      console.warn('[App] MapRenderer not available or container not found');
    }

    // Initialize stats panel when available
    if (typeof StatsPanel !== 'undefined' && this.uiManager.statsContainer) {
      console.log('[App] Creating StatsPanel...');
      this.statsPanel = new StatsPanel(this.uiManager.statsContainer);
      console.log('[App] StatsPanel initialized');
      
      // Set model name if available in config
      if (data.config && data.config.modelName) {
        this.statsPanel.setModelName(data.config.modelName);
        this.modelName = data.config.modelName;
      }
      
      // Update connection status now that stats panel is initialized
      this.updateConnectionStatusInStats(this.connectionManager.isConnected(), false);
    } else {
      console.warn('[App] StatsPanel not available or container not found');
    }

    // Initialize chat panel when available
    if (typeof ChatPanel !== 'undefined' && this.uiManager.chatContainer) {
      console.log('[App] Creating ChatPanel...');
      this.chatPanel = new ChatPanel(this.uiManager.chatContainer);
      console.log('[App] ChatPanel initialized');
    } else {
      console.warn('[App] ChatPanel not available or container not found');
    }
  }

  /**
   * Handle state update message
   */
  handleStateUpdate(data) {
    console.log('[App] State update:', data);
    
    // Update map renderer
    if (this.mapRenderer) {
      console.log('[App] Updating map renderer with position:', data.agentState.position);
      this.mapRenderer.updateAgentPosition(data.agentState.position);
      this.mapRenderer.render();
    } else {
      console.warn('[App] Map renderer not initialized');
    }

    // Update stats panel
    if (this.statsPanel) {
      console.log('[App] Updating stats panel');
      this.statsPanel.update(
        data.agentState, 
        data.formattedTime,
        data.currentIteration,
        data.maxIterations,
        data.lastTotalTokens,
        data.cumulativeTotalTokens,
        data.currentTime
      );
    } else {
      console.warn('[App] Stats panel not initialized');
    }
  }

  /**
   * Handle conversation message
   */
  handleConversation(data) {
    console.log('[App] Conversation message:', data);
    
    // Show action panel for assistant messages
    if (data.role === 'assistant' && data.content && this.mapRenderer) {
      // Truncate long content
      let displayContent = data.content;
      if (displayContent.length > 100) {
        displayContent = displayContent.substring(0, 100) + '...';
      }
      
      const actionText = `${this.modelName}: ${displayContent}`;
      console.log('[App] Showing conversation action panel:', actionText);
      this.mapRenderer.showActionPanel(actionText, 'conversation');
    }
    
    if (this.chatPanel) {
      this.chatPanel.addMessage(data.role, data.content);
    } else {
      console.warn('[App] Chat panel not initialized');
    }
  }

  /**
   * Handle tool call message
   */
  handleToolCall(data) {
    console.log('[App] Tool call:', data);
    console.log('[App] Tool name:', data.toolName);
    
    // Show action panel for tool call
    if (this.mapRenderer) {
      const toolNameChinese = this.toolNameMap[data.toolName] || data.toolName;
      const argsStr = JSON.stringify(data.arguments || {});
      const actionText = `${toolNameChinese}: 调用 tool ${data.toolName}(${argsStr})`;
      
      console.log('[App] Showing action panel:', actionText);
      this.mapRenderer.showActionPanel(actionText, 'tool-call');
    }
    
    // Show sonar animation for search tools
    if ((data.toolName === 'search_nearby_orders' || data.toolName === 'search_nearby_battery_stations') && this.mapRenderer) {
      console.log('[App] Triggering sonar animation for', data.toolName);
      
      // Extract radius from arguments
      const radius = data.arguments && data.arguments.radius ? data.arguments.radius : 10;
      console.log('[App] Search radius:', radius, 'km');
      
      // Store the tool name to handle panels after animation
      this.pendingSonarToolName = data.toolName;
      
      this.mapRenderer.showSonarAnimation(radius, () => {
        console.log('[App] Sonar animation completed, ready to show panels');
        // Panels will be shown when tool_result arrives
      });
    }
    
    if (this.chatPanel) {
      this.chatPanel.addToolCall(data.toolName, data.arguments);
    } else {
      console.warn('[App] Chat panel not initialized');
    }
  }

  /**
   * Handle tool result message
   */
  handleToolResult(data) {
    console.log('[App] Tool result:', data);
    console.log('[App] Tool name:', data.toolName);
    console.log('[App] Success:', data.success);
    console.log('[App] Result:', data.result);
    console.log('[App] MapRenderer exists:', !!this.mapRenderer);
    
    // Show search result panels for search tools
    if (data.success && this.mapRenderer) {
      // 后端返回格式是 {success: true, data: {orders: [...]} }
      const resultData = data.result && data.result.data ? data.result.data : data.result;
      
      if (data.toolName === 'search_nearby_orders' && resultData && resultData.orders) {
        console.log('[App] Processing search_nearby_orders result');
        console.log('[App] Orders count:', resultData.orders.length);
        
        // Collect panel data
        const panelDataList = [];
        resultData.orders.forEach((order, index) => {
          console.log(`[App] Processing order ${index}:`, order);
          console.log(`[App] Order pickupLocation:`, order.pickupLocation);
          
          if (order.pickupLocation) {
            // Format deadline time
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
          } else {
            console.warn(`[App] Order ${index} has no pickupLocation`);
          }
        });
        
        // Wait for sonar animation to complete before showing panels
        this.showPanelsAfterSonar(panelDataList);
        
      } else if (data.toolName === 'search_nearby_battery_stations' && resultData && resultData.stations) {
        console.log('[App] Processing search_nearby_battery_stations result');
        console.log('[App] Stations count:', resultData.stations.length);
        
        // Collect panel data
        const panelDataList = [];
        resultData.stations.forEach((station, index) => {
          console.log(`[App] Processing station ${index}:`, station);
          console.log(`[App] Station id:`, station.id);
          
          if (station.id) {
            panelDataList.push({
              locationId: station.id,
              type: 'battery_station',
              data: {
                name: station.name
              }
            });
          } else {
            console.warn(`[App] Station ${index} has no id`);
          }
        });
        
        // Wait for sonar animation to complete before showing panels
        this.showPanelsAfterSonar(panelDataList);
        
      } else {
        console.log('[App] Not a search tool or no results');
        console.log('[App] Conditions check:');
        console.log('  - Is search_nearby_orders:', data.toolName === 'search_nearby_orders');
        console.log('  - Is search_nearby_battery_stations:', data.toolName === 'search_nearby_battery_stations');
        console.log('  - Has result:', !!data.result);
        console.log('  - Has resultData:', !!resultData);
        if (resultData) {
          console.log('  - Has orders:', !!resultData.orders);
          console.log('  - Has stations:', !!resultData.stations);
        }
      }
    } else {
      console.log('[App] Skipping panel display:');
      console.log('  - Success:', data.success);
      console.log('  - MapRenderer exists:', !!this.mapRenderer);
    }
    
    if (this.chatPanel) {
      this.chatPanel.addToolResult(data.toolName, data.success, data.result);
    } else {
      console.warn('[App] Chat panel not initialized');
    }
  }
  
  /**
   * Show panels after sonar animation completes
   */
  showPanelsAfterSonar(panelDataList) {
    console.log('[App] Scheduling panels to show after sonar animation');
    
    // Check if sonar is currently animating
    if (this.mapRenderer.isSonarAnimating) {
      console.log('[App] Sonar is animating, waiting...');
      // Wait and check again
      setTimeout(() => {
        this.showPanelsAfterSonar(panelDataList);
      }, 100);
    } else {
      console.log('[App] Sonar animation complete, showing panels now');
      
      // Calculate distances and sort by distance (closest first)
      const panelsWithDistance = panelDataList.map(panelData => {
        const distance = this.mapRenderer.calculateDistanceToAgent(panelData.locationId);
        return { ...panelData, distance };
      });
      
      // Sort by distance (ascending - closest first)
      panelsWithDistance.sort((a, b) => a.distance - b.distance);
      
      console.log('[App] Panels sorted by distance:', panelsWithDistance.map(p => ({
        id: p.locationId,
        distance: p.distance
      })));
      
      // Show panels with delay based on distance order
      const delayBetweenPanels = 150; // 150ms between each panel
      
      panelsWithDistance.forEach((panelData, index) => {
        const delay = index * delayBetweenPanels;
        
        setTimeout(() => {
          console.log(`[App] Showing panel ${index + 1}/${panelsWithDistance.length} for ${panelData.locationId} (distance: ${panelData.distance.toFixed(2)})`);
          
          // Calculate auto-hide duration: closer panels disappear sooner
          // Base duration: 10 seconds
          // Closest panel: 10s, furthest panel: 10s + (count-1) * 1s
          const autoHideDuration = 10000 + (index * 1000);
          
          this.mapRenderer.showSearchResultPanel(
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
    if (this.chatPanel) {
      this.chatPanel.addMessage('system', `Simulation completed!\n\nFinal Report:\n${data.report}`);
    }
  }
  
  /**
   * Update connection status in stats panel
   */
  updateConnectionStatusInStats(connected, reconnecting = false) {
    console.log('[App] Updating connection status:', { connected, reconnecting });
    
    if (!this.statsPanel) {
      console.warn('[App] Stats panel not initialized yet');
      return;
    }
    
    if (!this.statsPanel.elements || !this.statsPanel.elements.connectionStatus) {
      console.warn('[App] Connection status element not found in stats panel');
      return;
    }
    
    const statusElement = this.statsPanel.elements.connectionStatus;
    const statusText = statusElement.querySelector('.status-text');
    
    console.log('[App] Status element:', statusElement);
    console.log('[App] Status text element:', statusText);
    
    if (connected) {
      if (statusText) statusText.textContent = 'Connected';
      statusElement.className = 'connection-status connected';
      console.log('[App] Set status to connected');
    } else if (reconnecting) {
      if (statusText) statusText.textContent = 'Reconnecting...';
      statusElement.className = 'connection-status reconnecting';
      console.log('[App] Set status to reconnecting');
    } else {
      if (statusText) statusText.textContent = 'Disconnected';
      statusElement.className = 'connection-status disconnected';
      console.log('[App] Set status to disconnected');
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
  // DOM already loaded
  window.app = new Application();
  window.app.initialize();
}
