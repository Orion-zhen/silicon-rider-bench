/**
 * CLI 参数解析单元测试
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs } from './args-parser';

describe('CLI Args Parser', () => {
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as any);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('--mode parameter parsing', () => {
    it('should parse --mode=terminal', () => {
      const args = parseArgs(['--mode', 'terminal']);
      expect(args.mode).toBe('terminal');
    });

    it('should parse --mode=web', () => {
      const args = parseArgs(['--mode', 'web']);
      expect(args.mode).toBe('web');
    });

    it('should reject invalid mode values', () => {
      expect(() => parseArgs(['--mode', 'invalid'])).toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid mode: invalid. Must be 'terminal' or 'web'"
      );
    });

    it('should default to terminal mode when not specified', () => {
      const args = parseArgs([]);
      expect(args.mode).toBe('terminal');
    });
  });

  describe('--host and --port parameter parsing', () => {
    it('should parse --host parameter', () => {
      const args = parseArgs(['--host', '192.168.1.1']);
      expect(args.host).toBe('192.168.1.1');
    });

    it('should parse --port parameter', () => {
      const args = parseArgs(['--port', '8080']);
      expect(args.port).toBe(8080);
    });

    it('should parse both --host and --port together', () => {
      const args = parseArgs(['--host', '0.0.0.0', '--port', '5000']);
      expect(args.host).toBe('0.0.0.0');
      expect(args.port).toBe(5000);
    });

    it('should reject invalid port values (non-numeric)', () => {
      expect(() => parseArgs(['--port', 'abc'])).toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid port value: 'abc' is not a valid number"
      );
    });

    it('should reject port values below 1', () => {
      expect(() => parseArgs(['--port', '0'])).toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid port value: 0 is out of range. Must be between 1 and 65535'
      );
    });

    it('should reject port values above 65535', () => {
      expect(() => parseArgs(['--port', '65536'])).toThrow('process.exit(1)');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Invalid port value: 65536 is out of range. Must be between 1 and 65535'
      );
    });

    it('should accept valid port boundary values', () => {
      const args1 = parseArgs(['--port', '1']);
      expect(args1.port).toBe(1);

      const args2 = parseArgs(['--port', '65535']);
      expect(args2.port).toBe(65535);
    });
  });

  describe('default values', () => {
    it('should use default mode=terminal when not specified', () => {
      const args = parseArgs([]);
      expect(args.mode).toBe('terminal');
    });

    it('should use default host=localhost when not specified', () => {
      const args = parseArgs([]);
      expect(args.host).toBe('localhost');
    });

    it('should use default port=3000 when not specified', () => {
      const args = parseArgs([]);
      expect(args.port).toBe(3000);
    });

    it('should use all defaults when no web-related args provided', () => {
      const args = parseArgs(['--level', '1']);
      expect(args.mode).toBe('terminal');
      expect(args.host).toBe('localhost');
      expect(args.port).toBe(3000);
    });
  });

  describe('integration with existing parameters', () => {
    it('should parse web mode with other parameters', () => {
      const args = parseArgs([
        '--level', '1',
        '--mode', 'web',
        '--host', '127.0.0.1',
        '--port', '4000',
        '--seed', '12345'
      ]);
      
      expect(args.level).toBe('level1');
      expect(args.mode).toBe('web');
      expect(args.host).toBe('127.0.0.1');
      expect(args.port).toBe(4000);
      expect(args.seed).toBe(12345);
    });

    it('should work with --no-viz flag', () => {
      const args = parseArgs([
        '--mode', 'web',
        '--no-viz'
      ]);
      
      expect(args.mode).toBe('web');
      expect(args.noVisualization).toBe(true);
    });
  });
});
