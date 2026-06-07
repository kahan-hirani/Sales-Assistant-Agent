const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sales Agent API',
      description: [
        'Production-ready AI Sales Assistant API',
        '',
        'This API provides an intelligent conversational AI that helps prospects understand product plans and pricing.',
        '',
        '## Key Features',
        '- Persistent Memory: Remembers conversations across sessions',
        '- Real Tools: Uses get_user_memory, search_catalog, and flag_for_human',
        '- Self-Evaluation: Every response scored for quality',
        '- GDPR Compliant: Full data deletion support',
        '',
        '## Authentication',
        'This API uses simple user identification. Pass any unique string as the userId.',
        '',
        '## Response Format',
        'All responses follow a standard envelope:',
        '- Success: {"success": true, "data": {...}}',
        '- Error: {"success": false, "error": {...}}',
        '',
        '## Testing',
        'Use the "Try it out" button on any endpoint to test directly from this documentation!'
      ].join('\n'),
      version: '1.0.0',
      contact: {
        name: 'Sales Agent Team',
        email: 'support@salesagent.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Local development server'
      },
      {
        url: '{protocol}://{host}/api/v1',
        description: 'Custom server',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'http'
          },
          host: {
            default: 'localhost:3000'
          }
        }
      }
    ],
    tags: [
      {
        name: 'Getting Started',
        description: 'Health check and system status endpoints'
      },
      {
        name: 'Chat',
        description: 'Main conversation endpoints for interacting with the AI sales agent'
      },
      {
        name: 'Catalog',
        description: 'Product catalog and pricing information'
      },
      {
        name: 'Analytics',
        description: 'Quality evaluation and usage statistics'
      }
    ],
    components: {
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                  example: 'Validation failed'
                },
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR'
                },
                details: {
                  type: 'array',
                  items: {
                    type: 'object'
                  }
                }
              }
            }
          }
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['ok', 'degraded'],
              example: 'ok'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:35:00.000Z'
            },
            version: {
              type: 'string',
              example: '1.0.0'
            },
            db: {
              type: 'string',
              enum: ['connected', 'disconnected'],
              example: 'connected'
            },
            environment: {
              type: 'string',
              example: 'development'
            }
          }
        },
        Product: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Enterprise'
            },
            price: {
              type: 'string',
              example: '$499/mo'
            },
            annual_price: {
              type: 'string',
              example: '$4,790/yr'
            },
            features: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['unlimited users', 'SSO', 'audit logs']
            },
            ideal_for: {
              type: 'string',
              example: 'Large organizations needing compliance and scale'
            }
          }
        },
        Catalog: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Product'
              }
            },
            addons: {
              type: 'array',
              items: {
                type: 'object'
              }
            },
            faq: {
              type: 'array',
              items: {
                type: 'object'
              }
            }
          }
        },
        EvaluationScores: {
          type: 'object',
          properties: {
            groundedness: {
              type: 'number',
              format: 'float',
              minimum: 0,
              maximum: 1,
              description: 'Did the response use actual catalog data?',
              example: 0.95
            },
            relevance: {
              type: 'number',
              format: 'float',
              minimum: 0,
              maximum: 1,
              description: 'Did it answer what was asked?',
              example: 0.98
            },
            confidence: {
              type: 'number',
              format: 'float',
              minimum: 0,
              maximum: 1,
              description: 'Overall quality score',
              example: 0.96
            },
            flagged: {
              type: 'boolean',
              description: 'True if quality is below threshold',
              example: false
            },
            reasoning: {
              type: 'string',
              description: 'Explanation of the scores',
              example: 'Response accurately cited all Enterprise plan details from catalog'
            }
          }
        },
        ChatMessageRequest: {
          type: 'object',
          required: ['message'],
          properties: {
            message: {
              type: 'string',
              minLength: 1,
              maxLength: 2000,
              description: 'The user message to the AI sales agent',
              example: 'What does the Enterprise plan cost and what features does it include?'
            }
          }
        },
        ChatMessageResponse: {
          type: 'object',
          properties: {
            response: {
              type: 'string',
              description: 'The AI agent response',
              example: 'The Enterprise plan costs $499/month ($4,790/year) and includes unlimited users, SSO, audit logs, SLA 99.9%, dedicated support, unlimited storage, and custom contracts.'
            },
            eval: {
              $ref: '#/components/schemas/EvaluationScores'
            },
            tools_called: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'List of tools invoked during processing',
              example: ['get_user_memory', 'search_catalog']
            },
            session_id: {
              type: 'string',
              format: 'uuid',
              description: 'Unique session identifier for this conversation',
              example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
            }
          }
        },
        ConversationTurn: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            session_id: {
              type: 'string',
              format: 'uuid'
            },
            role: {
              type: 'string',
              enum: ['user', 'assistant']
            },
            content: {
              type: 'string'
            },
            tools_called: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        ConversationHistoryResponse: {
          type: 'object',
          properties: {
            user_id: {
              type: 'string'
            },
            turns: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/ConversationTurn'
              }
            },
            total: {
              type: 'integer',
              example: 4
            }
          }
        },
        EvalSummary: {
          type: 'object',
          properties: {
            totalResponses: {
              type: 'integer',
              example: 5
            },
            avgConfidence: {
              type: 'number',
              format: 'float',
              example: 0.92
            },
            avgGroundedness: {
              type: 'number',
              format: 'float',
              example: 0.91
            },
            avgRelevance: {
              type: 'number',
              format: 'float',
              example: 0.94
            },
            flaggedCount: {
              type: 'integer',
              example: 0
            },
            flaggedPercentage: {
              type: 'number',
              format: 'float',
              example: 0
            }
          }
        },
        EvalLogEntry: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            sessionId: {
              type: 'string'
            },
            groundedness: {
              type: 'number'
            },
            relevance: {
              type: 'number'
            },
            confidence: {
              type: 'number'
            },
            flagged: {
              type: 'boolean'
            },
            reasoning: {
              type: 'string'
            },
            toolsCalled: {
              type: 'array',
              items: {
                type: 'string'
              }
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      }
    }
  },
  apis: [
    './src/api/routes/*.js',
    './src/config/swagger-paths.js'
  ]
};

const specs = swaggerJsdoc(swaggerOptions);

module.exports = specs;
