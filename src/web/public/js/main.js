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
    if (this.chatPanel) {
      this.chatPanel.addToolResult(data.toolName, data.success, data.result);
    } else {
      console.warn('[App] Chat panel not initialized');
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
