/**
 * StatsPanel - Manages the statistics panel display
 * Displays agent state information including time, battery, profit, and orders
 * 
 * Performance optimizations:
 * - Caches DOM elements to avoid repeated queries
 * - Only updates changed values (dirty checking)
 */
class StatsPanel {
  constructor(containerElement) {
    this.container = containerElement;
    
    // Cache for previous values (dirty checking)
    this.previousValues = {
      time: null,
      battery: null,
      profit: null,
      carried: null,
      weight: null,
      completed: null,
      ordersHash: null
    };
    
    // Cache DOM elements
    this.elements = {};
    
    this.initialize();
  }

  /**
   * Initialize the panel structure
   */
  initialize() {
    console.log('[StatsPanel] Initializing panel structure');
    
    this.container.innerHTML = `
      <div class="stats-section">
        <h3>Game Status</h3>
        <div class="stat-item">
          <span class="stat-label">Time:</span>
          <span class="stat-value" id="stat-time">--:--</span>
        </div>
      </div>
      
      <div class="stats-section">
        <h3>Agent Status</h3>
        <div class="stat-item">
          <span class="stat-label">Battery:</span>
          <span class="stat-value" id="stat-battery">--%</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Profit:</span>
          <span class="stat-value" id="stat-profit">¥0.00</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Carried Orders:</span>
          <span class="stat-value" id="stat-carried">0</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Total Weight:</span>
          <span class="stat-value" id="stat-weight">0.0 kg</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Completed:</span>
          <span class="stat-value" id="stat-completed">0</span>
        </div>
      </div>
      
      <div class="stats-section">
        <h3>Orders in Backpack</h3>
        <div id="orders-list" class="orders-list">
          <div class="no-orders">No orders</div>
        </div>
      </div>
    `;
    
    // Cache DOM elements
    this.elements = {
      time: document.getElementById('stat-time'),
      battery: document.getElementById('stat-battery'),
      profit: document.getElementById('stat-profit'),
      carried: document.getElementById('stat-carried'),
      weight: document.getElementById('stat-weight'),
      completed: document.getElementById('stat-completed'),
      ordersList: document.getElementById('orders-list')
    };
    
    console.log('[StatsPanel] Elements cached:', this.elements);
  }

  /**
   * Update statistics display (with dirty checking)
   * @param {Object} agentState - Agent state data
   * @param {string} formattedTime - Formatted time string
   */
  update(agentState, formattedTime) {
    // Update time (only if changed)
    if (this.elements.time && formattedTime !== this.previousValues.time) {
      this.elements.time.textContent = formattedTime || '--:--';
      this.previousValues.time = formattedTime;
    }

    // Update battery (only if changed)
    if (this.elements.battery && agentState.battery !== undefined) {
      const batteryValue = this.formatNumber(agentState.battery, 1);
      if (batteryValue !== this.previousValues.battery) {
        this.elements.battery.textContent = `${batteryValue}%`;
        this.previousValues.battery = batteryValue;
      }
    }

    // Update profit (only if changed)
    if (this.elements.profit && agentState.profit !== undefined) {
      const profitValue = this.formatNumber(agentState.profit, 2);
      if (profitValue !== this.previousValues.profit) {
        this.elements.profit.textContent = `¥${profitValue}`;
        this.previousValues.profit = profitValue;
      }
    }

    // Update carried orders count (only if changed)
    if (this.elements.carried && agentState.carriedOrders !== undefined) {
      const carriedValue = agentState.carriedOrders.length;
      if (carriedValue !== this.previousValues.carried) {
        this.elements.carried.textContent = carriedValue.toString();
        this.previousValues.carried = carriedValue;
      }
    }

    // Update total weight (only if changed)
    if (this.elements.weight && agentState.totalWeight !== undefined) {
      const weightValue = this.formatNumber(agentState.totalWeight, 1);
      if (weightValue !== this.previousValues.weight) {
        this.elements.weight.textContent = `${weightValue} kg`;
        this.previousValues.weight = weightValue;
      }
    }

    // Update completed orders (only if changed)
    if (this.elements.completed && agentState.completedOrders !== undefined) {
      const completedValue = agentState.completedOrders;
      if (completedValue !== this.previousValues.completed) {
        this.elements.completed.textContent = completedValue.toString();
        this.previousValues.completed = completedValue;
      }
    }

    // Update orders list (only if changed)
    if (agentState.carriedOrders) {
      const ordersHash = this.hashOrders(agentState.carriedOrders);
      if (ordersHash !== this.previousValues.ordersHash) {
        this.updateOrders(agentState.carriedOrders);
        this.previousValues.ordersHash = ordersHash;
      }
    }
  }
  
  /**
   * Create a simple hash of orders array for change detection
   * @param {Array} orders - Array of order objects
   * @returns {string} Hash string
   */
  hashOrders(orders) {
    if (!orders || orders.length === 0) return 'empty';
    return orders.map(o => `${o.id}-${o.pickedUp}`).join(',');
  }

  /**
   * Update the orders list display
   * @param {Array} carriedOrders - Array of order objects
   */
  updateOrders(carriedOrders) {
    if (!this.elements.ordersList) return;

    if (!carriedOrders || carriedOrders.length === 0) {
      this.elements.ordersList.innerHTML = '<div class="no-orders">No orders</div>';
      return;
    }

    const ordersHTML = carriedOrders.map(order => {
      const status = order.pickedUp ? '📦 Picked up' : '📋 Assigned';
      const deadlineStr = this.formatTime(order.deadline);
      
      return `
        <div class="order-item">
          <div class="order-header">
            <span class="order-id">#${order.id}</span>
            <span class="order-status">${status}</span>
          </div>
          <div class="order-details">
            <div class="order-detail">
              <span class="detail-label">Type:</span>
              <span class="detail-value">${order.type}</span>
            </div>
            <div class="order-detail">
              <span class="detail-label">Weight:</span>
              <span class="detail-value">${this.formatNumber(order.weight, 1)} kg</span>
            </div>
            <div class="order-detail">
              <span class="detail-label">Deadline:</span>
              <span class="detail-value">${deadlineStr}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.elements.ordersList.innerHTML = ordersHTML;
  }

  /**
   * Format a number with specified decimal places
   * @param {number} value - Number to format
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted number string
   */
  formatNumber(value, decimals = 2) {
    if (value === undefined || value === null || isNaN(value)) {
      return '0';
    }
    return Number(value).toFixed(decimals);
  }

  /**
   * Format time in minutes to MM:SS format
   * @param {number} minutes - Time in minutes
   * @returns {string} Formatted time string
   */
  formatTime(minutes) {
    if (minutes === undefined || minutes === null || isNaN(minutes)) {
      return '--:--';
    }
    
    const totalSeconds = Math.floor(minutes * 60);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StatsPanel;
}
