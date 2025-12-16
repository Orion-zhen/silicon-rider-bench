/**
 * i18n - Internationalization Module
 * 
 * Provides multi-language support for the application.
 * Supports Chinese (zh) and English (en).
 */
const i18n = {
  // Current language
  currentLang: 'zh',
  
  // Available languages
  languages: {
    zh: '中文',
    en: 'English'
  },
  
  // Translation strings
  translations: {
    zh: {
      // Navigation
      'nav.homepage': '主页',
      'nav.map': '地图',
      'nav.agentDetail': 'Agent 详情',
      'nav.settings': '设置',
      
      // Homepage
      'home.title': '🛵 Silicon Rider Bench',
      'home.github': 'github.com/KCORES/silicon-rider-bench',
      'home.aiConversation': 'AI 对话',
      'home.waitingAI': '🤖 等待 AI 代理启动...',
      
      // Stats Panel
      'stats.gameStatus': '模拟状态',
      'stats.connection': '连接',
      'stats.connected': '已连接',
      'stats.disconnected': '已断开',
      'stats.reconnecting': '重连中...',
      'stats.model': '模型',
      'stats.time': '时间',
      'stats.turn': '回合',
      'stats.tokensLast': 'Tokens (本次)',
      'stats.tokensTotal': 'Tokens (累计)',
      'stats.agentStatus': '代理状态',
      'stats.toolCalls': '工具调用',
      'stats.battery': '电量',
      'stats.profit': '收益',
      'stats.carriedOrders': '携带订单',
      'stats.totalWeight': '总重量',
      'stats.completed': '已完成',
      'stats.ordersInBackpack': '背包中的订单',
      'stats.noOrders': '无订单',
      'stats.pickedUp': '📦 已取餐',
      'stats.assigned': '📋 已接单',
      'stats.items': '物品',
      'stats.weight': '重量',
      'stats.deliveryFee': '配送费',
      'stats.deadline': '截止时间',
      'stats.deadlineOverdue': '截止时间 (已逾期)',
      
      // Agent Detail Page
      'detail.toolCalls': '工具调用',
      'detail.toolCallsDesc': '总 API 调用次数',
      'detail.turn': '回合',
      'detail.turnDesc': '当前迭代',
      'detail.tokensLast': 'Tokens (本次)',
      'detail.tokensLastDesc': '本次调用消耗',
      'detail.tokensTotal': 'Tokens (累计)',
      'detail.tokensTotalDesc': '累计消耗',
      'detail.profit': '收益',
      'detail.profitDesc': '收入余额',
      'detail.conversationFlow': '对话流',
      'detail.items': '条目',
      'detail.filterAll': '全部',
      'detail.filterTool': '🔧 工具',
      'detail.filterResult': '✓ 结果',
      'detail.filterMessage': '💬 消息',
      'detail.filterThink': '💭 思考',
      
      // Settings Page
      'settings.title': '设置',
      'settings.language': '语言',
      'settings.languageDesc': '选择界面语言',
      'settings.theme': '主题',
      'settings.themeDesc': '选择界面主题 (即将推出)',
      'settings.about': '关于',
      'settings.version': '版本',
      'settings.description': 'Silicon Rider Bench 是世界上首个多模态 Agent 基准测试项目，旨在评估单模态/多模态模型作为智能体的能力。',
      
      // Chat Panel
      'chat.user': '👤 用户',
      'chat.assistant': '🤖 AI 代理',
      'chat.system': '⚙️ 系统',
      'chat.toolCall': '🔧 工具调用',
      'chat.toolResult': '工具结果',
      'chat.success': '成功',
      'chat.error': '错误',
      
      // Tool Names
      'tool.get_my_status': '查询状态',
      'tool.get_map': '获取地图',
      'tool.search_nearby_orders': '搜索订单',
      'tool.search_nearby_battery_stations': '搜索换电站',
      'tool.accept_order': '接受订单',
      'tool.move_to': '移动',
      'tool.pickup_food': '取餐',
      'tool.deliver_food': '送餐',
      'tool.swap_battery': '换电',
      'tool.get_location_info': '查询位置信息',
      'tool.calculate_distance': '计算距离',
      'tool.estimate_time': '估算时间',
      
      // Badge Types
      'badge.tool': '🔧 工具',
      'badge.result': '✓ 结果',
      'badge.user': '👤 用户',
      'badge.assistant': '🤖 AI',
      'badge.system': '⚙️ 系统',
      'badge.think': '💭 思考',
      'badge.end': '🏁 结束',
      
      // Misc
      'misc.simulationComplete': '模拟完成！',
      'misc.finalReport': '最终报告'
    },
    
    en: {
      // Navigation
      'nav.homepage': 'Homepage',
      'nav.map': 'Map',
      'nav.agentDetail': 'Agent Detail',
      'nav.settings': 'Settings',
      
      // Homepage
      'home.title': '🛵 Silicon Rider Bench',
      'home.github': 'github.com/KCORES/silicon-rider-bench',
      'home.aiConversation': 'AI Conversation',
      'home.waitingAI': '🤖 Waiting for AI agent to start...',
      
      // Stats Panel
      'stats.gameStatus': 'Game Status',
      'stats.connection': 'Connection',
      'stats.connected': 'Connected',
      'stats.disconnected': 'Disconnected',
      'stats.reconnecting': 'Reconnecting...',
      'stats.model': 'Model',
      'stats.time': 'Time',
      'stats.turn': 'Turn',
      'stats.tokensLast': 'Tokens (Last)',
      'stats.tokensTotal': 'Tokens (Total)',
      'stats.agentStatus': 'Agent Status',
      'stats.toolCalls': 'Tool Calls',
      'stats.battery': 'Battery',
      'stats.profit': 'Profit',
      'stats.carriedOrders': 'Carried Orders',
      'stats.totalWeight': 'Total Weight',
      'stats.completed': 'Completed',
      'stats.ordersInBackpack': 'Orders in Backpack',
      'stats.noOrders': 'No orders',
      'stats.pickedUp': '📦 Picked up',
      'stats.assigned': '📋 Assigned',
      'stats.items': 'Items',
      'stats.weight': 'Weight',
      'stats.deliveryFee': 'Delivery Fee',
      'stats.deadline': 'Deadline',
      'stats.deadlineOverdue': 'Deadline (OVERDUE)',
      
      // Agent Detail Page
      'detail.toolCalls': 'Tool Calls',
      'detail.toolCallsDesc': 'Total API calls made',
      'detail.turn': 'Turn',
      'detail.turnDesc': 'Current iteration',
      'detail.tokensLast': 'Tokens (Last)',
      'detail.tokensLastDesc': 'Last call usage',
      'detail.tokensTotal': 'Tokens (Total)',
      'detail.tokensTotalDesc': 'Cumulative usage',
      'detail.profit': 'Profit',
      'detail.profitDesc': 'Earnings balance',
      'detail.conversationFlow': 'Conversation Flow',
      'detail.items': 'items',
      'detail.filterAll': 'All',
      'detail.filterTool': '🔧 Tool',
      'detail.filterResult': '✓ Result',
      'detail.filterMessage': '💬 Message',
      'detail.filterThink': '💭 Think',
      
      // Settings Page
      'settings.title': 'Settings',
      'settings.language': 'Language',
      'settings.languageDesc': 'Select interface language',
      'settings.theme': 'Theme',
      'settings.themeDesc': 'Select interface theme (Coming soon)',
      'settings.about': 'About',
      'settings.version': 'Version',
      'settings.description': 'Silicon Rider Bench is the world\'s first multimodal Agent benchmark project, designed to evaluate the capabilities of unimodal/multimodal models as intelligent agents.',
      
      // Chat Panel
      'chat.user': '👤 User',
      'chat.assistant': '🤖 AI Agent',
      'chat.system': '⚙️ System',
      'chat.toolCall': '🔧 Tool Call',
      'chat.toolResult': 'Tool Result',
      'chat.success': 'Success',
      'chat.error': 'Error',
      
      // Tool Names
      'tool.get_my_status': 'Get Status',
      'tool.get_map': 'Get Map',
      'tool.search_nearby_orders': 'Search Orders',
      'tool.search_nearby_battery_stations': 'Search Stations',
      'tool.accept_order': 'Accept Order',
      'tool.move_to': 'Move To',
      'tool.pickup_food': 'Pickup Food',
      'tool.deliver_food': 'Deliver Food',
      'tool.swap_battery': 'Swap Battery',
      'tool.get_location_info': 'Get Location Info',
      'tool.calculate_distance': 'Calculate Distance',
      'tool.estimate_time': 'Estimate Time',
      
      // Badge Types
      'badge.tool': '🔧 Tool',
      'badge.result': '✓ Result',
      'badge.user': '👤 User',
      'badge.assistant': '🤖 AI',
      'badge.system': '⚙️ Sys',
      'badge.think': '💭 Think',
      'badge.end': '🏁 End',
      
      // Misc
      'misc.simulationComplete': 'Simulation completed!',
      'misc.finalReport': 'Final Report'
    }
  },
  
  // Subscribers for language change
  subscribers: [],
  
  /**
   * Initialize i18n with saved language preference
   */
  init() {
    const savedLang = localStorage.getItem('silicon-rider-lang');
    if (savedLang && this.languages[savedLang]) {
      this.currentLang = savedLang;
    }
  },
  
  /**
   * Get translation for a key
   * @param {string} key - Translation key
   * @param {Object} params - Optional parameters for interpolation
   * @returns {string} Translated string
   */
  t(key, params = {}) {
    const translations = this.translations[this.currentLang];
    let text = translations[key] || this.translations['en'][key] || key;
    
    // Simple parameter interpolation
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param]);
    });
    
    return text;
  },
  
  /**
   * Set current language
   * @param {string} lang - Language code ('zh' or 'en')
   */
  setLanguage(lang) {
    if (!this.languages[lang]) {
      console.warn(`[i18n] Unknown language: ${lang}`);
      return;
    }
    
    this.currentLang = lang;
    localStorage.setItem('silicon-rider-lang', lang);
    
    // Notify subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(lang);
      } catch (error) {
        console.error('[i18n] Subscriber error:', error);
      }
    });
  },
  
  /**
   * Get current language
   * @returns {string} Current language code
   */
  getLanguage() {
    return this.currentLang;
  },
  
  /**
   * Subscribe to language changes
   * @param {Function} callback - Function to call when language changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  },
  
  /**
   * Get tool name in current language
   * @param {string} toolName - Tool name in English
   * @returns {string} Localized tool name
   */
  getToolName(toolName) {
    return this.t(`tool.${toolName}`) || toolName;
  }
};

// Initialize on load
i18n.init();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = i18n;
}

