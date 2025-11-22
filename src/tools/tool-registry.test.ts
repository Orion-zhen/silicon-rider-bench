/**
 * 工具注册和验证单元测试
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry, ToolDefinition } from './tool-registry';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool successfully', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {},
        handler: async () => ({ success: true, data: {} }),
      };

      registry.register(tool);
      expect(registry.hasTool('test_tool')).toBe(true);
    });

    it('should throw error when registering duplicate tool', () => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {},
        handler: async () => ({ success: true, data: {} }),
      };

      registry.register(tool);
      expect(() => registry.register(tool)).toThrow('already registered');
    });
  });

  describe('validateParameters', () => {
    beforeEach(() => {
      const tool: ToolDefinition = {
        name: 'test_tool',
        description: 'A test tool',
        parameters: {
          requiredString: {
            type: 'string',
            required: true,
          },
          optionalNumber: {
            type: 'number',
            required: false,
            min: 0,
            max: 100,
          },
        },
        handler: async () => ({ success: true, data: {} }),
      };
      registry.register(tool);
    });

    it('should validate valid parameters', () => {
      const result = registry.validateParameters('test_tool', {
        requiredString: 'hello',
        optionalNumber: 50,
      });
      expect(result).toBeNull();
    });

    it('should reject missing required parameter', () => {
      const result = registry.validateParameters('test_tool', {});
      expect(result).not.toBeNull();
      expect(result?.error.code).toBe('INVALID_PARAMETER');
      expect(result?.error.message).toContain('required');
    });

    it('should reject invalid parameter type', () => {
      const result = registry.validateParameters('test_tool', {
        requiredString: 123,
      });
      expect(result).not.toBeNull();
      expect(result?.error.code).toBe('INVALID_PARAMETER');
      expect(result?.error.message).toContain('string');
    });

    it('should reject number below minimum', () => {
      const result = registry.validateParameters('test_tool', {
        requiredString: 'hello',
        optionalNumber: -1,
      });
      expect(result).not.toBeNull();
      expect(result?.error.message).toContain('>=');
    });

    it('should reject number above maximum', () => {
      const result = registry.validateParameters('test_tool', {
        requiredString: 'hello',
        optionalNumber: 101,
      });
      expect(result).not.toBeNull();
      expect(result?.error.message).toContain('<=');
    });

    it('should reject unknown tool', () => {
      const result = registry.validateParameters('unknown_tool', {});
      expect(result).not.toBeNull();
      expect(result?.error.message).toContain('Unknown tool');
    });
  });

  describe('array parameter validation', () => {
    beforeEach(() => {
      const tool: ToolDefinition = {
        name: 'array_tool',
        description: 'Tool with array parameter',
        parameters: {
          items: {
            type: 'array',
            required: true,
            items: {
              type: 'string',
            },
          },
        },
        handler: async () => ({ success: true, data: {} }),
      };
      registry.register(tool);
    });

    it('should validate valid array', () => {
      const result = registry.validateParameters('array_tool', {
        items: ['a', 'b', 'c'],
      });
      expect(result).toBeNull();
    });

    it('should reject non-array', () => {
      const result = registry.validateParameters('array_tool', {
        items: 'not an array',
      });
      expect(result).not.toBeNull();
      expect(result?.error.message).toContain('array');
    });

    it('should reject array with invalid item type', () => {
      const result = registry.validateParameters('array_tool', {
        items: ['a', 123, 'c'],
      });
      expect(result).not.toBeNull();
      expect(result?.error.message).toContain('string');
    });
  });
});
