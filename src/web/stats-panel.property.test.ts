/**
 * Property-Based Tests for StatsPanel
 * Feature: web-visualization
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

// Load the StatsPanel class from the client-side JavaScript file
const statsPanelCode = fs.readFileSync(
  path.join(__dirname, 'public/js/stats-panel.js'),
  'utf-8'
);

// Create a DOM environment for testing
function createTestEnvironment() {
  const dom = new JSDOM('<!DOCTYPE html><div id="stats-container"></div>');
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
  };
  
  // Execute the StatsPanel code in the context with document available
  const scriptCode = `
    ${statsPanelCode}
    return StatsPanel;
  `;
  
  const script = new window.Function('document', scriptCode);
  const StatsPanel = script.call(window, document);
  
  return { StatsPanel, document, window };
}

describe('StatsPanel Property Tests', () => {
  /**
   * Property 6: Statistics panel data display
   * For any agent state values (time, battery, profit, orders, weight), 
   * the statistics panel HTML should contain string representations of all these values
   * Validates: Requirements 3.2, 3.3, 3.4, 3.5, 3.6
   */
  describe('Property 6: Statistics panel data display', () => {
    it('should display all agent state values in the panel HTML', () => {
      fc.assert(
        fc.property(
          fc.record({
            battery: fc.float({ min: 0, max: 100, noNaN: true }),
            profit: fc.float({ min: -1000, max: 10000, noNaN: true }),
            totalWeight: fc.float({ min: 0, max: 100, noNaN: true }),
            completedOrders: fc.nat({ max: 1000 }),
            carriedOrders: fc.array(
              fc.record({
                id: fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
                type: fc.stringMatching(/^[a-zA-Z0-9 _-]+$/),
                weight: fc.float({ min: 0, max: 10, noNaN: true }),
                deadline: fc.float({ min: 0, max: 1000, noNaN: true }),
                pickedUp: fc.boolean(),
              }),
              { maxLength: 10 }
            ),
          }),
          fc.stringMatching(/^[0-9]{2}:[0-9]{2}$/), // formattedTime like "12:34"
          (agentState, formattedTime) => {
            const { StatsPanel, document } = createTestEnvironment();
            const container = document.getElementById('stats-container');
            const panel = new StatsPanel(container);
            
            // Update the panel with agent state
            panel.update(agentState, formattedTime);
            
            // Get the HTML content
            const containerHTML = container.innerHTML;
            
            // Check that all values are present in the HTML
            // Time should be present
            expect(containerHTML).toContain(formattedTime);
            
            // Battery should be present (formatted with 1 decimal)
            const batteryStr = agentState.battery.toFixed(1);
            expect(containerHTML).toContain(batteryStr);
            
            // Profit should be present (formatted with 2 decimals)
            const profitStr = agentState.profit.toFixed(2);
            expect(containerHTML).toContain(profitStr);
            
            // Total weight should be present (formatted with 1 decimal)
            const weightStr = agentState.totalWeight.toFixed(1);
            expect(containerHTML).toContain(weightStr);
            
            // Completed orders count should be present
            expect(containerHTML).toContain(agentState.completedOrders.toString());
            
            // Carried orders count should be present
            expect(containerHTML).toContain(agentState.carriedOrders.length.toString());
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Order list rendering
   * For any list of carried orders, the statistics panel should display 
   * each order's id, type, weight, and deadline
   * Validates: Requirements 3.7
   */
  describe('Property 7: Order list rendering', () => {
    it('should display all order details for each carried order', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
              type: fc.stringMatching(/^[a-zA-Z0-9 _-]+$/),
              weight: fc.float({ min: Math.fround(0.1), max: 10, noNaN: true }),
              deadline: fc.float({ min: 0, max: 1000, noNaN: true }),
              pickedUp: fc.boolean(),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (carriedOrders) => {
            const { StatsPanel, document } = createTestEnvironment();
            const container = document.getElementById('stats-container');
            const panel = new StatsPanel(container);
            
            // Update orders
            panel.updateOrders(carriedOrders);
            
            // Get the HTML content
            const containerHTML = container.innerHTML;
            
            // Check that each order's details are present
            carriedOrders.forEach(order => {
              // Order ID should be present
              expect(containerHTML).toContain(order.id);
              
              // Order type should be present
              expect(containerHTML).toContain(order.type);
              
              // Order weight should be present (formatted with 1 decimal)
              const weightStr = order.weight.toFixed(1);
              expect(containerHTML).toContain(weightStr);
              
              // Deadline should be formatted and present
              // The formatTime method converts minutes to MM:SS format
              const totalSeconds = Math.floor(order.deadline * 60);
              const mins = Math.floor(totalSeconds / 60);
              const secs = totalSeconds % 60;
              const deadlineStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
              expect(containerHTML).toContain(deadlineStr);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 13: Client statistics update
   * For any state update message received by the client, 
   * the statistics panel should reflect the new values from the message
   * Validates: Requirements 5.3
   */
  describe('Property 13: Client statistics update', () => {
    it('should update all statistics when receiving a state update', () => {
      fc.assert(
        fc.property(
          fc.record({
            battery: fc.float({ min: 0, max: 100, noNaN: true }),
            profit: fc.float({ min: -1000, max: 10000, noNaN: true }),
            totalWeight: fc.float({ min: 0, max: 100, noNaN: true }),
            completedOrders: fc.nat({ max: 1000 }),
            carriedOrders: fc.array(
              fc.record({
                id: fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
                type: fc.stringMatching(/^[a-zA-Z0-9 _-]+$/),
                weight: fc.float({ min: 0, max: 10, noNaN: true }),
                deadline: fc.float({ min: 0, max: 1000, noNaN: true }),
                pickedUp: fc.boolean(),
              }),
              { maxLength: 10 }
            ),
          }),
          fc.stringMatching(/^[0-9]{2}:[0-9]{2}$/),
          fc.record({
            battery: fc.float({ min: 0, max: 100, noNaN: true }),
            profit: fc.float({ min: -1000, max: 10000, noNaN: true }),
            totalWeight: fc.float({ min: 0, max: 100, noNaN: true }),
            completedOrders: fc.nat({ max: 1000 }),
            carriedOrders: fc.array(
              fc.record({
                id: fc.stringMatching(/^[a-zA-Z0-9_-]+$/),
                type: fc.stringMatching(/^[a-zA-Z0-9 _-]+$/),
                weight: fc.float({ min: 0, max: 10, noNaN: true }),
                deadline: fc.float({ min: 0, max: 1000, noNaN: true }),
                pickedUp: fc.boolean(),
              }),
              { maxLength: 10 }
            ),
          }),
          fc.stringMatching(/^[0-9]{2}:[0-9]{2}$/),
          (initialState, initialTime, updatedState, updatedTime) => {
            const { StatsPanel, document } = createTestEnvironment();
            const container = document.getElementById('stats-container');
            const panel = new StatsPanel(container);
            
            // Set initial state
            panel.update(initialState, initialTime);
            
            // Update with new state
            panel.update(updatedState, updatedTime);
            
            // Get the HTML content after update
            const containerHTML = container.innerHTML;
            
            // Verify that the panel now shows the UPDATED values, not the initial ones
            // Time should be updated
            expect(containerHTML).toContain(updatedTime);
            
            // Battery should be updated
            const updatedBatteryStr = updatedState.battery.toFixed(1);
            expect(containerHTML).toContain(updatedBatteryStr);
            
            // Profit should be updated
            const updatedProfitStr = updatedState.profit.toFixed(2);
            expect(containerHTML).toContain(updatedProfitStr);
            
            // Total weight should be updated
            const updatedWeightStr = updatedState.totalWeight.toFixed(1);
            expect(containerHTML).toContain(updatedWeightStr);
            
            // Completed orders should be updated
            expect(containerHTML).toContain(updatedState.completedOrders.toString());
            
            // Carried orders count should be updated
            expect(containerHTML).toContain(updatedState.carriedOrders.length.toString());
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
