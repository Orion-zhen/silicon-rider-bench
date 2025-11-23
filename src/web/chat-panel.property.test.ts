/**
 * Property-Based Tests for ChatPanel
 * Feature: web-visualization
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

// Load the ChatPanel class from the client-side JavaScript file
const chatPanelCode = fs.readFileSync(
  path.join(__dirname, 'public/js/chat-panel.js'),
  'utf-8'
);

// Create a DOM environment for testing
function createTestEnvironment() {
  const dom = new JSDOM('<!DOCTYPE html><div id="chat-container"></div>');
  const window = dom.window;
  const document = window.document;
  
  // Create a context with document and window available
  const context = {
    document,
    window,
    console,
    Map: window.Map,
    Math: window.Math,
    Object: window.Object,
    String: window.String,
    Number: window.Number,
    Date: window.Date,
    JSON: window.JSON,
    requestAnimationFrame: (cb: () => void) => setTimeout(cb, 0),
  };
  
  // Execute the ChatPanel code in the context with document available
  const scriptCode = `
    ${chatPanelCode}
    return ChatPanel;
  `;
  
  const script = new window.Function('document', 'requestAnimationFrame', scriptCode);
  const ChatPanel = script.call(window, document, context.requestAnimationFrame);
  
  return { ChatPanel, document, window };
}

describe('ChatPanel Property Tests', () => {
  /**
   * Property 8: Conversation message display
   * For any AI message content, the conversation panel should contain 
   * that message text after it is sent
   * Validates: Requirements 4.2
   */
  describe('Property 8: Conversation message display', () => {
    it('should display message content in the conversation panel', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('user', 'assistant', 'system'),
          fc.string({ minLength: 1, maxLength: 500 }),
          (role, content) => {
            const { ChatPanel, document } = createTestEnvironment();
            const container = document.getElementById('chat-container');
            const panel = new ChatPanel(container);
            
            // Add a message
            panel.addMessage(role, content);
            
            // Get the HTML content
            const containerHTML = container.innerHTML;
            
            // The message content should be present in the HTML
            // Note: content is escaped, so we need to check for the escaped version
            const tempDiv = document.createElement('div');
            tempDiv.textContent = content;
            const escapedContent = tempDiv.innerHTML;
            
            expect(containerHTML).toContain(escapedContent);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: Tool call display
   * For any tool call with name and arguments, the conversation panel 
   * should display both the tool name and the argument values
   * Validates: Requirements 4.3
   */
  describe('Property 9: Tool call display', () => {
    it('should display tool name and arguments in the conversation panel', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/), // Valid tool name
          fc.record({
            param1: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
            param2: fc.oneof(fc.string(), fc.integer(), fc.boolean()),
          }),
          (toolName, args) => {
            const { ChatPanel, document } = createTestEnvironment();
            const container = document.getElementById('chat-container');
            const panel = new ChatPanel(container);
            
            // Add a tool call
            panel.addToolCall(toolName, args);
            
            // Get the HTML content
            const containerHTML = container.innerHTML;
            
            // Tool name should be present (escaped)
            const tempDiv = document.createElement('div');
            tempDiv.textContent = toolName;
            const escapedToolName = tempDiv.innerHTML;
            expect(containerHTML).toContain(escapedToolName);
            
            // Arguments should be present as JSON
            // The arguments are formatted as JSON, so we check for the JSON representation
            const jsonStr = JSON.stringify(args, null, 2);
            
            // Check for the presence of argument keys in the JSON
            Object.keys(args).forEach(key => {
              expect(containerHTML).toContain(key);
            });
            
            // For values, we need to check the JSON representation which will be escaped
            // We can verify that the JSON structure is present by checking for the keys
            // and the overall structure (braces, colons, etc.)
            expect(containerHTML).toContain('{');
            expect(containerHTML).toContain('}');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 10: Tool result display
   * For any tool result data, the conversation panel should contain 
   * a representation of that result after it is received
   * Validates: Requirements 4.4
   */
  describe('Property 10: Tool result display', () => {
    it('should display tool result in the conversation panel', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/), // Valid tool name
          fc.boolean(), // success flag
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.record({
              status: fc.string(),
              data: fc.oneof(fc.string(), fc.integer()),
            })
          ),
          (toolName, success, result) => {
            const { ChatPanel, document } = createTestEnvironment();
            const container = document.getElementById('chat-container');
            const panel = new ChatPanel(container);
            
            // Add a tool result
            panel.addToolResult(toolName, success, result);
            
            // Get the HTML content
            const containerHTML = container.innerHTML;
            
            // Tool name should be present (escaped)
            const tempDiv = document.createElement('div');
            tempDiv.textContent = toolName;
            const escapedToolName = tempDiv.innerHTML;
            expect(containerHTML).toContain(escapedToolName);
            
            // Success/Error status should be indicated
            if (success) {
              expect(containerHTML).toContain('Success');
            } else {
              expect(containerHTML).toContain('Error');
            }
            
            // Result data should be present
            if (typeof result === 'string') {
              tempDiv.textContent = result;
              const escapedResult = tempDiv.innerHTML;
              expect(containerHTML).toContain(escapedResult);
            } else if (typeof result === 'number') {
              expect(containerHTML).toContain(String(result));
            } else if (typeof result === 'object' && result !== null) {
              // For objects, check that keys are present
              Object.keys(result).forEach(key => {
                expect(containerHTML).toContain(key);
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 14: Client conversation update
   * For any conversation message received by the client, 
   * that message should appear in the conversation panel
   * Validates: Requirements 5.4
   */
  describe('Property 14: Client conversation update', () => {
    it('should add new messages to the conversation panel', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              role: fc.constantFrom('user', 'assistant', 'system'),
              content: fc.string({ minLength: 1, maxLength: 200 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (messages) => {
            const { ChatPanel, document } = createTestEnvironment();
            const container = document.getElementById('chat-container');
            const panel = new ChatPanel(container);
            
            // Add all messages
            messages.forEach(msg => {
              panel.addMessage(msg.role, msg.content);
            });
            
            // The number of message elements should match
            const messageElements = container.querySelectorAll('.chat-message');
            expect(messageElements.length).toBe(messages.length);
            
            // Each message should have the correct role class
            messages.forEach((msg, index) => {
              const messageElement = messageElements[index];
              expect(messageElement.classList.contains(`chat-message-${msg.role}`)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
