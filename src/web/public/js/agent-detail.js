/**
 * AgentDetailPage - Agent Detail Page Component
 * 
 * Displays detailed agent information with:
 * - Dashboard cards for key metrics (Tool Calls, Turn, Tokens, Profit)
 * - Masonry layout of conversation badges with type filtering
 * - Click-to-expand detail popups
 */
class AgentDetailPage {
  constructor(containerElement, dataStore) {
    this.container = containerElement;
    this.dataStore = dataStore;
    
    // Cache DOM elements
    this.elements = {
      benchmarkName: null,
      modelName: null,
      toolCalls: null,
      turn: null,
      tokensLast: null,
      tokensTotal: null,
      profit: null,
      badgeContainer: null,
      badgeCount: null,
      filterContainer: null
    };
    
    // Track rendered badges
    this.renderedBadgeCount = 0;
    
    // Active popup
    this.activePopup = null;
    
    // Current filters (Set for multi-select, empty = show all)
    this.currentFilters = new Set();
    
    // All badge elements for filtering
    this.badgeElements = [];
    
    // Auto-scroll state
    this.autoScrollEnabled = true;
    this.isUserScrolling = false;
    this.scrollTimeout = null;
    
    // Previous values for animation
    this.previousValues = {
      toolCalls: 0,
      turn: '0/0',
      tokensLast: 0,
      tokensTotal: 0,
      profit: 0
    };
    
    this.initialize();
  }

  /**
   * Initialize the page
   */
  initialize() {
    this.cacheElements();
    this.bindEvents();
    this.subscribeToData();
    
    // Subscribe to language changes
    if (typeof i18n !== 'undefined') {
      i18n.subscribe(() => this.updateLabels());
    }
    
    // Initial render with current data
    this.updateFromDataStore();
  }

  /**
   * Update labels when language changes
   */
  updateLabels() {
    // Update dashboard card labels
    const cardLabels = {
      'card-tool-calls': ['detail.toolCalls', 'detail.toolCallsDesc'],
      'card-turn': ['detail.turn', 'detail.turnDesc'],
      'card-tokens-last': ['detail.tokensLast', 'detail.tokensLastDesc'],
      'card-tokens-total': ['detail.tokensTotal', 'detail.tokensTotalDesc'],
      'card-profit': ['detail.profit', 'detail.profitDesc']
    };
    
    Object.entries(cardLabels).forEach(([cardClass, [labelKey, descKey]]) => {
      const card = this.container.querySelector(`.${cardClass}`);
      if (card) {
        const label = card.querySelector('.card-label');
        const subtitle = card.querySelector('.card-subtitle');
        if (label) label.textContent = i18n.t(labelKey);
        if (subtitle) subtitle.textContent = i18n.t(descKey);
      }
    });
    
    // Update model label
    const modelLabel = this.container.querySelector('.model-label');
    if (modelLabel) {
      modelLabel.textContent = i18n.t('stats.model') + ':';
    }
    
    // Update section title
    const sectionTitle = this.container.querySelector('.section-title');
    if (sectionTitle) {
      sectionTitle.textContent = i18n.t('detail.conversationFlow');
    }
    
    // Update filter buttons
    const filterBtns = this.container.querySelectorAll('.filter-btn');
    const filterLabels = {
      'all': 'detail.filterAll',
      'tool_call': 'detail.filterTool',
      'tool_result': 'detail.filterResult',
      'message': 'detail.filterMessage',
      'reasoning': 'detail.filterThink'
    };
    
    filterBtns.forEach(btn => {
      const filter = btn.dataset.filter;
      if (filterLabels[filter]) {
        btn.textContent = i18n.t(filterLabels[filter]);
      }
    });
  }

  /**
   * Cache DOM elements for performance
   */
  cacheElements() {
    this.elements = {
      benchmarkName: this.container.querySelector('#detail-benchmark-name'),
      modelName: this.container.querySelector('#detail-model-name'),
      toolCalls: this.container.querySelector('#detail-tool-calls'),
      turn: this.container.querySelector('#detail-turn'),
      tokensLast: this.container.querySelector('#detail-tokens-last'),
      tokensTotal: this.container.querySelector('#detail-tokens-total'),
      profit: this.container.querySelector('#detail-profit'),
      badgeContainer: this.container.querySelector('#badge-masonry'),
      badgeCount: this.container.querySelector('#badge-count'),
      filterContainer: this.container.querySelector('#filter-container')
    };
    
    // Update model name from data store
    const modelName = this.dataStore.get('modelName');
    if (this.elements.modelName && modelName) {
      this.elements.modelName.textContent = modelName;
    }
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Badge click handler (delegated)
    if (this.elements.badgeContainer) {
      this.elements.badgeContainer.addEventListener('click', (e) => {
        const badge = e.target.closest('.capsule-badge');
        if (badge) {
          const index = parseInt(badge.dataset.index, 10);
          this.showBadgeDetail(index, badge);
        }
      });
      
      // Scroll event handler for auto-scroll control
      this.elements.badgeContainer.addEventListener('scroll', () => {
        this.handleScroll();
      });
      
      // Detect user-initiated scroll (wheel, touch, keyboard)
      this.elements.badgeContainer.addEventListener('wheel', () => {
        this.onUserScroll();
      }, { passive: true });
      
      this.elements.badgeContainer.addEventListener('touchmove', () => {
        this.onUserScroll();
      }, { passive: true });
      
      // Keyboard scrolling detection
      this.elements.badgeContainer.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
          this.onUserScroll();
        }
      });
    }
    
    // Filter click handler (delegated) - supports multi-select
    if (this.elements.filterContainer) {
      this.elements.filterContainer.addEventListener('click', (e) => {
        const filterBtn = e.target.closest('.filter-btn');
        if (filterBtn) {
          const filterType = filterBtn.dataset.filter;
          this.toggleFilter(filterType);
        }
      });
    }
    
    // Close popup when clicking outside
    document.addEventListener('click', (e) => {
      if (this.activePopup && !e.target.closest('.capsule-badge') && !e.target.closest('.badge-detail-popup')) {
        this.closePopup();
      }
    });
    
    // Close popup on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.activePopup) {
        this.closePopup();
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });
  }

  /**
   * Handle user-initiated scroll
   */
  onUserScroll() {
    this.isUserScrolling = true;
    
    // Clear any existing timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    // Set a short timeout to allow scroll position to update
    this.scrollTimeout = setTimeout(() => {
      this.isUserScrolling = false;
    }, 100);
  }

  /**
   * Handle scroll event to determine if auto-scroll should be enabled
   */
  handleScroll() {
    if (!this.elements.badgeContainer) return;
    
    const container = this.elements.badgeContainer;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Check if scrolled to bottom (within 20px threshold)
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20;
    
    // If user scrolled and we're at bottom, re-enable auto-scroll
    if (isAtBottom) {
      this.autoScrollEnabled = true;
    } else if (this.isUserScrolling) {
      // User scrolled away from bottom, disable auto-scroll
      this.autoScrollEnabled = false;
    }
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Re-check scroll position after resize
    if (this.autoScrollEnabled) {
      this.scrollToBottom();
    }
  }

  /**
   * Scroll to bottom of badge container
   */
  scrollToBottom() {
    if (!this.elements.badgeContainer) return;
    
    requestAnimationFrame(() => {
      const container = this.elements.badgeContainer;
      container.scrollTop = container.scrollHeight;
    });
  }

  /**
   * Toggle a filter type (multi-select support)
   * @param {string} filterType - Type to toggle
   */
  toggleFilter(filterType) {
    if (filterType === 'all') {
      // Clear all filters (show all)
      this.currentFilters.clear();
    } else {
      // Toggle specific filter
      if (this.currentFilters.has(filterType)) {
        this.currentFilters.delete(filterType);
      } else {
        this.currentFilters.add(filterType);
      }
    }
    
    // Update filter button states
    this.updateFilterButtons();
    
    // Apply filter to badges
    this.applyFilter();
  }

  /**
   * Update filter button visual states
   */
  updateFilterButtons() {
    if (!this.elements.filterContainer) return;
    
    this.elements.filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
      const btnFilter = btn.dataset.filter;
      
      if (btnFilter === 'all') {
        // "All" button is active when no filters are selected
        if (this.currentFilters.size === 0) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      } else {
        // Individual filters
        if (this.currentFilters.has(btnFilter)) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  /**
   * Apply the current filters to all badges
   */
  applyFilter() {
    let visibleCount = 0;
    
    this.badgeElements.forEach(({ element, item }) => {
      // Show all if no filters selected, otherwise check if item type is in filter set
      if (this.currentFilters.size === 0 || this.currentFilters.has(item.type)) {
        element.style.display = '';
        visibleCount++;
      } else {
        element.style.display = 'none';
      }
    });
    
    // Update count display
    if (this.elements.badgeCount) {
      const total = this.badgeElements.length;
      if (this.currentFilters.size === 0) {
        this.elements.badgeCount.textContent = total;
      } else {
        this.elements.badgeCount.textContent = `${visibleCount}/${total}`;
      }
    }
  }

  /**
   * Subscribe to data store updates
   */
  subscribeToData() {
    // Subscribe to relevant data changes
    this.dataStore.subscribe('totalToolCalls', () => this.updateToolCalls());
    this.dataStore.subscribe('stateUpdate', () => this.updateDashboard());
    this.dataStore.subscribe('conversations', () => this.updateBadges());
    this.dataStore.subscribe('modelName', () => this.updateModelName());
  }

  /**
   * Update all data from data store
   */
  updateFromDataStore() {
    this.updateDashboard();
    this.updateBadges();
  }

  /**
   * Update dashboard cards
   */
  updateDashboard() {
    const state = this.dataStore.getState();
    
    // Update Tool Calls
    this.updateToolCalls();
    
    // Update Turn (use ∞ for unlimited mode)
    const maxDisplay = state.maxIterations === 0 ? '∞' : state.maxIterations;
    const turnText = `${state.currentIteration}/${maxDisplay}`;
    if (this.elements.turn && turnText !== this.previousValues.turn) {
      this.animateValue(this.elements.turn, turnText);
      this.previousValues.turn = turnText;
    }
    
    // Update Tokens Last
    if (this.elements.tokensLast && state.lastTotalTokens !== this.previousValues.tokensLast) {
      this.animateNumber(this.elements.tokensLast, this.previousValues.tokensLast, state.lastTotalTokens);
      this.previousValues.tokensLast = state.lastTotalTokens;
    }
    
    // Update Tokens Total
    if (this.elements.tokensTotal && state.cumulativeTotalTokens !== this.previousValues.tokensTotal) {
      this.animateNumber(this.elements.tokensTotal, this.previousValues.tokensTotal, state.cumulativeTotalTokens);
      this.previousValues.tokensTotal = state.cumulativeTotalTokens;
    }
    
    // Update Profit
    const profit = state.agentState.profit || 0;
    if (this.elements.profit && profit !== this.previousValues.profit) {
      this.animateNumber(this.elements.profit, this.previousValues.profit, profit, 2, '¥');
      this.previousValues.profit = profit;
    }
  }

  /**
   * Update tool calls count
   */
  updateToolCalls() {
    const toolCalls = this.dataStore.get('totalToolCalls');
    if (this.elements.toolCalls && toolCalls !== this.previousValues.toolCalls) {
      this.animateNumber(this.elements.toolCalls, this.previousValues.toolCalls, toolCalls);
      this.previousValues.toolCalls = toolCalls;
    }
  }

  /**
   * Update conversation badges with masonry layout
   */
  updateBadges() {
    const conversations = this.dataStore.get('conversations') || [];
    
    if (!this.elements.badgeContainer) return;
    
    // Only render new badges
    const newBadges = conversations.slice(this.renderedBadgeCount);
    
    if (newBadges.length === 0) return;
    
    newBadges.forEach((item, relativeIndex) => {
      const absoluteIndex = this.renderedBadgeCount + relativeIndex;
      const badge = this.createBadge(item, absoluteIndex);
      
      // Store reference for filtering
      this.badgeElements.push({ element: badge, item });
      
      // Apply current filters to new badge
      if (this.currentFilters.size > 0 && !this.currentFilters.has(item.type)) {
        badge.style.display = 'none';
      }
      
      this.elements.badgeContainer.appendChild(badge);
    });
    
    this.renderedBadgeCount = conversations.length;
    
    // Update count display
    this.updateBadgeCount();
    
    // Auto-scroll to bottom if enabled
    if (this.autoScrollEnabled) {
      this.scrollToBottom();
    }
  }

  /**
   * Update the badge count display
   */
  updateBadgeCount() {
    if (!this.elements.badgeCount) return;
    
    const total = this.badgeElements.length;
    
    if (this.currentFilters.size === 0) {
      this.elements.badgeCount.textContent = total;
    } else {
      const visibleCount = this.badgeElements.filter(({ item }) => this.currentFilters.has(item.type)).length;
      this.elements.badgeCount.textContent = `${visibleCount}/${total}`;
    }
  }

  /**
   * Update model name display
   */
  updateModelName() {
    const modelName = this.dataStore.get('modelName');
    if (this.elements.modelName && modelName) {
      this.elements.modelName.textContent = modelName;
    }
  }

  /**
   * Create a badge element
   * @param {Object} item - Conversation item
   * @param {number} index - Item index
   * @returns {HTMLElement} Badge element
   */
  createBadge(item, index) {
    const badge = document.createElement('div');
    badge.className = `capsule-badge type-${item.type}`;
    badge.dataset.index = index;
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('role', 'button');
    
    // Add role class for messages
    if (item.type === 'message' && item.role) {
      badge.classList.add(`role-${item.role}`);
    }
    
    // Get type label
    const typeLabel = this.getTypeLabel(item);
    
    // Get content summary
    const summary = this.dataStore.getConversationSummary(item);
    
    badge.innerHTML = `
      <div class="badge-type">${typeLabel}</div>
      <div class="badge-content" title="${this.escapeHtml(summary)}">${this.escapeHtml(summary)}</div>
    `;
    
    // Add entrance animation
    badge.style.animation = 'popup-appear 0.2s ease-out';
    
    return badge;
  }

  /**
   * Get type label for badge
   * @param {Object} item - Conversation item
   * @returns {string} Type label
   */
  getTypeLabel(item) {
    const t = typeof i18n !== 'undefined' ? (key) => i18n.t(key) : (key) => key;
    
    if (item.type === 'message') {
      return this.getRoleLabel(item.role);
    }
    
    const typeLabels = {
      'tool_call': t('badge.tool'),
      'tool_result': t('badge.result'),
      'reasoning': t('badge.think'),
      'simulation_end': t('badge.end')
    };
    return typeLabels[item.type] || item.type;
  }

  /**
   * Get role label for message
   * @param {string} role - Message role
   * @returns {string} Role label
   */
  getRoleLabel(role) {
    const t = typeof i18n !== 'undefined' ? (key) => i18n.t(key) : (key) => key;
    
    const roleLabels = {
      'user': t('badge.user'),
      'assistant': t('badge.assistant'),
      'system': t('badge.system')
    };
    return roleLabels[role] || role;
  }

  /**
   * Show badge detail popup
   * @param {number} index - Conversation index
   * @param {HTMLElement} badgeElement - The clicked badge element
   */
  showBadgeDetail(index, badgeElement) {
    const conversations = this.dataStore.get('conversations') || [];
    const item = conversations[index];
    
    if (!item) return;
    
    // Close existing popup
    this.closePopup();
    
    // Mark badge as expanded
    badgeElement.classList.add('expanded');
    
    // Create popup
    const popup = document.createElement('div');
    popup.className = 'badge-detail-popup';
    
    // Get content based on type
    let content = '';
    let title = '';
    
    switch (item.type) {
      case 'tool_call':
        title = `🔧 ${item.toolName}`;
        content = JSON.stringify(item.arguments, null, 2);
        break;
      case 'tool_result':
        title = `${item.success ? '✅' : '❌'} ${item.toolName} Result`;
        content = typeof item.result === 'object' 
          ? JSON.stringify(item.result, null, 2) 
          : String(item.result);
        break;
      case 'message':
        title = this.getRoleLabel(item.role);
        content = item.content;
        break;
      case 'reasoning':
        title = '💭 Reasoning';
        content = item.content;
        break;
      case 'simulation_end':
        title = '🏁 Simulation End';
        content = item.report;
        break;
      default:
        title = item.type;
        content = JSON.stringify(item, null, 2);
    }
    
    popup.innerHTML = `
      <div class="popup-header">
        <span class="popup-title">${title}</span>
        <button class="popup-close" aria-label="Close">&times;</button>
      </div>
      <div class="popup-body">
        <pre>${this.escapeHtml(content)}</pre>
      </div>
    `;
    
    // Position popup
    const rect = badgeElement.getBoundingClientRect();
    popup.style.position = 'fixed';
    
    // Calculate position - try to show below, but adjust if near bottom
    let top = rect.bottom + 8;
    let left = rect.left;
    
    // Ensure popup doesn't go off-screen
    const maxWidth = 500;
    const maxHeight = 400;
    
    if (left + maxWidth > window.innerWidth) {
      left = window.innerWidth - maxWidth - 16;
    }
    
    if (top + maxHeight > window.innerHeight) {
      top = rect.top - maxHeight - 8;
      if (top < 0) {
        top = 16;
      }
    }
    
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;
    
    // Add close handler
    popup.querySelector('.popup-close').addEventListener('click', () => {
      this.closePopup();
    });
    
    document.body.appendChild(popup);
    this.activePopup = { element: popup, badge: badgeElement };
  }

  /**
   * Close active popup
   */
  closePopup() {
    if (this.activePopup) {
      this.activePopup.badge.classList.remove('expanded');
      this.activePopup.element.remove();
      this.activePopup = null;
    }
  }

  /**
   * Animate a number change
   * @param {HTMLElement} element - Element to update
   * @param {number} from - Start value
   * @param {number} to - End value
   * @param {number} decimals - Decimal places
   * @param {string} prefix - Value prefix
   */
  animateNumber(element, from, to, decimals = 0, prefix = '') {
    if (!element) return;
    
    const duration = 500;
    const steps = 20;
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
        element.textContent = prefix + this.formatNumber(current, decimals);
        element.classList.remove('animating');
      } else {
        element.textContent = prefix + this.formatNumber(current, decimals);
        setTimeout(animate, stepDuration);
      }
    };
    
    animate();
  }

  /**
   * Animate a value change (non-numeric)
   * @param {HTMLElement} element - Element to update
   * @param {string} value - New value
   */
  animateValue(element, value) {
    if (!element) return;
    
    element.classList.add('animating');
    element.textContent = value;
    
    setTimeout(() => {
      element.classList.remove('animating');
    }, 300);
  }

  /**
   * Format a number
   * @param {number} value - Number to format
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted number
   */
  formatNumber(value, decimals = 0) {
    if (value === undefined || value === null || isNaN(value)) {
      return '0';
    }
    
    // For large numbers, use K/M suffix
    if (decimals === 0 && value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    } else if (decimals === 0 && value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    
    return Number(value).toFixed(decimals);
  }

  /**
   * Escape HTML characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.closePopup();
    
    // Clear scroll timeout
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
      this.scrollTimeout = null;
    }
  }
}

/**
 * Render function for Agent Detail page
 * @returns {string} HTML content
 */
function renderAgentDetailPage() {
  const t = typeof i18n !== 'undefined' ? (key) => i18n.t(key) : (key) => key;
  
  return `
    <div class="agent-detail-page">
      <!-- Page Header -->
      <div class="detail-page-header">
        <div class="benchmark-info">
          <h1 class="benchmark-name" id="detail-benchmark-name">Silicon Rider Bench</h1>
          <span class="benchmark-badge">Agent Benchmark</span>
        </div>
        <div class="model-info">
          <span class="model-label">${t('stats.model')}:</span>
          <span class="model-name" id="detail-model-name">--</span>
        </div>
      </div>
      
      <!-- Dashboard Cards -->
      <div class="dashboard-grid">
        <div class="dashboard-card card-tool-calls">
          <div class="card-label">${t('detail.toolCalls')}</div>
          <div class="card-value" id="detail-tool-calls">0</div>
          <div class="card-subtitle">${t('detail.toolCallsDesc')}</div>
        </div>
        
        <div class="dashboard-card card-turn">
          <div class="card-label">${t('detail.turn')}</div>
          <div class="card-value" id="detail-turn">0/0</div>
          <div class="card-subtitle">${t('detail.turnDesc')}</div>
        </div>
        
        <div class="dashboard-card card-tokens-last">
          <div class="card-label">${t('detail.tokensLast')}</div>
          <div class="card-value" id="detail-tokens-last">0</div>
          <div class="card-subtitle">${t('detail.tokensLastDesc')}</div>
        </div>
        
        <div class="dashboard-card card-tokens-total">
          <div class="card-label">${t('detail.tokensTotal')}</div>
          <div class="card-value" id="detail-tokens-total">0</div>
          <div class="card-subtitle">${t('detail.tokensTotalDesc')}</div>
        </div>
        
        <div class="dashboard-card card-profit">
          <div class="card-label">${t('detail.profit')}</div>
          <div class="card-value" id="detail-profit">¥0</div>
          <div class="card-subtitle">${t('detail.profitDesc')}</div>
        </div>
      </div>
      
      <!-- Conversation Flow -->
      <div class="conversation-section">
        <div class="section-header">
          <div class="section-header-left">
            <h2 class="section-title">${t('detail.conversationFlow')}</h2>
            <span class="section-count"><span id="badge-count">0</span> ${t('detail.items')}</span>
          </div>
          
          <!-- Filter Buttons -->
          <div class="filter-container" id="filter-container">
            <button class="filter-btn active" data-filter="all">${t('detail.filterAll')}</button>
            <button class="filter-btn" data-filter="tool_call">${t('detail.filterTool')}</button>
            <button class="filter-btn" data-filter="tool_result">${t('detail.filterResult')}</button>
            <button class="filter-btn" data-filter="message">${t('detail.filterMessage')}</button>
            <button class="filter-btn" data-filter="reasoning">${t('detail.filterThink')}</button>
          </div>
        </div>
        
        <div class="badge-masonry-wrapper">
          <div class="badge-masonry" id="badge-masonry">
            <!-- Badges will be rendered here -->
          </div>
        </div>
      </div>
    </div>
  `;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AgentDetailPage, renderAgentDetailPage };
}

