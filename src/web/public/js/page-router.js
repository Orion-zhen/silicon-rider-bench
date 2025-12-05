/**
 * PageRouter - Page Routing and Rendering Manager
 * 
 * Handles switching between pages and ensures proper initialization
 * of page-specific components when switching tabs.
 */
class PageRouter {
  constructor(pageContainer) {
    this.container = pageContainer;
    this.pages = new Map();
    this.currentPage = null;
    this.pageInstances = new Map();
  }

  /**
   * Register a page
   * @param {string} pageId - Unique page identifier
   * @param {Object} config - Page configuration
   * @param {string} config.title - Page title
   * @param {Function} config.render - Function to render page HTML
   * @param {Function} config.init - Function to initialize page after render
   * @param {Function} config.update - Function to update page with new data
   * @param {Function} config.cleanup - Function to cleanup page resources
   */
  registerPage(pageId, config) {
    this.pages.set(pageId, config);
  }

  /**
   * Navigate to a page
   * @param {string} pageId - Page to navigate to
   */
  navigateTo(pageId) {
    if (!this.pages.has(pageId)) {
      console.error(`[PageRouter] Page not found: ${pageId}`);
      return;
    }
    
    // Cleanup current page if exists
    if (this.currentPage && this.currentPage !== pageId) {
      const currentConfig = this.pages.get(this.currentPage);
      if (currentConfig && currentConfig.cleanup) {
        try {
          currentConfig.cleanup();
        } catch (error) {
          console.error(`[PageRouter] Error cleaning up page ${this.currentPage}:`, error);
        }
      }
    }
    
    // Hide all pages
    this.container.querySelectorAll('.page').forEach(page => {
      page.classList.remove('active');
    });
    
    // Get or create page element
    let pageElement = this.container.querySelector(`#page-${pageId}`);
    const config = this.pages.get(pageId);
    
    if (!pageElement) {
      // Create new page element
      pageElement = document.createElement('div');
      pageElement.id = `page-${pageId}`;
      pageElement.className = 'page';
      this.container.appendChild(pageElement);
      
      // Render page content
      if (config.render) {
        pageElement.innerHTML = config.render();
      }
      
      // Initialize page
      if (config.init) {
        try {
          const instance = config.init(pageElement);
          if (instance) {
            this.pageInstances.set(pageId, instance);
          }
        } catch (error) {
          console.error(`[PageRouter] Error initializing page ${pageId}:`, error);
        }
      }
    }
    
    // Show the page
    pageElement.classList.add('active');
    this.currentPage = pageId;
    
    // Trigger update with latest data
    if (config.update) {
      try {
        config.update(this.pageInstances.get(pageId));
      } catch (error) {
        console.error(`[PageRouter] Error updating page ${pageId}:`, error);
      }
    }
    
    console.log(`[PageRouter] Navigated to: ${pageId}`);
  }

  /**
   * Get the current page ID
   * @returns {string|null} Current page ID
   */
  getCurrentPage() {
    return this.currentPage;
  }

  /**
   * Get a page instance
   * @param {string} pageId - Page ID
   * @returns {Object|null} Page instance
   */
  getPageInstance(pageId) {
    return this.pageInstances.get(pageId) || null;
  }

  /**
   * Update all pages with new data
   * This is called when new data arrives from WebSocket
   * @param {string} dataType - Type of data that changed
   * @param {any} data - The new data
   */
  updatePages(dataType, data) {
    // Only update the currently visible page
    if (this.currentPage) {
      const config = this.pages.get(this.currentPage);
      if (config && config.update) {
        try {
          config.update(this.pageInstances.get(this.currentPage), dataType, data);
        } catch (error) {
          console.error(`[PageRouter] Error updating page ${this.currentPage}:`, error);
        }
      }
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PageRouter;
}

