/**
 * ReceiptPanel - Display receipt images panel that follows the agent
 * 
 * Features:
 * - Shows receipt images on the LEFT side of the agent (opposite to ActionMenu)
 * - Panel's bottom-right corner aligns with agent position
 * - Images have rounded corners
 * - Stays visible until:
 *   - pickup_food_by_phone_number is called (selected image gets green glow, then fades after 2s)
 *   - move_to is called (entire panel closes after 2s delay)
 */

class ReceiptPanel {
  constructor(containerElement, mapRenderer) {
    this.container = containerElement;
    this.mapRenderer = mapRenderer;
    this.panelElement = null;
    
    // State
    this.receipts = []; // Array of { orderId, imagePath, imageData }
    this.isVisible = false;
    
    // Position update interval
    this.positionUpdateInterval = null;
    
    // Timers
    this.hideTimer = null;
    this.removeImageTimer = null;
    
    // Initialize
    this.initialize();
  }
  
  /**
   * Initialize the receipt panel
   */
  initialize() {
    // Create panel element
    this.panelElement = document.createElement('div');
    this.panelElement.className = 'receipt-panel';
    this.panelElement.style.display = 'none';
    
    // Append to document.body for fixed positioning (avoids overflow clipping)
    document.body.appendChild(this.panelElement);
    
    // Start position tracking
    this.startPositionTracking();
  }
  
  /**
   * Start position tracking
   */
  startPositionTracking() {
    // Update position every 50ms
    this.positionUpdateInterval = setInterval(() => {
      if (this.isVisible) {
        this.updatePosition();
      }
    }, 50);
  }
  
  /**
   * Update panel position to follow agent
   * Panel's bottom-right corner aligns with agent position (panel appears at left of agent)
   * Uses fixed positioning relative to viewport
   */
  updatePosition() {
    if (!this.mapRenderer || !this.isVisible) {
      return;
    }
    
    // Get agent element's screen position using getBoundingClientRect
    if (!this.mapRenderer.agentElement) {
      return;
    }
    
    const agentRect = this.mapRenderer.agentElement.getBoundingClientRect();
    const agentCenterX = agentRect.left + agentRect.width / 2;
    const agentCenterY = agentRect.top + agentRect.height / 2;
    
    if (isNaN(agentCenterX) || isNaN(agentCenterY)) {
      return;
    }
    
    // Get panel dimensions
    const panelWidth = this.panelElement.offsetWidth || 180;
    const panelHeight = this.panelElement.offsetHeight || 200;
    
    // Position panel so its bottom-right corner is near the agent (left of agent)
    const panelOffsetX = -40; // pixels to the left of agent center
    const panelOffsetY = 0; // align with agent center vertically
    
    let finalLeft = agentCenterX - panelWidth + panelOffsetX;
    let finalTop = agentCenterY - panelHeight / 2 + panelOffsetY;
    
    // Ensure panel stays within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Don't go too far left
    finalLeft = Math.max(10, finalLeft);
    // Don't go too far right (beyond viewport width)
    finalLeft = Math.min(viewportWidth - panelWidth - 10, finalLeft);
    // Don't go too far up
    finalTop = Math.max(10, finalTop);
    // Don't go too far down (beyond viewport height)
    finalTop = Math.min(viewportHeight - panelHeight - 10, finalTop);
    
    this.panelElement.style.left = `${finalLeft}px`;
    this.panelElement.style.top = `${finalTop}px`;
  }
  
  /**
   * Show receipts
   * @param {Array} receipts - Array of { orderId, imagePath, imageData }
   */
  showReceipts(receipts) {
    // Clear any pending timers
    this.clearTimers();
    
    // Store receipts
    this.receipts = receipts || [];
    
    if (this.receipts.length === 0) {
      this.hide();
      return;
    }
    
    // Render receipts
    this.render();
    
    // Show panel
    this.panelElement.style.display = 'block';
    this.isVisible = true;
    
    // Update position immediately
    requestAnimationFrame(() => {
      this.updatePosition();
    });
  }
  
  /**
   * Render the panel content
   */
  render() {
    const receiptsHTML = this.receipts.map((receipt, index) => {
      const imageSrc = receipt.imageData || '';
      return `
        <div class="receipt-image-item" data-order-id="${receipt.orderId}">
          <img src="${imageSrc}" alt="小票 ${index + 1}" class="receipt-image" />
          <div class="receipt-order-id">${receipt.orderId}</div>
        </div>
      `;
    }).join('');
    
    this.panelElement.innerHTML = `
      <div class="receipt-panel-header">
        <span class="receipt-panel-icon">🧾</span>
        <span class="receipt-panel-title">小票</span>
        <span class="receipt-panel-count">${this.receipts.length}</span>
      </div>
      <div class="receipt-panel-content">
        ${receiptsHTML}
      </div>
    `;
  }
  
  /**
   * Highlight a receipt by order ID (when pickup_food_by_phone_number is called)
   * @param {string} orderId - The order ID to highlight
   */
  highlightReceipt(orderId) {
    const receiptItem = this.panelElement.querySelector(`.receipt-image-item[data-order-id="${orderId}"]`);
    
    if (receiptItem) {
      // Add green glow effect
      receiptItem.classList.add('selected');
      
      // Remove this receipt after 2 seconds
      this.removeImageTimer = setTimeout(() => {
        this.removeReceipt(orderId);
      }, 2000);
    }
  }
  
  /**
   * Highlight a receipt by phone number (when pickup_food_by_phone_number is called)
   * Need to find the matching order
   * @param {string} phoneNumber - The phone number used for pickup
   * @param {string} orderId - The order ID that was picked up (from tool result)
   */
  highlightReceiptByPhone(phoneNumber, orderId) {
    // First try to find by orderId
    if (orderId) {
      this.highlightReceipt(orderId);
      return;
    }
    
    // If no orderId provided, just highlight the first one (fallback)
    if (this.receipts.length > 0) {
      this.highlightReceipt(this.receipts[0].orderId);
    }
  }
  
  /**
   * Remove a receipt from the panel
   * @param {string} orderId - The order ID to remove
   */
  removeReceipt(orderId) {
    // Remove from receipts array
    this.receipts = this.receipts.filter(r => r.orderId !== orderId);
    
    // Remove from DOM with animation
    const receiptItem = this.panelElement.querySelector(`.receipt-image-item[data-order-id="${orderId}"]`);
    if (receiptItem) {
      receiptItem.classList.add('removing');
      
      setTimeout(() => {
        receiptItem.remove();
        
        // Update count
        const countElement = this.panelElement.querySelector('.receipt-panel-count');
        if (countElement) {
          countElement.textContent = this.receipts.length.toString();
        }
        
        // If no more receipts, hide the panel
        if (this.receipts.length === 0) {
          this.hide();
        }
      }, 300);
    }
  }
  
  /**
   * Schedule panel to hide (when move_to is called)
   * Hides after 2 second delay
   */
  scheduleHide() {
    this.clearTimers();
    
    this.hideTimer = setTimeout(() => {
      this.hide();
    }, 2000);
  }
  
  /**
   * Hide the panel immediately
   */
  hide() {
    this.clearTimers();
    
    this.panelElement.style.display = 'none';
    this.isVisible = false;
    this.receipts = [];
  }
  
  /**
   * Clear all timers
   */
  clearTimers() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    
    if (this.removeImageTimer) {
      clearTimeout(this.removeImageTimer);
      this.removeImageTimer = null;
    }
  }
  
  /**
   * Check if panel is currently visible
   */
  isShowing() {
    return this.isVisible;
  }
  
  /**
   * Cleanup resources
   */
  cleanup() {
    this.clearTimers();
    
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
    
    // Remove from body
    if (this.panelElement && this.panelElement.parentNode) {
      this.panelElement.parentNode.removeChild(this.panelElement);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReceiptPanel;
}

