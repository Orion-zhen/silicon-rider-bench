/**
 * CLI 参数解析属性测试
 * 
 * Feature: web-visualization, Property 2: Port parameter binding
 * Validates: Requirements 1.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { parseArgs } from './args-parser';

describe('CLI Args Parser - Property-Based Tests', () => {
  describe('Property 2: Port parameter binding', () => {
    /**
     * Property: For any valid port number, when passed via --port parameter,
     * the Web server should listen on that specified port
     * 
     * This property tests that:
     * 1. Any valid port number (1-65535) is correctly parsed
     * 2. The parsed port value matches the input port value
     * 3. The parser correctly handles the full range of valid ports
     */
    it('should bind to any valid port number passed via --port parameter', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 65535 }),
          (port) => {
            // Parse the arguments with the generated port
            const args = parseArgs(['--port', port.toString()]);
            
            // The parsed port should exactly match the input port
            expect(args.port).toBe(port);
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    });

    /**
     * Additional property: Port parameter should work with other parameters
     * 
     * This ensures that port binding works correctly when combined with
     * other CLI parameters
     */
    it('should bind to valid port when combined with other parameters', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 65535 }),
          fc.constantFrom('terminal', 'web'),
          fc.constantFrom('localhost', '0.0.0.0', '127.0.0.1', '192.168.1.1'),
          (port, mode, host) => {
            // Parse with multiple parameters
            const args = parseArgs([
              '--mode', mode,
              '--host', host,
              '--port', port.toString()
            ]);
            
            // All parameters should be correctly parsed
            expect(args.port).toBe(port);
            expect(args.mode).toBe(mode);
            expect(args.host).toBe(host);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
