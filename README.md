# Report Writing Agent

An AI-powered report generation app. Enter a topic, and the agent researches it — drawing on an uploaded knowledge base (PDF/Word documents) and, when needed, live web search — then writes a structured report. Includes user accounts, report history, and a per-report view.

## Features

- **Auth** — signup/login with JWT, protected routes on both frontend and backend
- **Report generation** — agent loop researches a topic and writes a report
- **Knowledge base** — upload PDF or Word documents to ground future reports on your own material
- **History** — view and revisit previously generated reports
- **RAG-backed retrieval** — uploaded documents are parsed, embedded, and stored in a vector store for retrieval at generation time

## Tech stack

**Frontend**
- React (Create React App) + React Router
- Axios (`api.js` — shared instance with JWT attached to requests)

**Backend**
- Node.js + Express
- MongoDB + Mongoose
- JWT (`jsonwebtoken`) + `bcryptjs` for auth
- Groq (LLM calls)
- Tavily (live web search)
- Pinecone (vector database for RAG)
- `multer` for file uploads
- `pdf-parse` / `mammoth` for extracting text from PDF/Word uploads
- `cheerio` for parsing web page content from search results

## Project structure

```
report-writing-agent/
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       │   └── Sidebar.js
│       ├── Pages/
│       │   ├── History.js
│       │   ├── Login.js
│       │   ├── NewReport.js
│       │   ├── ReportView.js
│       │   └── Signup.js
│       ├── styles/
│       │   ├── Auth.css
│       │   ├── History.css
│       │   ├── NewReport.css
│       │   └── Sidebar.css
│       ├── api.js
│       ├── App.js / App.css
│       └── index.js / index.css
└── server/
    ├── agent/
    │   ├── loop.js          # agent orchestration loop
    │   └── tools.js         # tools available to the agent (e.g. search, retrieval)
    ├── controller/
    │   ├── agentController.js
    │   ├── authController.js
    │   └── reportController.js
    ├── middleware/
    │   └── authMiddleware.js
    ├── models/
    │   ├── Report.js
    │   ├── Source.js
    │   └── User.js
    ├── rag/
    │   ├── parseDocument.js # extracts text from uploaded PDF/Word files
    │   └── vectorStore.js   # embedding + Pinecone storage/retrieval
    ├── routes/
    │   ├── agent.js
    │   ├── auth.js
    │   └── report.js
    ├── uploads/
    └── index.js
```

## Getting started

### Prerequisites

- Node.js (v18+ recommended)
- A MongoDB instance (local or Atlas)
- A Pinecone account/API key
- A Groq API key (LLM calls)
- A Tavily API key (live web search)

### 1. Install

```bash
git clone <your-repo-url>
cd report-writing-agent

# backend
cd server
npm install

# frontend
cd ../client
npm install
```

### 2. Environment variables

`server/.env`:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX=your_pinecone_index_name
PINECONE_HOST=your_pinecone_index_host
GROQ_API_KEY=your_groq_api_key
TAVILY_API_KEY=your_tavily_api_key
```

`client/.env`:

```env
REACT_APP_API_URL=http://localhost:5000
DISABLE_ESLINT_PLUGIN=true
```

### 3. Run

```bash
# backend (from /server)
npm start

# frontend (from /client), separate terminal
npm start
```

Frontend runs at `http://localhost:3000`, backend at `http://localhost:5000`.

## API overview

| Method | Endpoint                      | Description                           | Auth required |
|--------|-------------------------------|--------------------------------------|----------------|
| POST   | `/api/auth/register`          | Create a new account                 | No             |
| POST   | `/api/auth/login`             | Log in, returns JWT + user           | No             |
| POST   | `/api/agent/generate-report`  | Generate a new report (runs agent)   | Yes            |
| POST   | `/api/agent/upload-document`  | Upload a document to the KB          | Yes            |
| GET    | `/api/report/mine`            | List report history for current user | Yes            |
| GET    | `/api/report/single/:id`      | Get a single report                  | Yes            |

## Roadmap / ideas

- [ ] Export reports as PDF/Word
- [ ] Share reports via link
- [ ] Multi-user collaboration on a report

