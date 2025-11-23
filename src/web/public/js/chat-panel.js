/**
 * ChatPanel - Manages the conversation display panel
 * Displays AI messages, tool calls, and tool results
 * 
 * Performance optimizations:
 * - Limits conversation history to prevent memory issues
 * - Uses requestAnimationFrame for smooth scrolling
 */
class ChatPanel {
  constructor(containerElement) {
    this.container = containerElement;
    this.messagesContainer = null;
    this.maxMessages = 100; // 限制最大消息数量
    this.messageCount = 0;
    this.initialize();
  }

  /**
   * Initialize the panel structure
   */
  initialize() {
    console.log('[ChatPanel] Initializing panel structure');
    
    this.container.innerHTML = `
      <div class="chat-header">
        <h3>AI Conversation</h3>
      </div>
      <div class="chat-messages" id="chat-messages">
        <div class="chat-welcome">
          <p>🤖 Waiting for AI agent to start...</p>
        </div>
      </div>
    `;
    
    this.messagesContainer = document.getElementById('chat-messages');
    
    console.log('[ChatPanel] Messages container:', this.messagesContainer);
  }

  /**
   * Add a conversation message
   * @param {string} role - Message role (user, assistant, system)
   * @param {string} content - Message content
   */
  addMessage(role, content) {
    if (!this.messagesContainer) return;

    // Remove welcome message if it exists
    const welcome = this.messagesContainer.querySelector('.chat-welcome');
    if (welcome) {
      welcome.remove();
    }

    const messageElement = document.createElement('div');
    messageElement.className = `chat-message chat-message-${role}`;
    
    const roleLabel = this.getRoleLabel(role);
    const formattedContent = this.formatMessageContent(content);
    
    messageElement.innerHTML = `
      <div class="message-header">
        <span class="message-role">${roleLabel}</span>
        <span class="message-time">${this.getCurrentTime()}</span>
      </div>
      <div class="message-content">${formattedContent}</div>
    `;
    
    this.messagesContainer.appendChild(messageElement);
    this.messageCount++;
    
    // 限制消息历史记录数量
    this.limitMessageHistory();
    
    this.scrollToBottom();
  }

  /**
   * Add a tool call message
   * @param {string} toolName - Name of the tool being called
   * @param {Object} args - Tool arguments
   */
  addToolCall(toolName, args) {
    if (!this.messagesContainer) return;

    // Remove welcome message if it exists
    const welcome = this.messagesContainer.querySelector('.chat-welcome');
    if (welcome) {
      welcome.remove();
    }

    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message chat-tool-call';
    
    const formattedArgs = this.formatToolArguments(args);
    
    messageElement.innerHTML = `
      <div class="message-header">
        <span class="message-role">🔧 Tool Call</span>
        <span class="message-time">${this.getCurrentTime()}</span>
      </div>
      <div class="message-content">
        <div class="tool-name">${this.escapeHtml(toolName)}</div>
        <div class="tool-args">${formattedArgs}</div>
      </div>
    `;
    
    this.messagesContainer.appendChild(messageElement);
    this.messageCount++;
    
    // 限制消息历史记录数量
    this.limitMessageHistory();
    
    this.scrollToBottom();
  }

  /**
   * Add a tool result message
   * @param {string} toolName - Name of the tool
   * @param {boolean} success - Whether the tool call succeeded
   * @param {any} result - Tool result data
   */
  addToolResult(toolName, success, result) {
    if (!this.messagesContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `chat-message chat-tool-result ${success ? 'success' : 'error'}`;
    
    const statusIcon = success ? '✅' : '❌';
    const statusText = success ? 'Success' : 'Error';
    const formattedResult = this.formatToolResult(result);
    
    messageElement.innerHTML = `
      <div class="message-header">
        <span class="message-role">${statusIcon} Tool Result: ${this.escapeHtml(toolName)}</span>
        <span class="message-time">${this.getCurrentTime()}</span>
      </div>
      <div class="message-content">
        <div class="tool-status">${statusText}</div>
        <div class="tool-result">${formattedResult}</div>
      </div>
    `;
    
    this.messagesContainer.appendChild(messageElement);
    this.messageCount++;
    
    // 限制消息历史记录数量
    this.limitMessageHistory();
    
    this.scrollToBottom();
  }
  
  /**
   * Limit message history to prevent memory issues
   * Removes oldest messages when limit is exceeded
   */
  limitMessageHistory() {
    if (!this.messagesContainer) return;
    
    // 获取所有消息元素（排除欢迎消息）
    const messages = this.messagesContainer.querySelectorAll('.chat-message');
    
    // 如果超过限制，删除最旧的消息
    if (messages.length > this.maxMessages) {
      const toRemove = messages.length - this.maxMessages;
      for (let i = 0; i < toRemove; i++) {
        messages[i].remove();
      }
      this.messageCount = this.maxMessages;
      console.log(`[ChatPanel] Removed ${toRemove} old message(s) to maintain limit of ${this.maxMessages}`);
    }
  }

  /**
   * Scroll to the bottom of the messages container
   */
  scrollToBottom() {
    if (!this.messagesContainer) return;
    
    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    });
  }

  /**
   * Get role label for display
   * @param {string} role - Message role
   * @returns {string} Display label
   */
  getRoleLabel(role) {
    const labels = {
      'user': '👤 User',
      'assistant': '🤖 AI Agent',
      'system': '⚙️ System'
    };
    return labels[role] || `📝 ${role}`;
  }

  /**
   * Format message content with basic markdown-like formatting
   * @param {string} content - Raw message content
   * @returns {string} Formatted HTML content
   */
  formatMessageContent(content) {
    if (!content) return '';
    
    let formatted = this.escapeHtml(content);
    
    // Convert newlines to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    // Highlight code blocks (```code```)
    formatted = formatted.replace(/```([^`]+)```/g, '<code class="code-block">$1</code>');
    
    // Highlight inline code (`code`)
    formatted = formatted.replace(/`([^`]+)`/g, '<code class="code-inline">$1</code>');
    
    // Bold text (**text**)
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    return formatted;
  }

  /**
   * Format tool arguments for display
   * @param {Object} args - Tool arguments object
   * @returns {string} Formatted HTML
   */
  formatToolArguments(args) {
    if (!args || typeof args !== 'object') {
      return '<pre>' + this.escapeHtml(String(args)) + '</pre>';
    }
    
    try {
      const formatted = JSON.stringify(args, null, 2);
      return '<pre class="json-display">' + this.escapeHtml(formatted) + '</pre>';
    } catch (error) {
      return '<pre>' + this.escapeHtml(String(args)) + '</pre>';
    }
  }

  /**
   * Format tool result for display
   * @param {any} result - Tool result data
   * @returns {string} Formatted HTML
   */
  formatToolResult(result) {
    if (result === null || result === undefined) {
      return '<pre>null</pre>';
    }
    
    if (typeof result === 'string') {
      return '<pre>' + this.escapeHtml(result) + '</pre>';
    }
    
    if (typeof result === 'object') {
      try {
        const formatted = JSON.stringify(result, null, 2);
        return '<pre class="json-display">' + this.escapeHtml(formatted) + '</pre>';
      } catch (error) {
        return '<pre>' + this.escapeHtml(String(result)) + '</pre>';
      }
    }
    
    return '<pre>' + this.escapeHtml(String(result)) + '</pre>';
  }

  /**
   * Escape HTML special characters
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get current time formatted as HH:MM:SS
   * @returns {string} Formatted time string
   */
  getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
}

// Export for use in main.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatPanel;
}
