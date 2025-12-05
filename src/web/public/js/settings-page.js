/**
 * SettingsPage - Settings Page Component
 * 
 * Provides configuration options including:
 * - Language selection (Chinese/English)
 * - Theme settings (future)
 * - About information
 */
class SettingsPage {
  constructor(containerElement) {
    this.container = containerElement;
    this.elements = {};
    
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
      settingsTitle: this.container.querySelector('#settings-title'),
      languageLabel: this.container.querySelector('#language-label'),
      languageDesc: this.container.querySelector('#language-desc'),
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

