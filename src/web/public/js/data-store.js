/**
 * DataStore - Central data management layer
 * 
 * Provides a single source of truth for all application data.
 * Components subscribe to data changes and render accordingly.
 * WebSocket messages update the store, which then notifies subscribers.
 */
class DataStore {
  constructor() {
    // Subscribers map: key -> array of callbacks
    this.subscribers = new Map();
    
    // Core data state
    this.state = {
      // Connection status
      connected: false,
      reconnecting: false,
      
      // Model info
      modelName: 'AI',
      
      // Game state
      currentTime: 0,
      formattedTime: '--:--',
      currentIteration: 0,
      maxIterations: 0,
      
      // Token usage
      lastTotalTokens: 0,
      lastPromptTokens: 0,
      lastCompletionTokens: 0,
      cumulativeTotalTokens: 0,
      cumulativePromptTokens: 0,
      cumulativeCompletionTokens: 0,
      
      // Agent state
      agentState: {
        position: '',
        battery: 100,
        profit: 0,
        carriedOrders: [],
        totalWeight: 0,
        completedOrders: 0
      },
      
      // Tool calls tracking
      totalToolCalls: 0,
      toolCalls: [], // Array of {toolName, arguments, timestamp, result}
      
      // Conversations (all messages including tool calls/results)
      conversations: [], // Array of {type, role, content, toolName, arguments, result, timestamp}
      
      // Map data
      nodes: [],
      edges: [],
      config: {}
    };
    
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
   * Subscribe to data changes
   * @param {string} key - Data key to watch (use '*' for all changes)
   * @param {Function} callback - Function to call when data changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, []);
    }
    this.subscribers.get(key).push(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(key);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Notify subscribers of data change
   * @param {string} key - Data key that changed
   * @param {any} value - New value
   */
  notify(key, value) {
    // Notify specific key subscribers
    const keyCallbacks = this.subscribers.get(key);
    if (keyCallbacks) {
      keyCallbacks.forEach(cb => {
        try {
          cb(value, key);
        } catch (error) {
          console.error(`[DataStore] Subscriber error for key ${key}:`, error);
        }
      });
    }
    
    // Notify wildcard subscribers
    const wildcardCallbacks = this.subscribers.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(cb => {
        try {
          cb(value, key);
        } catch (error) {
          console.error(`[DataStore] Wildcard subscriber error:`, error);
        }
      });
    }
  }

  /**
   * Get current state value
   * @param {string} key - Data key
   * @returns {any} Current value
   */
  get(key) {
    return this.state[key];
  }

  /**
   * Get entire state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update connection status
   * @param {boolean} connected - Connection status
   * @param {boolean} reconnecting - Reconnecting status
   */
  updateConnectionStatus(connected, reconnecting = false) {
    this.state.connected = connected;
    this.state.reconnecting = reconnecting;
    this.notify('connectionStatus', { connected, reconnecting });
  }

  /**
   * Handle init message
   * @param {Object} data - Init data from server
   */
  handleInit(data) {
    this.state.nodes = data.nodes || [];
    this.state.edges = data.edges || [];
    this.state.config = data.config || {};
    
    if (data.config && data.config.modelName) {
      this.state.modelName = data.config.modelName;
    }
    
    this.notify('init', data);
    this.notify('modelName', this.state.modelName);
  }

  /**
   * Handle state update message
   * @param {Object} data - State update data
   */
  handleStateUpdate(data) {
    // Update time
    if (data.currentTime !== undefined) {
      this.state.currentTime = data.currentTime;
    }
    if (data.formattedTime !== undefined) {
      this.state.formattedTime = data.formattedTime;
    }
    
    // Update iteration
    if (data.currentIteration !== undefined) {
      this.state.currentIteration = data.currentIteration;
    }
    if (data.maxIterations !== undefined) {
      this.state.maxIterations = data.maxIterations;
    }
    
    // Update tokens
    if (data.lastTotalTokens !== undefined) {
      this.state.lastTotalTokens = data.lastTotalTokens;
    }
    if (data.lastPromptTokens !== undefined) {
      this.state.lastPromptTokens = data.lastPromptTokens;
    }
    if (data.lastCompletionTokens !== undefined) {
      this.state.lastCompletionTokens = data.lastCompletionTokens;
    }
    if (data.cumulativeTotalTokens !== undefined) {
      this.state.cumulativeTotalTokens = data.cumulativeTotalTokens;
    }
    if (data.cumulativePromptTokens !== undefined) {
      this.state.cumulativePromptTokens = data.cumulativePromptTokens;
    }
    if (data.cumulativeCompletionTokens !== undefined) {
      this.state.cumulativeCompletionTokens = data.cumulativeCompletionTokens;
    }
    
    // Update agent state
    if (data.agentState) {
      this.state.agentState = { ...this.state.agentState, ...data.agentState };
    }
    
    this.notify('stateUpdate', data);
  }

  /**
   * Handle conversation message
   * @param {Object} data - Conversation data
   */
  handleConversation(data) {
    const conversation = {
      type: 'message',
      role: data.role,
      content: data.content,
      timestamp: Date.now()
    };
    
    this.state.conversations.push(conversation);
    this.notify('conversation', conversation);
    this.notify('conversations', this.state.conversations);
  }

  /**
   * Handle reasoning message
   * @param {Object} data - Reasoning data
   */
  handleReasoning(data) {
    const reasoning = {
      type: 'reasoning',
      content: data.content,
      timestamp: Date.now()
    };
    
    this.state.conversations.push(reasoning);
    this.notify('reasoning', reasoning);
    this.notify('conversations', this.state.conversations);
  }

  /**
   * Handle tool call message
   * @param {Object} data - Tool call data
   */
  handleToolCall(data) {
    this.state.totalToolCalls++;
    
    const toolCall = {
      type: 'tool_call',
      toolName: data.toolName,
      toolNameChinese: this.toolNameMap[data.toolName] || data.toolName,
      arguments: data.arguments,
      timestamp: Date.now()
    };
    
    this.state.toolCalls.push(toolCall);
    this.state.conversations.push(toolCall);
    
    this.notify('toolCall', toolCall);
    this.notify('totalToolCalls', this.state.totalToolCalls);
    this.notify('conversations', this.state.conversations);
  }

  /**
   * Handle tool result message
   * @param {Object} data - Tool result data
   */
  handleToolResult(data) {
    const toolResult = {
      type: 'tool_result',
      toolName: data.toolName,
      toolNameChinese: this.toolNameMap[data.toolName] || data.toolName,
      success: data.success,
      result: data.result,
      timestamp: Date.now()
    };
    
    // Update the last matching tool call with result
    for (let i = this.state.toolCalls.length - 1; i >= 0; i--) {
      if (this.state.toolCalls[i].toolName === data.toolName && !this.state.toolCalls[i].result) {
        this.state.toolCalls[i].result = data.result;
        this.state.toolCalls[i].success = data.success;
        break;
      }
    }
    
    this.state.conversations.push(toolResult);
    
    this.notify('toolResult', toolResult);
    this.notify('conversations', this.state.conversations);
  }

  /**
   * Handle simulation end message
   * @param {Object} data - Simulation end data
   */
  handleSimulationEnd(data) {
    const endMessage = {
      type: 'simulation_end',
      report: data.report,
      finalProfit: data.finalProfit,
      completedOrders: data.completedOrders,
      totalDistance: data.totalDistance,
      timestamp: Date.now()
    };
    
    this.state.conversations.push(endMessage);
    this.notify('simulationEnd', endMessage);
    this.notify('conversations', this.state.conversations);
  }

  /**
   * Get summary text for a conversation item
   * @param {Object} item - Conversation item
   * @returns {string} Summary text
   */
  getConversationSummary(item) {
    if (item.type === 'tool_call') {
      return item.toolName;
    } else if (item.type === 'tool_result') {
      return item.success ? `✓ ${item.toolName}` : `✗ ${item.toolName}`;
    } else if (item.type === 'reasoning') {
      return this.getFirstWords(item.content, 5);
    } else if (item.type === 'message') {
      return this.getFirstWords(item.content, 5);
    } else if (item.type === 'simulation_end') {
      return 'Simulation End';
    }
    return 'Unknown';
  }

  /**
   * Get first N words from text
   * @param {string} text - Text to extract from
   * @param {number} n - Number of words
   * @returns {string} First N words
   */
  getFirstWords(text, n) {
    if (!text) return '';
    const words = text.trim().split(/\s+/);
    if (words.length <= n) return text;
    return words.slice(0, n).join(' ') + '...';
  }

  /**
   * Clear all data (for reset)
   */
  clear() {
    this.state.totalToolCalls = 0;
    this.state.toolCalls = [];
    this.state.conversations = [];
    this.state.currentTime = 0;
    this.state.formattedTime = '--:--';
    this.state.currentIteration = 0;
    this.state.lastTotalTokens = 0;
    this.state.cumulativeTotalTokens = 0;
    this.state.agentState = {
      position: '',
      battery: 100,
      profit: 0,
      carriedOrders: [],
      totalWeight: 0,
      completedOrders: 0
    };
    
    this.notify('clear', null);
  }
}

// Create singleton instance
const dataStore = new DataStore();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DataStore, dataStore };
}

