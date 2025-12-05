/**
 * TabNav - Tab Navigation Component
 * 
 * Creates a minimalist tab navigation bar at the top of the page.
 * Default state: 4px colored bars
 * Hover state: Expands to show full tab content with icons and labels
 */
class TabNav {
  constructor(containerElement) {
    this.container = containerElement;
    this.tabs = [];
    this.activeTab = 'homepage';
    this.onTabChange = null;
    
    this.initialize();
  }

  /**
   * Initialize the navigation
   */
  initialize() {
    // Define tabs with their properties
    this.tabs = [
      {
        id: 'homepage',
        labelKey: 'nav.homepage',
        icon: '🛵',
        color: '#a59aca' // 藤紫
      },
      {
        id: 'map',
        labelKey: 'nav.map',
        icon: '🗺️',
        color: '#7058a3' // 菫色
      },
      {
        id: 'agent-detail',
        labelKey: 'nav.agentDetail',
        icon: '📊',
        color: '#674598' // 青紫
      },
      {
        id: 'settings',
        labelKey: 'nav.settings',
        icon: '⚙️',
        color: '#674196' // 菖蒲色
      }
    ];
    
    this.render();
    this.bindEvents();
    
    // Subscribe to language changes
    if (typeof i18n !== 'undefined') {
      i18n.subscribe(() => this.updateLabels());
    }
  }

  /**
   * Render the navigation HTML
   */
  render() {
    const tabsHTML = this.tabs.map(tab => {
      const label = typeof i18n !== 'undefined' ? i18n.t(tab.labelKey) : tab.labelKey;
      return `
        <div class="tab-item ${tab.id === this.activeTab ? 'active' : ''}" 
             data-tab="${tab.id}"
             style="background-color: ${tab.color}">
          <div class="tab-content">
            <span class="tab-icon">${tab.icon}</span>
            <span class="tab-label">${label}</span>
          </div>
        </div>
      `;
    }).join('');
    
    this.container.innerHTML = tabsHTML;
  }

  /**
   * Update tab labels when language changes
   */
  updateLabels() {
    this.container.querySelectorAll('.tab-item').forEach((item, index) => {
      const tab = this.tabs[index];
      if (tab) {
        const labelElement = item.querySelector('.tab-label');
        if (labelElement && typeof i18n !== 'undefined') {
          labelElement.textContent = i18n.t(tab.labelKey);
        }
      }
    });
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Tab click handler
    this.container.addEventListener('click', (e) => {
      const tabItem = e.target.closest('.tab-item');
      if (tabItem) {
        const tabId = tabItem.dataset.tab;
        this.setActiveTab(tabId);
      }
    });
    
    // Keyboard navigation
    this.container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const tabItem = e.target.closest('.tab-item');
        if (tabItem) {
          e.preventDefault();
          const tabId = tabItem.dataset.tab;
          this.setActiveTab(tabId);
        }
      }
    });
    
    // Make tabs focusable
    this.container.querySelectorAll('.tab-item').forEach(tab => {
      tab.setAttribute('tabindex', '0');
      tab.setAttribute('role', 'tab');
    });
  }

  /**
   * Set the active tab
   * @param {string} tabId - Tab identifier
   */
  setActiveTab(tabId) {
    if (tabId === this.activeTab) return;
    
    // Update active state
    this.activeTab = tabId;
    
    // Update DOM
    this.container.querySelectorAll('.tab-item').forEach(item => {
      if (item.dataset.tab === tabId) {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
      } else {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      }
    });
    
    // Trigger callback
    if (this.onTabChange) {
      this.onTabChange(tabId);
    }
  }

  /**
   * Get the current active tab
   * @returns {string} Active tab ID
   */
  getActiveTab() {
    return this.activeTab;
  }

  /**
   * Register tab change callback
   * @param {Function} callback - Function to call when tab changes
   */
  onTabChanged(callback) {
    this.onTabChange = callback;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TabNav;
}

