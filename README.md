# Sales Agent API

A production-ready Persistent Sales Assistant Agent API built with Node.js, Express, Sequelize, PostgreSQL, and Groq LLM.

## Table of Contents

1. [Architecture Diagram](#1-architecture-diagram)
2. [Memory Design Decision](#2-memory-design-decision)
3. [Eval Design](#3-eval-design)
4. [API Usage Examples](#4-api-usage-examples)
5. [Setup & Deployment](#5-setup--deployment)

---

## 1. Architecture Diagram

```
POST /chat/:userId
      │
      ▼
  requestLogger middleware (attaches requestId)
      │
      ▼
  validate middleware (Joi schema check)
      │
      ▼
  chat.routes.js
      │
      ▼
  chat.service.js
      │
      ├──► memoryStore.saveMessage()         ──► PostgreSQL (Conversation table)
      │
      ▼
  salesAgent.js (Groq agent loop)
      │
      ├──► [Tool Call] get_user_memory()     ──► PostgreSQL (MemoryFact + Conversation)
      ├──► [Tool Call] search_catalog()      ──► catalog.json keyword search
      │                  (loops until no more tool calls)
      │
      ▼
  Final text response from Groq
      │
      ▼
  chat.service.js (continued)
      │
      ├──► memoryStore.saveMessage()         ──► PostgreSQL (saves assistant turn)
      ├──► memoryStore.saveFact()            ──► PostgreSQL (extracts + saves user facts)
      │
      ▼
  eval.service.js
      │
      ├──► evalLogic.js (2nd Groq call)      ──► Self-scoring JSON response
      ├──► EvalLog.create()                  ──► PostgreSQL (eval_logs table)
      └──► if flagged: flagForHuman()        ──► Winston warn log + EvalLog flag
      │
      ▼
  JSON Response: { response, eval, tools_called, session_id }
```

### Key Architectural Decisions

- **Layered Architecture**: Clear separation between routes, services, agents, tools, and memory layers
- **Tool-Based Agent**: Uses Groq's function calling for deterministic tool execution rather than prompt engineering
- **Stateless Sessions**: Each API call creates a new session ID, demonstrating how to track across sessions while maintaining persistence
- **Middleware Pipeline**: Request logging, validation, and error handling handled consistently

---

## 2. Memory Design Decision

### Why Sequelize + PostgreSQL?

We chose **Sequelize ORM with PostgreSQL** as our memory backend for several strategic reasons:

1. **Production-Standard**: PostgreSQL is battle-tested, ACID-compliant, and scales well
2. **Railway-Friendly**: Railway provides managed PostgreSQL with zero-config SSL
3. **Abstraction Layer**: The `IMemoryStore` abstract base class means the entire backing store is swappable by changing one file (`src/memory/index.js`) and one environment variable

### Data Model

We maintain **three separate tables** to keep concerns clean:

#### `conversations` Table
- Raw conversation turns between users and assistant
- Stores role (user/assistant), content, tools called, timestamps
- Ordered by `createdAt` for chronological reconstruction

#### `memory_facts` Table
- Extracted durable facts about users (e.g., "Interested in Enterprise plan")
- Survives conversation deletion (business intelligence layer)
- Enables personalization across sessions

#### `eval_logs` Table
- Quality metrics for every response
- Tracks groundedness, relevance, confidence scores
- Powers the `/evals` endpoints for monitoring

### Extensibility

To swap to Redis or Mem0:

```javascript
// src/memory/index.js
switch (config.memoryBackend) {
  case 'redis':
    return new RedisMemoryStore();
  case 'mem0':
    return new Mem0MemoryStore();
  default:
    return new SequelizeMemoryStore();
}
```

### At Scale

For high-volume deployments, we would:

1. **Add pgvector extension** for semantic similarity search over memory facts
2. **Implement automatic summarization** after every N turns to keep context windows manageable
3. **Migrate to Mem0** for managed agent memory with automatic RAG and entity extraction
4. **Add Redis cache layer** for frequently accessed recent context

---

## 3. Eval Design

### The Second LLM Pattern

We implement a **second Groq LLM call** that acts as a strict quality evaluator. This pattern catches issues that static rules cannot.

### Evaluation Criteria

Each response is scored on three dimensions:

| Metric | Range | Purpose |
|--------|-------|---------|
| **Groundedness** | 0.0 - 1.0 | Did the response use actual catalog data? Catches hallucinations. |
| **Relevance** | 0.0 - 1.0 | Did it directly answer what was asked? Catches off-topic responses. |
| **Confidence** | 0.0 - 1.0 | Overall quality considering tone, specificity, completeness. |

### Auto-Flagging Rules

Responses are automatically flagged for human review if:
- Confidence < 0.70, OR
- Groundedness < 0.60

This threshold is enforced both by the eval LLM and programmatically in `validateEvalResult()`.

### Eval LLM Prompt Structure

```javascript
{
  role: 'system',
  content: `You are a strict quality evaluator...
  Return ONLY valid JSON:
  {
    "groundedness": <0.0-1.0>,
    "relevance": <0.0-1.0>,
    "confidence": <0.0-1.0>,
    "flagged": <boolean>,
    "reasoning": "<explanation>"
  }`
}
```

### Fallback Handling

If the eval LLM returns malformed JSON or fails entirely, we return a structured fallback:

```javascript
{
  groundedness: 0.5,
  relevance: 0.5,
  confidence: 0.5,
  flagged: true,
  reasoning: 'Eval parse failed'
}
```

**Critical Rule**: The eval block is never omitted, even on failure.

### Known Limitations

1. **Same-Model Bias**: Llama-3.3 evaluating Llama-3.3 cannot catch confident hallucinations that both models share
2. **Latency Cost**: Every chat request triggers 2 LLM calls (response + eval)
3. **Prompt Brittleness**: JSON-only prompts occasionally fail with markdown formatting

### Improvements at Scale

1. **Cross-Model Judge**: Use Gemini or GPT-4 to evaluate Groq responses
2. **Retrieval-Based Groundedness**: Verify every claim exists in catalog.json using embeddings
3. **Trend Tracking**: Monitor eval score distributions over time to detect model drift
4. **Human-in-the-Loop**: Feed flagged responses back into fine-tuning dataset

---

## 4. API Usage Examples

### Prerequisites

Ensure you have set the `GROQ_API_KEY` environment variable with a valid Groq API key.

### Example 1: First Conversation (Session 1)

Ask about Enterprise pricing:

```bash
curl -X POST http://localhost:3000/api/v1/chat/user_demo_001 \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: session-1-req-1" \
  -d '{"message": "What does the Enterprise plan cost and what features does it include?"}'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "response": "The Enterprise plan costs $499/month ($4,790/year) and includes unlimited users, SSO, audit logs, SLA 99.9%, dedicated support, unlimited storage, and custom contracts. It's designed for large organizations needing compliance and scale.",
    "eval": {
      "groundedness": 0.95,
      "relevance": 0.98,
      "confidence": 0.96,
      "flagged": false,
      "reasoning": "Response accurately cited all Enterprise plan details from catalog"
    },
    "tools_called": ["get_user_memory", "search_catalog"],
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

### Example 2: Follow-Up Question (Session 2)

Same user, new session. The agent should remember the previous conversation:

```bash
curl -X POST http://localhost:3000/api/v1/chat/user_demo_001 \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: session-2-req-1" \
  -d '{"message": "Does the plan we talked about include SSO? Also what about audit logs?"}'
```

**Expected Response:**

The agent will:
1. Call `get_user_memory` to discover "Interested in Enterprise plan"
2. Reference the Enterprise plan contextually
3. Confirm both SSO and audit logs are included

```json
{
  "success": true,
  "data": {
    "response": "Yes! Based on your interest in the Enterprise plan we discussed earlier, it definitely includes SSO (Single Sign-On) and audit logs. Those are core features of the Enterprise tier along with unlimited users and dedicated support.",
    "eval": {
      "groundedness": 0.94,
      "relevance": 0.97,
      "confidence": 0.93,
      "flagged": false,
      "reasoning": "Leveraged memory effectively to provide contextual response"
    },
    "tools_called": ["get_user_memory", "search_catalog"],
    "session_id": "b2c3d4e5-f6a7-8901-bcde-f23456789012"
  }
}
```

### Example 3: View Conversation History

```bash
curl http://localhost:3000/api/v1/chat/user_demo_001/history
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "user_id": "user_demo_001",
    "turns": [
      {
        "id": "conv-uuid-1",
        "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "role": "user",
        "content": "What does the Enterprise plan cost...",
        "tools_called": [],
        "created_at": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "conv-uuid-2",
        "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "role": "assistant",
        "content": "The Enterprise plan costs $499/month...",
        "tools_called": ["get_user_memory", "search_catalog"],
        "created_at": "2024-01-15T10:30:02.000Z"
      }
    ],
    "total": 4
  }
}
```

### Example 4: Check Evaluation Statistics

```bash
curl http://localhost:3000/api/v1/chat/user_demo_001/evals
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalResponses": 2,
      "avgConfidence": 0.945,
      "avgGroundedness": 0.945,
      "avgRelevance": 0.975,
      "flaggedCount": 0,
      "flaggedPercentage": 0
    },
    "evals": [
      {
        "id": "eval-uuid-1",
        "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "groundedness": 0.95,
        "relevance": 0.98,
        "confidence": 0.96,
        "flagged": false,
        "reasoning": "Response accurately cited all Enterprise plan details from catalog",
        "toolsCalled": ["get_user_memory", "search_catalog"],
        "createdAt": "2024-01-15T10:30:03.000Z"
      }
    ]
  }
}
```

### Example 5: GDPR-Compliant Memory Deletion

```bash
curl -X DELETE http://localhost:3000/api/v1/chat/user_demo_001/memory
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Memory wiped for user user_demo_001"
  }
}
```

This deletes:
- All conversation history
- All extracted memory facts
- All evaluation logs

### Example 6: Health Check

```bash
curl http://localhost:3000/api/v1/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "version": "1.0.0",
  "db": "connected",
  "environment": "development"
}
```

---

## 5. Setup & Deployment

### Local Development

1. **Clone and install:**

```bash
git clone <repo-url>
cd sales-agent-api
npm install
```

2. **Configure environment:**

```bash
cp .env.example .env
# Edit .env with your values:
# - GROQ_API_KEY (required)
# - DATABASE_URL (required)
```

3. **Start PostgreSQL (using Docker Compose):**

```bash
docker-compose up -d db
```

4. **Run migrations (optional - sync runs automatically):**

```bash
npm run db:migrate
```

5. **Start development server:**

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm test -- --coverage
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GROQ_API_KEY` | Yes | - | Groq API key for LLM access |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | Environment (development/production/test) |
| `MEMORY_BACKEND` | No | sequelize | Memory store implementation |
| `LOG_LEVEL` | No | info | Winston log level |

### Production Deployment

#### Railway Deployment

1. **Push to GitHub:**

```bash
git init
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Connect to Railway:**
- Go to [railway.app](https://railway.app)
- Create New Project → Deploy from GitHub repo
- Select your repository

3. **Add environment variables:**
- `GROQ_API_KEY` - Your Groq API key
- `DATABASE_URL` - Railway will auto-generate if you add a PostgreSQL addon
- `NODE_ENV` - Set to `production`

4. **Deploy:**
Railway auto-detects the `Dockerfile` and deploys.

5. **Verify:**

```bash
curl https://YOUR-APP.railway.app/api/v1/health
```

#### Manual Docker Deployment

```bash
# Build image
docker build -t sales-agent-api .

# Run container
docker run -p 3000:3000 \
  -e GROQ_API_KEY=your_key \
  -e DATABASE_URL=your_db_url \
  -e NODE_ENV=production \
  sales-agent-api
```

### Database Migrations (Production)

For production environments, disable `sync({ alter: true })` and use migrations:

1. **Generate migration:**

```bash
npx sequelize-cli migration:generate --name create-conversations
```

2. **Run migrations:**

```bash
npm run db:migrate
```

3. **Rollback:**

```bash
npm run db:migrate:undo
```

### Monitoring & Observability

- **Logs**: Winston writes JSON logs to `logs/` directory in production
- **Health**: `/api/v1/health` endpoint for load balancer health checks
- **Metrics**: Eval stats available at `/api/v1/evals/global/stats`
- **Request Tracing**: All requests logged with unique `X-Request-Id` header

### Security Considerations

1. **Never commit `.env` files** - Use Railway dashboard or secrets manager
2. **Enable SSL** - Database connections use SSL in production
3. **Rate limiting** - Add `express-rate-limit` middleware for production
4. **Input validation** - All inputs validated with Joi schemas
5. **No stack traces** - Error responses exclude stack traces in production

---

## Project Structure

```
sales-agent-api/
├── src/
│   ├── api/
│   │   ├── routes/           # Express route handlers
│   │   │   ├── chat.routes.js
│   │   │   ├── catalog.routes.js
│   │   │   ├── health.routes.js
│   │   │   └── evals.routes.js
│   │   └── middlewares/      # Express middlewares
│   │       ├── errorHandler.js
│   │       ├── requestLogger.js
│   │       └── validate.js
│   ├── agents/               # AI agent logic
│   │   ├── salesAgent.js     # Main agent loop
│   │   ├── toolRegistry.js   # Tool definitions & handlers
│   │   └── evalLogic.js      # Self-evaluation logic
│   ├── tools/                # Tool implementations
│   │   ├── searchCatalog.tool.js
│   │   ├── getUserMemory.tool.js
│   │   └── flagForHuman.tool.js
│   ├── services/             # Business logic layer
│   │   ├── chat.service.js
│   │   └── eval.service.js
│   ├── memory/               # Memory abstraction
│   │   ├── IMemoryStore.js   # Abstract interface
│   │   ├── sequelizeMemory.js
│   │   └── index.js          # Factory
│   ├── db/
│   │   ├── models/           # Sequelize models
│   │   │   ├── index.js
│   │   │   ├── Conversation.js
│   │   │   ├── MemoryFact.js
│   │   │   └── EvalLog.js
│   │   └── migrations/       # Sequelize migrations
│   └── config/               # Configuration
│       ├── env.js
│       ├── database.js
│       ├── logger.js
│       └── catalog.json
├── tests/                    # Jest test suites
├── server.js                 # Entry point
├── Dockerfile
├── docker-compose.yml
├── .sequelizerc
├── railway.toml
└── package.json
```

---

## License

MIT

## Support

For issues or questions, please open a GitHub issue or contact the development team.
