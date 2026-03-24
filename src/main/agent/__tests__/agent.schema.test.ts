/**
 * Tests for Agent class - schema manipulation functions (fixInputSchema, stripUnsupportedSchemaKeywords)
 */

// Mock dependencies
vi.mock('@/logger');
vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

// Import dependencies
import { vi, describe, expect, it, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

import type { McpToolInputSchema } from '@common/types';

// We need to import Agent after mocks are set up
const AgentModule = await import('../agent');
const { Agent: AgentClass } = AgentModule;

// Add Agent type since we're using it
type Agent = InstanceType<typeof AgentClass>;

describe('Agent - Schema Manipulation', () => {
  let agent: Agent;
  let mockUuidv4: ReturnType<typeof vi.mocked<typeof uuidv4>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup uuid mock
    mockUuidv4 = vi.mocked(uuidv4);
    mockUuidv4.mockImplementation(() => 'uuid-1' as any);

    // Create minimal mocks for Agent constructor dependencies
    const mockStore = {
      getSettings: vi.fn(() => ({})),
    };
    const mockAgentProfileManager = {};
    const mockMcpManager = {
      getConnectors: vi.fn(() => []),
    };
    const mockModelManager = {
      createLlm: vi.fn(),
      getProviderOptions: vi.fn(() => ({})),
      getProviderParameters: vi.fn(() => ({})),
      getCacheControl: vi.fn(() => ({})),
      getModelSettings: vi.fn(() => undefined),
      getProviderTools: vi.fn(() => Promise.resolve({})),
      isStreamingDisabled: vi.fn(() => false),
    };
    const mockTelemetryManager = {
      captureAgentRun: vi.fn(),
    };
    const mockMemoryManager = {};
    const mockPromptsManager = {};
    const mockExtensionManager = {
      isInitialized: vi.fn(() => false),
    };

    agent = new AgentClass(
      mockStore as any,
      mockAgentProfileManager as any,
      mockMcpManager as any,
      mockModelManager as any,
      mockTelemetryManager as any,
      mockMemoryManager as any,
      mockPromptsManager as any,
      mockExtensionManager as any,
    );
  });

  describe('stripUnsupportedSchemaKeywords', () => {
    it('should remove all JSON Schema 2019-09 keywords from a simple schema', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        propertyNames: { type: 'string' },
        unevaluatedProperties: false,
        dependentSchemas: {},
        dependentRequired: {},
        contains: { type: 'string' },
        contentMediaType: 'application/json',
        contentEncoding: '7bit',
        examples: ['test'],
        $defs: { TestDef: { type: 'string' } },
        $anchor: 'test-anchor',
        $recursiveRef: 'test',
        $recursiveAnchor: true,
      };

      const result = agent['stripUnsupportedSchemaKeywords'](inputSchema);

      // Check that unsupported keywords are removed
      expect(result).not.toHaveProperty('propertyNames');
      expect(result).not.toHaveProperty('unevaluatedProperties');
      expect(result).not.toHaveProperty('dependentSchemas');
      expect(result).not.toHaveProperty('dependentRequired');
      expect(result).not.toHaveProperty('contains');
      expect(result).not.toHaveProperty('contentMediaType');
      expect(result).not.toHaveProperty('contentEncoding');
      expect(result).not.toHaveProperty('examples');
      expect(result).not.toHaveProperty('$defs');
      expect(result).not.toHaveProperty('$anchor');
      expect(result).not.toHaveProperty('$recursiveRef');
      expect(result).not.toHaveProperty('$recursiveAnchor');

      // Check that supported keywords are preserved
      expect(result).toHaveProperty('type', 'object');
      expect(result).toHaveProperty('properties');
    });

    it('should recursively remove keywords from nested schemas', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          nested: {
            type: 'object',
            propertyNames: { type: 'string' },
            $defs: { TestDef: { type: 'string' } },
            properties: {
              field: { type: 'string', examples: ['test'] },
            },
          },
        },
        items: {
          type: 'string',
          contains: { type: 'number' },
        },
      };

      const result = agent['stripUnsupportedSchemaKeywords'](inputSchema);

      // Check nested objects
      expect((result.properties as any).nested).not.toHaveProperty('propertyNames');
      expect((result.properties as any).nested).not.toHaveProperty('$defs');
      expect(((result.properties as any).nested as any).properties.field).not.toHaveProperty('examples');

      // Check items
      expect((result as any).items).not.toHaveProperty('contains');
    });

    it('should handle arrays with nested schemas (anyOf, oneOf, allOf)', () => {
      const inputSchema = {
        type: 'object',
        anyOf: [
          { type: 'string', propertyNames: { type: 'string' } },
          { type: 'number', $defs: { TestDef: { type: 'string' } } },
        ],
        oneOf: [{ type: 'boolean', examples: [true] }],
        allOf: [{ type: 'null', contentMediaType: 'text/plain' }],
      };

      const result = agent['stripUnsupportedSchemaKeywords'](inputSchema);

      // Check anyOf items
      expect((result as any).anyOf).toHaveLength(2);
      expect((result as any).anyOf[0]).not.toHaveProperty('propertyNames');
      expect((result as any).anyOf[1]).not.toHaveProperty('$defs');

      // Check oneOf items
      expect((result as any).oneOf).toHaveLength(1);
      expect((result as any).oneOf[0]).not.toHaveProperty('examples');

      // Check allOf items
      expect((result as any).allOf).toHaveLength(1);
      expect((result as any).allOf[0]).not.toHaveProperty('contentMediaType');
    });

    it('should preserve standard JSON Schema keywords', () => {
      const inputSchema = {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name field' },
          age: { type: 'integer', minimum: 0, maximum: 150 },
          email: { type: 'string', format: 'email' },
          tags: { type: 'array', items: { type: 'string' }, minItems: 1 },
          address: {
            type: 'object',
            required: ['street'],
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
            },
          },
        },
        required: ['name'],
        additionalProperties: false,
        enum: ['value1', 'value2'],
        const: 'fixed-value',
      };

      const result = agent['stripUnsupportedSchemaKeywords'](inputSchema);

      // All standard keywords should be preserved
      expect(result).toEqual(inputSchema);
    });
  });

  describe('fixInputSchema for gemini-cli', () => {
    it('should strip all fields when anyOf is present (only keeps any_of)', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          status: {
            anyOf: [
              { type: 'string', description: 'Active status' },
              { type: 'null', description: 'No status' },
            ],
            description: 'The status of the item',
            default: 'active',
            examples: ['active', 'inactive'],
          },
        },
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      expect(result.properties).toHaveProperty('status');
      const status = (result.properties as any).status;
      expect(status).toHaveProperty('any_of');
      expect(status).not.toHaveProperty('anyOf');
      expect(status).not.toHaveProperty('description');
      expect(status).not.toHaveProperty('default');
      expect(status).not.toHaveProperty('examples');
    });

    it('should strip all fields when oneOf is present (only keeps one_of)', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          type: {
            oneOf: [
              { type: 'string', const: 'cat' },
              { type: 'string', const: 'dog' },
            ],
            description: 'Pet type',
            default: 'cat',
          },
        },
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      expect(result.properties).toHaveProperty('type');
      const petType = (result.properties as any).type;
      expect(petType).toHaveProperty('one_of');
      expect(petType).not.toHaveProperty('oneOf');
      expect(petType).not.toHaveProperty('description');
      expect(petType).not.toHaveProperty('default');
    });

    it('should handle nested schemas correctly', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              role: {
                anyOf: [
                  { type: 'string', const: 'admin' },
                  { type: 'string', const: 'user' },
                ],
                description: 'User role',
                default: 'user',
              },
              email: {
                type: 'string',
                format: 'email',
                description: 'User email',
              },
            },
            description: 'User object',
          },
        },
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      // The current implementation only processes top-level properties,
      // not nested schemas. So nested anyOf is preserved (not converted to any_of).
      // This test verifies the current behavior.
      const user = (result.properties as any).user;
      expect(user).toHaveProperty('properties');
      const role = (user.properties as any).role;
      // Note: nested anyOf is NOT processed at deeper levels
      expect(role).toHaveProperty('anyOf');
      expect(role).not.toHaveProperty('any_of');

      // For nested properties, the format removal is NOT applied
      // (only top-level properties are processed for format removal)
      const email = (user.properties as any).email;
      expect(email).toHaveProperty('type', 'string');
      expect(email).toHaveProperty('format', 'email'); // format is preserved at nested level
      expect(email).toHaveProperty('description', 'User email');
    });

    it('should remove default values from non-anyOf/oneOf/allOf properties', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            default: 'John Doe',
            description: 'User name',
          },
          age: {
            type: 'number',
            default: 25,
          },
        },
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      expect((result.properties as any).name).not.toHaveProperty('default');
      expect((result.properties as any).name).toHaveProperty('description');
      expect((result.properties as any).age).not.toHaveProperty('default');
    });

    it('should remove unsupported formats (only keeps enum and date-time)', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            format: 'email',
            description: 'Email address',
          },
          uri: {
            type: 'string',
            format: 'uri',
            description: 'URI',
          },
          dateTime: {
            type: 'string',
            format: 'date-time',
            description: 'Date time',
          },
          hostname: {
            type: 'string',
            format: 'hostname',
            description: 'Hostname',
          },
          status: {
            type: 'string',
            format: 'enum',
            description: 'Status with enum format',
          },
        },
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      // Only 'enum' and 'date-time' formats are preserved, others are removed
      expect((result.properties as any).email).not.toHaveProperty('format');
      expect((result.properties as any).uri).not.toHaveProperty('format');
      expect((result.properties as any).dateTime).toHaveProperty('format', 'date-time');
      expect((result.properties as any).hostname).not.toHaveProperty('format');
      expect((result.properties as any).status).toHaveProperty('format', 'enum');
    });

    it('should add placeholder property when properties object is empty', () => {
      // To test the placeholder, we need to pass a schema with an empty properties object
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {},
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      // Placeholder should be added when there are no properties
      expect(result.properties).toHaveProperty('placeholder');
      expect((result.properties as any).placeholder).toHaveProperty('type', 'string');
      expect((result.properties as any).placeholder).toHaveProperty('description');
    });

    it('should not modify schemas for non-gemini providers', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            default: 'John',
            format: 'email',
          },
        },
      };

      const result = agent['fixInputSchema']('openai', inputSchema);

      // Should return original schema unchanged
      expect(result).toEqual(inputSchema);
    });

    it('should handle allOf correctly', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          config: {
            allOf: [
              { type: 'string', description: 'Config value 1' },
              { type: 'null', description: 'Config value 2' },
            ],
            description: 'Configuration',
            default: 'default',
          },
        },
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      expect(result.properties).toHaveProperty('config');
      const config = (result.properties as any).config;
      expect(config).toHaveProperty('all_of');
      expect(config).not.toHaveProperty('allOf');
      expect(config).not.toHaveProperty('description');
      expect(config).not.toHaveProperty('default');
    });

    it('should handle null type by converting to string', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          value: {
            type: 'null',
            description: 'Nullable value',
          },
        },
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      expect((result.properties as any).value).toHaveProperty('type', 'string');
    });

    it('should handle missing type by converting to string', () => {
      const inputSchema: McpToolInputSchema = {
        type: 'object',
        properties: {
          value: {
            description: 'Value without type',
          },
        },
      };

      const result = agent['fixInputSchema']('gemini-cli', inputSchema);

      expect((result.properties as any).value).toHaveProperty('type', 'string');
    });
  });
});
