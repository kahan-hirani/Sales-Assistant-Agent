# Sales Agent API 🤖

[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)
[![Groq](https://img.shields.io/badge/Groq-API-orange.svg)](https://groq.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A **production-ready Persistent Sales Assistant Agent API** built with Node.js, Express, Sequelize ORM, PostgreSQL, and Groq LLM. This intelligent conversational AI helps prospects understand product plans and pricing while maintaining persistent memory across sessions.

## 📖 Table of Contents

1. [Project Overview](#project-overview)
2. [Key Features](#key-features)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Database Schema](#database-schema)
6. [API Documentation](#api-documentation)
7. [Quick Start](#quick-start)
8. [Configuration](#configuration)
9. [Deployment](#deployment)
10. [Monitoring](#monitoring)
11. [Contributing](#contributing)

---

## 🎯 Project Overview

The **Sales Agent API** is an intelligent conversational AI system designed to act as a virtual sales representative for SaaS products. Unlike simple chatbots, this system:

- **Remembers conversations** across sessions using persistent PostgreSQL storage
- **Uses real tools** to search product catalogs and retrieve user history
- **Self-evaluates** every response for quality and accuracy
- **Escalates** uncertain cases to human reviewers
- **Supports GDPR compliance** with complete data deletion capabilities

### Use Cases

- 🤝 **Lead Qualification**: Automatically answer pricing and feature questions
- 💬 **Customer Support**: Handle repetitive sales inquiries 24/7
- 📊 **Analytics**: Track response quality and user satisfaction
- 🔒 **Compliance**: GDPR-ready with full audit trails

---

## ✨ Key Features

### 🤖 AI Capabilities
- **Multi-tool agent**: Uses `get_user_memory`, `search_catalog`, and `flag_for_human` tools
- **Context-aware**: References previous conversations automatically
- **Fact extraction**: Identifies user preferences and saves them as durable facts
- **Self-healing**: Falls back to predefined responses if LLM fails

### 💾 Persistence
- **PostgreSQL storage**: All conversations, facts, and evaluations stored
- **Session tracking**: Unique session IDs per conversation for audit trails
- **Memory abstraction**: Swappable backend (easy to switch to Redis/Mem0)

### 📊 Quality Assurance
- **Dual LLM pattern**: Primary response + secondary evaluation LLM
- **Three-dimension scoring**: Groundedness, Relevance, Confidence (0-1 scale)
- **Auto-flagging**: Low-quality responses escalated automatically
- **No silent failures**: Every response includes eval block

### 🛡️ Production Ready
- **Structured logging**: Winston with JSON format and correlation IDs
- **Input validation**: Joi schemas for all endpoints
- **Error handling**: Centralized error handler with proper HTTP codes
- **Docker support**: Containerized with docker-compose for easy local dev
- **Health checks**: `/health` endpoint for monitoring

---

## 🏗️ Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+ | JavaScript runtime |
| **Framework** | Express.js 4.x | Web framework |
| **LLM** | Groq (llama-3.3-70b-versatile) | AI model inference |
| **Database** | PostgreSQL 15+ | Persistent storage |
| **ORM** | Sequelize 6.x | Database abstraction |
| **Validation** | Joi 17.x | Input validation |
| **Logging** | Winston 3.x | Structured logging |
| **Testing** | Jest 29.x | Unit testing |
| **Container** | Docker + Docker Compose | Deployment |
| **Platform** | Railway | Cloud hosting |

---

## 🏛️ System Architecture

### High-Level Flow

```
┌─────────────┐     POST /chat/:userId      ┌─────────────────┐
│   Client    │ ───────────────────────────→ │  Load Balancer  │
└─────────────┘                              └────────┬────────┘
                                                       │
                                 ┌─────────────────────┼─────────────────────┐
                                 │                     │                     │
                                 ▼                     ▼                     ▼
                         ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
                         │    Health    │    │   Catalog    │    │   Chat API   │
                         │   Check      │    │   Endpoint   │    │              │
                         └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                        │
                                                                        ▼
                                                          ┌──────────────────────┐
                                                          │  Express Middleware  │
                                                          │  - requestLogger     │
                                                          │  - validate (Joi)    │
                                                          └──────────┬───────────┘
                                                                     │
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │   chat.service.js    │
                                                          │  - Orchestrates flow │
                                                          └──────────┬───────────┘
                                                                     │
                                     ┌───────────────────────────────┼───────────────────────────────┐
                                     │                               │                               │
                                     ▼                               ▼                               ▼
                          ┌─────────────────┐            ┌─────────────────┐            ┌─────────────────┐
                          │  salesAgent.js  │            │  memoryStore    │            │  eval.service   │
                          │  - Gets user    │            │  - Saves msgs   │            │  - Quality      │
                          │    memory       │            │  - Extracts     │            │    evaluation   │
                          │  - Searches     │            │    facts        │            │  - Flags low    │
                          │    catalog      │            │  - PostgreSQL   │            │    quality      │
                          │  - Generates    │            │                 │            │                 │
                          │    response     │            │                 │            │                 │
                          └─────────────────┘            └─────────────────┘            └─────────────────┘
```

### Request Lifecycle

```
POST /chat/:userId
      │
      ▼
  [RequestLogger] → Generate UUID, log incoming request
      │
      ▼
  [Validate Middleware] → Joi schema validation
      │
      ▼
  [Chat Service]
      │
      ├──► Call Agent → Get response from Groq LLM
      │       │
      │       ├──► Call get_user_memory → Fetch user history
      │       ├──► Call search_catalog → Search product catalog
      │       └──► Generate response
      │
      ├──► Save Messages → PostgreSQL (paired user+assistant)
      ├──► Extract Facts → Identify user preferences
      │
      ▼
  [Eval Service]
      │
      ├──► Secondary LLM call → Evaluate quality
      ├──► Save Eval → eval_logs table
      └──► Flag if needed → Escalate to human
      │
      ▼
  JSON Response: { response, eval, tools_called, session_id }
```

---

## 🗄️ Database Schema

### Entity Relationship Diagram

```
┌─────────────────────┐         ┌─────────────────────┐         ┌─────────────────────┐
│    conversations    │         │    memory_facts     │         │      eval_logs      │
├─────────────────────┤         ├─────────────────────┤         ├─────────────────────┤
│ PK: id (UUID)       │         │ PK: id (UUID)       │         │ PK: id (UUID)       │
│ FK: user_id (str)   │         │ FK: user_id (str)   │         │ FK: user_id (str)   │
│ session_id (UUID)   │         │ fact (text)         │         │ session_id (str)    │
│ role (enum)         │         │ source_session_id   │         │ groundedness (float)│
│ content (text)      │         │ created_at          │         │ relevance (float)   │
│ tools_called (arr)  │         │ updated_at          │         │ confidence (float)  │
│ created_at          │         └─────────────────────┘         │ flagged (bool)      │
│ updated_at          │                                         │ reasoning (text)    │
└─────────────────────┘                                         │ tools_called (arr)  │
                                                                 │ created_at          │
                                                                 │ updated_at          │
                                                                 └─────────────────────┘
```

### Detailed Table Specifications

#### 1. `conversations` Table

Stores all conversation turns between users and the AI assistant.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-gen | Unique conversation turn ID |
| `user_id` | VARCHAR(255) | NOT NULL, INDEX | User identifier |
| `session_id` | UUID | NOT NULL | Conversation session ID |
| `role` | ENUM('user', 'assistant') | NOT NULL | Speaker role |
| `content` | TEXT | NOT NULL | Message content |
| `tools_called` | ARRAY(VARCHAR) | DEFAULT [] | Tools invoked |
| `created_at` | TIMESTAMP | NOT NULL | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last update time |

**Indexes:**
```sql
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at);
```

**Sample Data:**
```json
{
  "id": "8a573e8e-cc9c-4340-99fe-7a8c792602e4",
  "user_id": "test_user_1780810030572",
  "session_id": "a4321c81-c444-4be5-8941-34d67e5cb6a6",
  "role": "assistant",
  "content": "The Enterprise plan costs $499/month...",
  "tools_called": ["get_user_memory", "search_catalog"],
  "created_at": "2026-06-07T05:39:30.795Z",
  "updated_at": "2026-06-07T05:39:30.795Z"
}
```

#### 2. `memory_facts` Table

Stores extracted durable facts about users for personalization.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-gen | Unique fact ID |
| `user_id` | VARCHAR(255) | NOT NULL, INDEX | User identifier |
| `fact` | TEXT | NOT NULL | Extracted fact sentence |
| `source_session_id` | VARCHAR(255) | NULL | Where fact was extracted |
| `created_at` | TIMESTAMP | NOT NULL | Creation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last update time |

**Indexes:**
```sql
CREATE INDEX idx_memory_facts_user_id ON memory_facts(user_id);
```

**Sample Data:**
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user_id": "test_user_1780810030572",
  "fact": "User showed interest in Enterprise plan",
  "source_session_id": "a4321c81-c444-4be5-8941-34d67e5cb6a6",
  "created_at": "2026-06-07T05:39:31.000Z"
}
```

#### 3. `eval_logs` Table

Stores quality evaluation scores for every AI response.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-gen | Unique evaluation ID |
| `user_id` | VARCHAR(255) | NOT NULL, INDEX | User identifier |
| `session_id` | VARCHAR(255) | NOT NULL | Session ID |
| `groundedness` | FLOAT(0-1) | NOT NULL | Uses catalog data? |
| `relevance` | FLOAT(0-1) | NOT NULL | Answers question? |
| `confidence` | FLOAT(0-1) | NOT NULL | Overall quality |
| `flagged` | BOOLEAN | DEFAULT false | Needs human review |
| `reasoning` | TEXT | NOT NULL | Explanation of scores |
| `tools_called` | ARRAY(VARCHAR) | DEFAULT [] | Tools used |
| `created_at` | TIMESTAMP | NOT NULL | Evaluation time |
| `updated_at` | TIMESTAMP | NOT NULL | Last update |

**Indexes:**
```sql
CREATE INDEX idx_eval_logs_user_id ON eval_logs(user_id);
CREATE INDEX idx_eval_logs_flagged ON eval_logs(flagged) WHERE flagged = true;
CREATE INDEX idx_eval_logs_created_at ON eval_logs(created_at);
```

**Sample Data:**
```json
{
  "id": "e22f8c33-8e56-4e5c-9e56-fb3a6f1c09f2",
  "user_id": "test_user_1780810030572",
  "session_id": "a4321c81-c444-4be5-8941-34d67e5cb6a6",
  "groundedness": 0.95,
  "relevance": 0.98,
  "confidence": 0.96,
  "flagged": false,
  "reasoning": "Response accurately cited all Enterprise plan details",
  "tools_called": ["get_user_memory", "search_catalog"],
  "created_at": "2026-06-07T05:39:31.200Z"
}
```

### SQL Schema (for reference)

```sql
-- Create enum type for conversation roles
CREATE TYPE enum_conversations_role AS ENUM ('user', 'assistant');

-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  session_id UUID NOT NULL,
  role enum_conversations_role NOT NULL,
  content TEXT NOT NULL,
  tools_called VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Memory facts table
CREATE TABLE memory_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  fact TEXT NOT NULL,
  source_session_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Evaluation logs table
CREATE TABLE eval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  groundedness FLOAT NOT NULL CHECK (groundedness >= 0 AND groundedness <= 1),
  relevance FLOAT NOT NULL CHECK (relevance >= 0 AND relevance <= 1),
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  flagged BOOLEAN DEFAULT false,
  reasoning TEXT NOT NULL,
  tools_called VARCHAR(255)[] DEFAULT ARRAY[]::VARCHAR[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_memory_facts_user_id ON memory_facts(user_id);
CREATE INDEX idx_eval_logs_user_id ON eval_logs(user_id);
CREATE INDEX idx_eval_logs_flagged ON eval_logs(flagged) WHERE flagged = true;
```

---

## 📚 API Documentation

### Base URL
- **Local:** `http://localhost:3000/api/v1`
- **Production:** `https://your-app.railway.app/api/v1`

### Response Format
All responses follow this envelope structure:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "message": "Description of error",
    "code": "ERROR_CODE",
    "details": [ ... ] // Optional
  }
}
```

### Endpoints

#### 1. Health Check
Check API and database status.

```http
GET /health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "version": "1.0.0",
  "db": "connected",
  "environment": "development"
}
```

#### 2. Send Chat Message
Send a message to the AI sales agent.

```http
POST /chat/:userId
Content-Type: application/json

{
  "message": "What does the Enterprise plan cost?"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "response": "The Enterprise plan costs $499/month...",
    "eval": {
      "groundedness": 0.95,
      "relevance": 0.98,
      "confidence": 0.96,
      "flagged": false,
      "reasoning": "Accurate citation of catalog data"
    },
    "tools_called": ["get_user_memory", "search_catalog"],
    "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }
}
```

#### 3. Get Conversation History
Retrieve all conversations for a user.

```http
GET /chat/:userId/history
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user_id": "user_demo_001",
    "turns": [
      {
        "id": "uuid-1",
        "session_id": "session-uuid",
        "role": "user",
        "content": "What is Enterprise pricing?",
        "tools_called": [],
        "created_at": "2024-01-15T10:30:00.000Z"
      },
      {
        "id": "uuid-2",
        "session_id": "session-uuid",
        "role": "assistant",
        "content": "Enterprise is $499/month...",
        "tools_called": ["get_user_memory", "search_catalog"],
        "created_at": "2024-01-15T10:30:02.000Z"
      }
    ],
    "total": 2
  }
}
```

#### 4. Get User Evaluations
Get quality metrics for a user's conversations.

```http
GET /chat/:userId/evals
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalResponses": 5,
      "avgConfidence": 0.92,
      "avgGroundedness": 0.90,
      "avgRelevance": 0.94,
      "flaggedCount": 0,
      "flaggedPercentage": 0
    },
    "evals": [
      {
        "id": "eval-uuid",
        "sessionId": "session-uuid",
        "groundedness": 0.95,
        "relevance": 0.98,
        "confidence": 0.96,
        "flagged": false,
        "reasoning": "Accurate response",
        "toolsCalled": ["search_catalog"],
        "createdAt": "2024-01-15T10:30:03.000Z"
      }
    ]
  }
}
```

#### 5. Delete User Memory (GDPR)
Delete all data for a user.

```http
DELETE /chat/:userId/memory
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Memory wiped for user user_demo_001"
  }
}
```

#### 6. Get Product Catalog
Retrieve product information.

```http
GET /catalog
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "addons": [...],
    "faq": [...]
  }
}
```

#### 7. Get Global Stats
Get system-wide evaluation statistics.

```http
GET /evals/global/stats
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalEvals": 100,
      "avgConfidence": 0.91,
      "avgGroundedness": 0.89,
      "avgRelevance": 0.93,
      "flaggedCount": 5,
      "flaggedPercentage": 5
    }
  }
}
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or Docker)
- Groq API key ([Get one here](https://console.groq.com/keys))

### 1. Clone Repository
```bash
git clone <repository-url>
cd sales-agent-api
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
```

Edit `.env`:
```env
# Server
PORT=3000
NODE_ENV=development

# Groq LLM
GROQ_API_KEY=gsk_your_groq_api_key_here

# PostgreSQL (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sales_agent_db

# Memory backend
MEMORY_BACKEND=sequelize
```

### 4. Start PostgreSQL (Docker)
```bash
docker-compose up -d db
```

### 5. Run the Server
```bash
# Development mode with hot reload
npm run dev

# Or production mode
npm start
```

The API will be available at `http://localhost:3000`

### 6. Test the API
```bash
# Health check
curl http://localhost:3000/api/v1/health

# Send a message
curl -X POST http://localhost:3000/api/v1/chat/test_user_001 \
  -H "Content-Type: application/json" \
  -d '{"message": "What is your pricing?"}'
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3000 | Server port |
| `NODE_ENV` | No | development | development/production/test |
| `GROQ_API_KEY` | **Yes** | - | Groq API key |
| `DATABASE_URL` | **Yes** | - | PostgreSQL connection string |
| `MEMORY_BACKEND` | No | sequelize | Memory store type |
| `LOG_LEVEL` | No | info | Winston log level |

### Database Configuration

**Local Development (Docker):**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/sales_agent_db
```

**Production (Railway):**
```env
DATABASE_URL=postgresql://user:pass@host.railway.app:5432/dbname
```

---

## 🚢 Deployment

### Railway (Recommended)

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git push origin main
```

2. **Create Railway Project**
- Go to [railway.app](https://railway.app)
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose your repository

3. **Add PostgreSQL**
- Click "New"
- Select "Database" → "Add PostgreSQL"
- Railway auto-generates `DATABASE_URL`

4. **Configure Environment Variables**
```
GROQ_API_KEY=your_groq_api_key
NODE_ENV=production
```

5. **Deploy**
Railway auto-detects the `Dockerfile` and deploys.

6. **Verify**
```bash
curl https://your-app.railway.app/api/v1/health
```

### Docker Manual Deployment

```bash
# Build image
docker build -t sales-agent-api .

# Run container
docker run -d \
  -p 3000:3000 \
  -e GROQ_API_KEY=your_key \
  -e DATABASE_URL=your_db_url \
  -e NODE_ENV=production \
  --name sales-agent \
  sales-agent-api
```

---

## 📊 Monitoring

### Health Checks
```bash
curl http://localhost:3000/api/v1/health
```

### Logs
Development: Colored console output  
Production: JSON logs to `logs/` directory

### Key Metrics
- **Response time**: Track via `X-Request-Id` header
- **Quality scores**: Via `/evals/global/stats`
- **Error rate**: Monitor flagged responses

### Alerting Thresholds
- Error rate > 1%
- P95 latency > 5s
- Flagged responses > 10%

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Standards
- ESLint for linting
- Jest for testing
- No `console.log` - use Winston
- All async functions need error handling

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🆘 Support

For issues or questions:
1. Check this README
2. Review `ARCHITECTURE.md` for technical details
3. Open a GitHub issue
4. Contact the development team

---

## 🙏 Acknowledgments

- [Groq](https://groq.com/) for fast LLM inference
- [Sequelize](https://sequelize.org/) for ORM
- [Express](https://expressjs.com/) for web framework
- [Railway](https://railway.app/) for easy deployment

