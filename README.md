# 🤖 AI chat bot  with multiple feature


---

## 🌟 Features

- 📄 **PDF Chat** — Upload any PDF and ask questions in natural language
- 🔍 **Web Search** — Real-time internet search with clickable source citations
- 💬 **Simple Chat** — General AI conversation without any mode
- 📱 **WhatsApp Bot** — Chat with AI directly from WhatsApp (no app needed)
- 🔒 **Session Isolation** — Every user's data is completely separate
- ⚡ **Streaming Responses** — Token-by-token real-time answers
- 🧠 **LangGraph Pipeline** — Stateful AI orchestration (route → retrieve → prompt)
- 📝 **Markdown Support** — Code blocks, tables, syntax highlighting

---

## 🏗️ Tech Stack

| Technology | Purpose |
|-----------|---------|
| **Next.js 16** | Full-stack framework + API routes |
| **LangGraph** | AI pipeline orchestration |
| **Groq API (Llama 3.3 70B)** | LLM — answer generation |
| **Tavily Search API** | Real-time web search |
| **Qdrant Cloud** | Vector database for PDF storage |
| **HuggingFace API** | Text embeddings (384-dim) |
| **Twilio WhatsApp API** | WhatsApp bot integration |
| **pdf-parse** | PDF text extraction |
| **TypeScript** | Type safety |
| **Tailwind CSS v4** | UI styling |

---


## ⚙️ Environment Variables

Create a `.env.local` file in the root:

```
QDRANT_API_KEY=***************************
QDRANT_DB_ENDPOINT=********************************************************
GROQ_API_KEY=************************************
HUGGINGFACE_API_TOKEN=******************
TAVILY_API_KEY=tvly-***********
TWILIO_ACCOUNT_SID =********************
TWILIO_AUTH_TOKEN =***********
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd ai_chatbot
npm install
```

### 2. Setup Environment Variables

Copy the `.env.local` example above and fill in your API keys.

**Get your free API keys:**
- 🔑 Groq: [console.groq.com](https://console.groq.com)
- 🔑 Tavily: [tavily.com](https://tavily.com)
- 🔑 HuggingFace: [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
- 🔑 Qdrant: [cloud.qdrant.io](https://cloud.qdrant.io)
- 🔑 Twilio: [twilio.com](https://twilio.com)

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000/chat](http://localhost:3000/chat)

---

## 📄 PDF Chat — How It Works

### Upload Flow
1. Click **+** button → **Upload PDF**
2. PDF is parsed using `pdf-parse`
3. Text split into 500-char chunks with 50-char overlap
4. HuggingFace converts chunks to 384-dim vectors
5. Vectors stored in Qdrant with `sessionId` tag

### Chat Flow (LangGraph Pipeline)
```
User message
    ↓
routeNode    → simple greeting? skip search
    ↓
retrieveNode → Qdrant vector search (filter by sessionId)
    ↓
promptNode   → build system prompt based on context
    ↓
Groq LLM     → generate streaming answer
```

---

## 🔍 Web Search — How It Works

1. Click **+** button → **Web Search**
2. Green **"Web Search ON"** badge appears
3. Type any question and send
4. Tavily API fetches top 5 real-time web results
5. Groq LLM summarizes results
6. Answer streams with **clickable source chips** below


---

## 📱 WhatsApp Bot — How It Works

### Setup

**1. Twilio WhatsApp Sandbox**
- Go to [console.twilio.com](https://console.twilio.com)
- Messaging → Try it out → Send a WhatsApp message
- Join the sandbox from your WhatsApp

**2. For Local Development — ngrok**
```bash
# Install ngrok from https://ngrok.com/download
ngrok config add-authtoken YOUR_TOKEN
ngrok http 3000
```

**3. Set Webhook in Twilio**
```
https://your-ngrok-url.ngrok-free.app/api/whatsapp
```
Method: HTTP POST

**4. For Production — Update webhook to your deployed URL**
```
https://your_domain.com/api/whatsapp
```

### Usage
Just send any message to the Twilio sandbox number on WhatsApp:
```
Hello → AI greets you
What is AI? → AI explains
Any question → AI answers
```

### How it works internally
```
WhatsApp message
    ↓
Twilio receives → POST /api/whatsapp
    ↓
Extract From (phone) + Body (message)
    ↓
Load conversation history (per phone number)
    ↓
Groq LLM generates answer
    ↓
Save to history (last 20 messages)
    ↓
Twilio sends reply to WhatsApp
```

---

## 🔒 Session Isolation

Every user gets a unique `sessionId` stored in `localStorage`:
- All PDF vectors tagged with `sessionId` in Qdrant
- Search filtered by `sessionId` — users never see each other's data
- **New Chat** deletes only that user's vectors and generates a fresh `sessionId`

---

## 📦 API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/chat` | POST | LangGraph PDF chat pipeline |
| `/api/upload` | POST | PDF upload + vector embedding |
| `/api/websearch` | POST | Real-time Tavily web search |
| `/api/whatsapp` | POST | Twilio WhatsApp webhook |
| `/api/clear-context` | POST | Clear session data from Qdrant |

---

## 👤 Author

**Nitin Lohumi**
- 📧 lohuminitin@gmail.com
- 📞 +91 7417696780
- 📍 Bageshwar, Uttarakhand, India