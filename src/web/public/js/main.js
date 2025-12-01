/**
 * Silicon Rider Bench - Web Visualization
 * Main Client Logic
 * 
 * Handles WebSocket connection, message routing, and connection state management
 * 
 * Version: 1.1.0 - Fixed undefined toFixed() error
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
      
      if (!message.type) {
        console.warn('[WebSocket] Message missing type field:', message);
        return;
      }

      // Route message to registered handlers
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
    this.mapContainer = document.getElementById('map-container');
    this.statsContainer = document.getElementById('stats-panel');
    this.chatContainer = document.getElementById('chat-panel');

    if (!this.mapContainer) {
      console.error('[UI] Map container element not found');
    }
    if (!this.statsContainer) {
      console.error('[UI] Stats container element not found');
    }
    if (!this.chatContainer) {
      console.error('[UI] Chat container element not found');
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
    this.totalToolCalls = 0; // Cumulative tool call counter
    
    // Tool name to Chinese mapping
    this.toolNameMap = {
      'get_my_status': '查询状态',
      'get_map': '获取地图',
      'search_nearby_orders': '搜索订单',
      'search_nearby_battery_stations': '搜索换电站',
      'accept_order': '接受订单',
      'move_to': '移动',
      'pickup_food': '取餐',
      'deliver_food': '送餐',
      'swap_battery': '换电',
      'get_location_info': '查询位置信息',
      'calculate_distance': '计算距离',
      'estimate_time': '估算时间',
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

    // Handle reasoning messages (from thinking models)
    this.connectionManager.on('reasoning', (message) => {
      this.handleReasoning(message.data);
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
    // Initialize map renderer when available
    if (typeof MapRenderer !== 'undefined' && this.uiManager.mapContainer) {
      this.mapRenderer = new MapRenderer(this.uiManager.mapContainer);
      this.mapRenderer.initialize(data.nodes, data.edges);
      this.mapRenderer.render();
    } else {
      console.warn('[App] MapRenderer not available or container not found');
    }

    // Initialize stats panel when available
    if (typeof StatsPanel !== 'undefined' && this.uiManager.statsContainer) {
      this.statsPanel = new StatsPanel(this.uiManager.statsContainer);
      
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
      this.chatPanel = new ChatPanel(this.uiManager.chatContainer);
    } else {
      console.warn('[App] ChatPanel not available or container not found');
    }
  }

  /**
   * Handle state update message
   */
  handleStateUpdate(data) {
    // Update map renderer
    if (this.mapRenderer) {
      this.mapRenderer.updateAgentPosition(data.agentState.position);
      this.mapRenderer.render();
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
    // Show action panel for assistant messages
    if (data.role === 'assistant' && data.content && this.mapRenderer) {
      // Truncate long content
      let displayContent = data.content;
      if (displayContent.length > 100) {
        displayContent = displayContent.substring(0, 100) + '...';
      }
      
      const actionText = `${this.modelName}: ${displayContent}`;
      this.mapRenderer.showActionPanel(actionText, 'conversation');
    }
    
    if (this.chatPanel) {
      this.chatPanel.addMessage(data.role, data.content);
    }
  }

  /**
   * Handle reasoning message (from thinking models)
   */
  handleReasoning(data) {
    console.log('[App] Reasoning content received:', data.content);
    
    // Show reasoning panel
    if (data.content && this.mapRenderer) {
      // Truncate long reasoning content
      let displayContent = data.content;
      if (displayContent.length > 150) {
        displayContent = displayContent.substring(0, 150) + '...';
      }
      
      const reasoningText = `${this.modelName} 💭: ${displayContent}`;
      this.mapRenderer.showActionPanel(reasoningText, 'reasoning');
    }
    
    // Also add to chat panel if available
    if (this.chatPanel) {
      this.chatPanel.addMessage('system', `💭 ${this.modelName} 思考过程:\n${data.content}`);
    }
  }

  /**
   * Handle tool call message
   */
  handleToolCall(data) {
    console.log('[App] handleToolCall called:', data.toolName, 'mapRenderer exists:', !!this.mapRenderer);
    
    // Increment tool call counter (note: one message may contain multiple tool calls)
    // Each call to handleToolCall represents one tool call
    this.totalToolCalls++;
    
    // Update stats panel with new tool call count
    if (this.statsPanel) {
      this.statsPanel.updateToolCalls(this.totalToolCalls);
    }
    
    // Show action panel for tool call
    if (this.mapRenderer) {
      const toolNameChinese = this.toolNameMap[data.toolName] || data.toolName;
      const argsStr = JSON.stringify(data.arguments || {});
      
      // Create HTML with badge for action name
      const actionHtml = `<span class="tool-action-badge">${toolNameChinese}</span> 调用 tool ${data.toolName}(${argsStr})`;
      
      this.mapRenderer.showActionPanel(actionHtml, 'tool-call');
      
      // Show critical hit animation for specific actions
      const criticalHitMap = {
        'pickup_food': '➕🍱',
        'deliver_food': '➖🍱',
        'swap_battery': '➕🔋',
        'accept_order': '➕📋'
      };
      
      if (criticalHitMap[data.toolName]) {
        console.log('[App] ✨ Tool matches critical hit map:', data.toolName, '→', criticalHitMap[data.toolName]);
        console.log('[App] Agent position:', this.mapRenderer.agentPosition);
        console.log('[App] Agent element exists:', !!this.mapRenderer.agentElement);
        this.mapRenderer.showCriticalHitAnimation(criticalHitMap[data.toolName]);
      } else {
        console.log('[App] Tool does NOT match critical hit map:', data.toolName);
      }
    } else {
      console.warn('[App] mapRenderer not available for tool call:', data.toolName);
    }
    
    // Show sonar animation for search tools
    if ((data.toolName === 'search_nearby_orders' || data.toolName === 'search_nearby_battery_stations') && this.mapRenderer) {
      // Extract radius from arguments
      const radius = data.arguments && data.arguments.radius ? data.arguments.radius : 10;
      
      // Store the tool name to handle panels after animation
      this.pendingSonarToolName = data.toolName;
      
      this.mapRenderer.showSonarAnimation(radius);
    }
    
    if (this.chatPanel) {
      this.chatPanel.addToolCall(data.toolName, data.arguments);
    }
  }

  /**
   * Handle tool result message
   */
  handleToolResult(data) {
    // Show search result panels for search tools
    if (data.success && this.mapRenderer) {
      // 后端返回格式是 {success: true, data: {orders: [...]} }
      const resultData = data.result && data.result.data ? data.result.data : data.result;
      
      // Debug log for path-related tools
      if (data.toolName === 'calculate_distance' || data.toolName === 'estimate_time') {
        console.log('[App] Tool result data:', data.toolName, resultData);
      }
      
      if (data.toolName === 'search_nearby_orders' && resultData && resultData.orders) {
        // Collect panel data
        const panelDataList = [];
        resultData.orders.forEach((order) => {
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
          }
        });
        
        // Wait for sonar animation to complete before showing panels
        this.showPanelsAfterSonar(panelDataList);
        
      } else if (data.toolName === 'search_nearby_battery_stations' && resultData && resultData.stations) {
        // Collect panel data
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
        
        // Wait for sonar animation to complete before showing panels
        this.showPanelsAfterSonar(panelDataList);
        
      } else if (data.toolName === 'get_location_info' && resultData && resultData.id) {
        // Show location info panel at the target location (non-blocking, with 0.5s delay)
        setTimeout(() => {
          this.mapRenderer.showLocationInfoPanel(resultData.id, {
            name: resultData.name || 'Unknown',
            type: resultData.type || 'unknown',
            position: resultData.position || { x: 0, y: 0 }
          });
        }, 500);
        
      } else if (data.toolName === 'calculate_distance' && resultData && resultData.path) {
        // Show path animation with green color (non-blocking, with 0.5s delay)
        setTimeout(() => {
          // Safely extract distance with default
          const distance = typeof resultData.distance === 'number' ? resultData.distance : 0;
          
          this.mapRenderer.showPathAnimation(
            resultData.path,
            'green',
            {
              distance: distance.toFixed(2) + ' km'
            }
          );
        }, 500);
        
      } else if (data.toolName === 'estimate_time' && resultData) {
        console.log('[App] 🔵 estimate_time result data:', resultData);
        console.log('[App] Has segments:', !!resultData.segments);
        
        if (resultData.segments) {
          // Show path animation with blue color (non-blocking, with 0.5s delay)
          setTimeout(() => {
            // Extract complete path from segments
            const path = [];
            let totalDistance = 0;
            
            if (resultData.segments && resultData.segments.length > 0) {
              // Merge all segment paths into one complete path
              resultData.segments.forEach((segment, index) => {
                if (segment.path && segment.path.length > 0) {
                  if (index === 0) {
                    // First segment: add all nodes
                    path.push(...segment.path);
                  } else {
                    // Subsequent segments: skip first node (already added as last node of previous segment)
                    path.push(...segment.path.slice(1));
                  }
                }
                totalDistance += segment.distance || 0;
              });
            }
            
            // Safely extract time with default
            const totalTime = typeof resultData.totalTime === 'number' ? resultData.totalTime : 0;
            
            console.log('[App] 🔵 estimate_time extracted path:', path);
            console.log('[App] 🔵 Path length:', path.length);
            console.log('[App] 🔵 Total distance:', totalDistance, 'km');
            console.log('[App] 🔵 Total time:', totalTime, 'min');
            
            if (path.length >= 2) {
              console.log('[App] 🔵 Calling showPathAnimation with blue color');
              this.mapRenderer.showPathAnimation(
                path,
                'blue',
                {
                  time: totalTime.toFixed(2) + ' 分钟',
                  distance: totalDistance.toFixed(2) + ' km'
                }
              );
            } else {
              console.warn('[App] ⚠️  Path too short, not showing animation. Path:', path);
            }
          }, 500);
        } else {
          console.warn('[App] ⚠️  estimate_time result has no segments');
        }
      }
    }
    
    if (this.chatPanel) {
      this.chatPanel.addToolResult(data.toolName, data.success, data.result);
    }
  }
  
  /**
   * Show panels after sonar animation completes
   */
  showPanelsAfterSonar(panelDataList) {
    // Check if sonar is currently animating
    if (this.mapRenderer.isSonarAnimating) {
      // Wait and check again
      setTimeout(() => {
        this.showPanelsAfterSonar(panelDataList);
      }, 100);
    } else {
      // Calculate distances and sort by distance (closest first)
      const panelsWithDistance = panelDataList.map(panelData => {
        const distance = this.mapRenderer.calculateDistanceToAgent(panelData.locationId);
        return { ...panelData, distance };
      });
      
      // Sort by distance (ascending - closest first)
      panelsWithDistance.sort((a, b) => a.distance - b.distance);
      
      // Show panels with delay based on distance order
      const delayBetweenPanels = 150; // 150ms between each panel
      
      panelsWithDistance.forEach((panelData, index) => {
        const delay = index * delayBetweenPanels;
        
        setTimeout(() => {
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
    if (!this.statsPanel || !this.statsPanel.elements || !this.statsPanel.elements.connectionStatus) {
      return;
    }
    
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
