/**
 * SettingsPage - Settings Page Component
 * 
 * Provides configuration options including:
 * - Language selection (Chinese/English)
 * - Map page submenu display mode
 * - Theme settings (future)
 * - About information
 */
class SettingsPage {
  constructor(containerElement, appRef = null) {
    this.container = containerElement;
    this.app = appRef; // Reference to Application for accessing mapPage
    this.elements = {};
    
    // Load saved settings
    this.submenuMode = localStorage.getItem('mapSubmenuMode') || 'brief';
    
    this.initialize();
  }

  /**
   * Initialize the page
   */
  initialize() {
    this.cacheElements();
    this.bindEvents();
    this.updateLanguageSelection();
    
    // Subscribe to language changes
    i18n.subscribe(() => this.updateUI());
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      languageSelect: this.container.querySelector('#language-select'),
      submenuToggle: this.container.querySelector('#submenu-display-toggle'),
      settingsTitle: this.container.querySelector('#settings-title'),
      languageLabel: this.container.querySelector('#language-label'),
      languageDesc: this.container.querySelector('#language-desc'),
      submenuLabel: this.container.querySelector('#submenu-label'),
      submenuDesc: this.container.querySelector('#submenu-desc'),
      themeLabel: this.container.querySelector('#theme-label'),
      themeDesc: this.container.querySelector('#theme-desc'),
      aboutLabel: this.container.querySelector('#about-label'),
      versionLabel: this.container.querySelector('#version-label'),
      aboutDesc: this.container.querySelector('#about-desc')
    };
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    // Language selection
    if (this.elements.languageSelect) {
      this.elements.languageSelect.addEventListener('change', (e) => {
        i18n.setLanguage(e.target.value);
      });
    }
    
    // Submenu display toggle
    if (this.elements.submenuToggle) {
      this.elements.submenuToggle.addEventListener('click', (e) => {
        const option = e.target.closest('.toggle-option');
        if (option) {
          const value = option.dataset.value;
          this.setSubmenuMode(value);
        }
      });
    }
  }
  
  /**
   * Set submenu display mode
   * @param {string} mode - 'off', 'brief', 'full'
   */
  setSubmenuMode(mode) {
    this.submenuMode = mode;
    
    // Save to localStorage
    localStorage.setItem('mapSubmenuMode', mode);
    
    // Update toggle UI
    if (this.elements.submenuToggle) {
      const options = this.elements.submenuToggle.querySelectorAll('.toggle-option');
      options.forEach(opt => {
        opt.classList.toggle('active', opt.dataset.value === mode);
      });
      
      // Update slider position
      const slider = this.elements.submenuToggle.querySelector('.toggle-slider');
      const activeOption = this.elements.submenuToggle.querySelector(`.toggle-option[data-value="${mode}"]`);
      if (slider && activeOption) {
        const index = Array.from(options).indexOf(activeOption);
        slider.style.transform = `translateX(${index * 100}%)`;
      }
    }
    
    // Update mapPage if available
    if (this.app && this.app.mapPage) {
      this.app.mapPage.setSubmenuDisplayMode(mode);
    }
  }
  
  /**
   * Get current submenu mode
   * @returns {string}
   */
  getSubmenuMode() {
    return this.submenuMode;
  }

  /**
   * Update language selection to current value
   */
  updateLanguageSelection() {
    if (this.elements.languageSelect) {
      this.elements.languageSelect.value = i18n.getLanguage();
    }
  }

  /**
   * Update UI with current language
   */
  updateUI() {
    if (this.elements.settingsTitle) {
      this.elements.settingsTitle.textContent = i18n.t('settings.title');
    }
    if (this.elements.languageLabel) {
      this.elements.languageLabel.textContent = i18n.t('settings.language');
    }
    if (this.elements.languageDesc) {
      this.elements.languageDesc.textContent = i18n.t('settings.languageDesc');
    }
    if (this.elements.themeLabel) {
      this.elements.themeLabel.textContent = i18n.t('settings.theme');
    }
    if (this.elements.themeDesc) {
      this.elements.themeDesc.textContent = i18n.t('settings.themeDesc');
    }
    if (this.elements.aboutLabel) {
      this.elements.aboutLabel.textContent = i18n.t('settings.about');
    }
    if (this.elements.versionLabel) {
      this.elements.versionLabel.textContent = i18n.t('settings.version');
    }
    if (this.elements.aboutDesc) {
      this.elements.aboutDesc.textContent = i18n.t('settings.description');
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Nothing to cleanup for now
  }
}

/**
 * Render function for Settings page
 * @returns {string} HTML content
 */
function renderSettingsPage() {
  const currentLang = i18n.getLanguage();
  const currentSubmenuMode = localStorage.getItem('mapSubmenuMode') || 'brief';
  
  return `
    <div class="settings-page">
      <div class="settings-container">
        <h1 class="settings-title" id="settings-title">${i18n.t('settings.title')}</h1>
        
        <!-- Language Setting -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-icon">🌐</div>
            <div class="settings-section-info">
              <h3 class="settings-label" id="language-label">${i18n.t('settings.language')}</h3>
              <p class="settings-desc" id="language-desc">${i18n.t('settings.languageDesc')}</p>
            </div>
          </div>
          <div class="settings-control">
            <select id="language-select" class="settings-select">
              <option value="zh" ${currentLang === 'zh' ? 'selected' : ''}>中文</option>
              <option value="en" ${currentLang === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>
        </div>
        
        <!-- Map Page Submenu Display Setting -->
        <div class="settings-section">
          <div class="settings-section-header">
            <div class="settings-icon">🗺️</div>
            <div class="settings-section-info">
              <h3 class="settings-label" id="submenu-label">地图页面 - 二级菜单显示</h3>
              <p class="settings-desc" id="submenu-desc">控制地图页面中操作列表的二级菜单内容展示方式</p>
            </div>
          </div>
          <div class="settings-control">
            <div class="three-way-toggle" id="submenu-display-toggle">
              <div class="toggle-option ${currentSubmenuMode === 'off' ? 'active' : ''}" data-value="off" title="关闭">
                <span>关</span>
              </div>
              <div class="toggle-option ${currentSubmenuMode === 'brief' ? 'active' : ''}" data-value="brief" title="简略">
                <span>简</span>
              </div>
              <div class="toggle-option ${currentSubmenuMode === 'full' ? 'active' : ''}" data-value="full" title="全部">
                <span>全</span>
              </div>
              <div class="toggle-slider" style="transform: translateX(${currentSubmenuMode === 'off' ? '0' : currentSubmenuMode === 'brief' ? '100' : '200'}%)"></div>
            </div>
          </div>
        </div>
        
        <!-- Theme Setting (Placeholder) -->
        <div class="settings-section disabled">
          <div class="settings-section-header">
            <div class="settings-icon">🎨</div>
            <div class="settings-section-info">
              <h3 class="settings-label" id="theme-label">${i18n.t('settings.theme')}</h3>
              <p class="settings-desc" id="theme-desc">${i18n.t('settings.themeDesc')}</p>
            </div>
          </div>
          <div class="settings-control">
            <select class="settings-select" disabled>
              <option>Silver Purple</option>
            </select>
          </div>
        </div>
        
        <!-- About Section -->
        <div class="settings-section about-section">
          <div class="settings-section-header">
            <div class="settings-icon">ℹ️</div>
            <div class="settings-section-info">
              <h3 class="settings-label" id="about-label">${i18n.t('settings.about')}</h3>
              <p class="settings-desc">
                <span id="version-label">${i18n.t('settings.version')}</span>: 2.0.0
              </p>
            </div>
          </div>
          <p class="about-description" id="about-desc">
            ${i18n.t('settings.description')}
          </p>
        </div>
        
        <!-- Credits -->
        <div class="settings-credits">
          <p>Made with 💜 by KCORES</p>
          <a href="https://github.com/KCORES/silicon-rider-bench" target="_blank" class="credits-link">
            GitHub Repository →
          </a>
        </div>
      </div>
    </div>
  `;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SettingsPage, renderSettingsPage };
}

