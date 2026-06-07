# Architecture Documentation

This document provides a deep dive into the architecture and design decisions of the Sales Agent API.

## Overview

The Sales Agent API is a production-ready conversational AI system that combines:
- **Groq LLM** (`llama-3.3-70b-versatile`) for natural language processing
- **Tool Use Pattern** for deterministic function calling
- **Persistent Memory** via PostgreSQL and Sequelize ORM
- **Self-Evaluation** through a secondary LLM call
- **GDPR Compliance** with complete data deletion

## System Components

### 1. Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Request                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Express Middleware Stack                                        │
│  ├─ requestLogger (generates UUID, logs request)                │
│  ├─ express.json (body parsing)                                 │
│  ├─ cors (cross-origin headers)                                 │
│  └─ validate (Joi schema validation)                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Route Handlers                                                  │
│  ├─ /api/v1/chat/:userId (POST/GET/DELETE)                      │
│  ├─ /api/v1/catalog (GET)                                       │
│  ├─ /api/v1/health (GET)                                        │
│  └─ /api/v1/evals/* (GET)                                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Service Layer                                                   │
│  ├─ chat.service.js (orchestrates chat flow)                    │
│  └─ eval.service.js (manages evaluations)                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent Layer                                                     │
│  ├─ salesAgent.js (main agent loop with tool use)               │
│  ├─ evalLogic.js (self-scoring evaluator)                       │
│  └─ toolRegistry.js (tool definitions)                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Tool Layer                                                      │
│  ├─ searchCatalog.tool.js (product search)                      │
│  ├─ getUserMemory.tool.js (retrieve user history)               │
│  └─ flagForHuman.tool.js (escalation)                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Memory Layer                                                    │
│  ├─ IMemoryStore.js (abstract interface)                        │
│  ├─ sequelizeMemory.js (PostgreSQL impl)                        │
│  └─ index.js (factory)                                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│  Data Layer (PostgreSQL)                                         │
│  ├─ conversations (chat history)                                │
│  ├─ memory_facts (extracted user facts)                         │
│  └─ eval_logs (quality metrics)                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Agent Loop Detail

The agent uses a tool-calling pattern that enables the LLM to:

1. **Retrieve Context**: Always fetch user memory first
2. **Search Knowledge**: Query catalog before answering product questions
3. **Generate Response**: Use retrieved data to formulate answer
4. **Self-Correct**: Continue calling tools until satisfied

```javascript
while (hasToolCalls && iterations < MAX_ITERATIONS) {
  const completion = await groq.chat.completions.create({
    messages,
    tools: TOOL_DEFINITIONS,
    tool_choice: 'auto'
  });
  
  if (completion.tool_calls) {
    // Execute each tool and append results
    for (const toolCall of completion.tool_calls) {
      const result = await TOOL_HANDLERS[toolCall.name](args);
      messages.push({ role: 'tool', content: JSON.stringify(result) });
    }
  } else {
    // Final response
    return completion.content;
  }
}
```

### 3. Memory Strategy

We use a dual-table approach:

#### Conversations Table
- Stores raw conversation turns
- Immutable audit trail
- Ordered chronologically
- Used for context retrieval

#### MemoryFacts Table
- Stores extracted semantic facts
- Derived from conversation analysis
- Enables personalization across sessions
- Survives conversation deletion

Example fact extraction:
```
User: "My team of 50 needs SSO and audit logs"
→ Fact: "User has team of 50 people"
→ Fact: "User requires SSO"
→ Fact: "User interested in audit logs"
→ Implied: "User suitable for Enterprise plan"
```

### 4. Evaluation System

Every response receives a quality score from a second LLM call:

```
User Message → Agent Response → Evaluator LLM → Scores
                                    ↓
                              ┌─────────────┐
                              │ Groundedness│ (uses catalog data?)
                              │ Relevance   │ (answers question?)
                              │ Confidence  │ (overall quality)
                              └─────────────┘
```

Auto-flagging thresholds:
- Confidence < 0.70 → Flagged
- Groundedness < 0.60 → Flagged

### 5. Error Handling Strategy

All errors flow through a centralized error handler:

| Error Type | Status Code | Log Level | User Message |
|------------|-------------|-----------|--------------|
| ValidationError | 400 | warn | Generic validation message |
| SequelizeValidationError | 400 | warn | Field-specific errors |
| NotFoundError | 404 | warn | Resource not found |
| Database Error | 500 | error | Internal server error |
| Groq API Error | 502 | error | Service temporarily unavailable |

Stack traces are only included in development environment.

## Data Models

### Conversation Schema
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  session_id UUID NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content TEXT NOT NULL,
  tools_called VARCHAR(100)[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
```

### MemoryFact Schema
```sql
CREATE TABLE memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  fact TEXT NOT NULL,
  source_session_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_memory_facts_user_id ON memory_facts(user_id);
```

### EvalLog Schema
```sql
CREATE TABLE eval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  groundedness FLOAT CHECK (groundedness BETWEEN 0 AND 1),
  relevance FLOAT CHECK (relevance BETWEEN 0 AND 1),
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  flagged BOOLEAN DEFAULT FALSE,
  reasoning TEXT NOT NULL,
  tools_called VARCHAR(100)[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_eval_logs_user_id ON eval_logs(user_id);
CREATE INDEX idx_eval_logs_flagged ON eval_logs(flagged) WHERE flagged = TRUE;
```

## Security Considerations

### 1. Input Validation
- All inputs validated with Joi schemas
- SQL injection prevented via Sequelize parameterized queries
- XSS protection through JSON-only responses

### 2. Authentication/Authorization
Currently uses simple user ID parameter. For production:
- Add JWT authentication middleware
- Verify user ownership of resources
- Rate limiting per user/API key

### 3. Data Protection
- All user data encrypted at rest (via PostgreSQL)
- SSL enforced for database connections
- Environment variables for secrets (never hardcoded)
- Complete data deletion endpoint for GDPR

### 4. Logging
- No PII logged (user IDs anonymized in logs)
- Structured JSON logs for easy parsing
- Separate error and combined log files

## Performance Optimizations

### Current
- Database indexes on user_id and created_at
- LIMIT clauses for recent context retrieval
- Raw Sequelize queries for performance

### Future Improvements
1. **Redis Cache**: Cache recent user context
2. **Connection Pooling**: Optimize database connections
3. **Rate Limiting**: Prevent abuse
4. **Streaming**: Stream responses for better UX
5. **pgvector**: Semantic search for memory facts

## Scaling Considerations

### Horizontal Scaling
- Stateless application (no session affinity)
- Database connection pooling
- Load balancer health checks via /health endpoint

### Vertical Scaling
- More powerful LLM models for complex queries
- Larger context windows
- Faster inference providers

### Database Scaling
- Read replicas for history queries
- Sharding by user_id hash
- Time-series partitioning for eval_logs

## Monitoring & Alerting

### Metrics to Track
- Response latency (p50, p95, p99)
- LLM token usage and costs
- Evaluation scores distribution
- Error rates by type
- Database connection pool utilization

### Alerts
- Error rate > 1%
- P95 latency > 5s
- Database connection failures
- LLM API errors
- Flagged response rate > 10%

## Testing Strategy

### Unit Tests
- Individual tool functions
- Service layer business logic
- Memory store operations

### Integration Tests
- API endpoint behavior
- Database interactions
- LLM mocking for deterministic tests

### Load Tests
- Concurrent user simulation
- Database connection limits
- Memory usage profiling

## Future Enhancements

1. **Multi-turn Sessions**: WebSocket support for streaming
2. **Advanced Memory**: Summarization and embedding-based retrieval
3. **A/B Testing**: Different prompts/system instructions
4. **Feedback Loop**: User thumbs up/down for continuous improvement
5. **Multi-language**: i18n support for international markets
6. **Voice Integration**: Speech-to-text and text-to-speech
7. **Analytics Dashboard**: Real-time monitoring UI

## References

- [Groq API Documentation](https://console.groq.com/docs)
- [Sequelize ORM Documentation](https://sequelize.org/docs/v6/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
