# AutoML Analytics Chat Agent

An AI-powered data analyst and data scientist chat agent built with Next.js, shadcn/ui, Groq LLM, and PyCaret for automated machine learning analysis.

## Features

- **AI Chat Agent**: Intelligent data analysis assistant powered by Groq LLM (Llama 3.3 70B)
- **AutoML with PyCaret**: Classification, regression, clustering, time series forecasting, and anomaly detection
- **ML Explainability**: SHAP values, feature importance, model comparison metrics
- **Inline Visualizations**: Nivo charts (bar, line, pie, heatmap, scatter, radar) rendered inside the chat
- **Graph Analytics**: Sigma.js interactive network graphs with drag-and-drop nodes
- **CSV Upload & Analysis**: Automatic column type detection, data profiling
- **Persistent Memory**: Pinecone vector database for per-user conversation memory
- **Authentication**: Clerk-based authentication with user management
- **Database**: Neon PostgreSQL with Prisma ORM

## Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- **AI/LLM**: Groq SDK (Llama 3.3 70B Versatile)
- **AutoML**: PyCaret (FastAPI backend)
- **Charts**: Nivo (bar, line, pie, heatmap, scatter, radar)
- **Graphs**: Sigma.js + Graphology
- **Auth**: Clerk
- **Database**: Neon PostgreSQL + Prisma ORM
- **Vector DB**: Pinecone (per-user namespaces)
- **Styling**: Copper/dark luxury theme with Playfair Display + Inter fonts

## Design

The UI features a sophisticated dark theme with copper/gold accents inspired by luxury architecture design:

- Background: `#0F0F0E` with subtle architectural photography overlay
- Copper accents: `#C17F59`, `#D4A07A`
- Gold tones: `#C9A96E`, `#DFC08A`
- Typography: Playfair Display (headings) + Inter (body)

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.10+ (for PyCaret API)

### Installation

```bash
npm install
npx prisma generate
npx prisma db push
```

### Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=
GROQ_API_KEY=
PINECONE_API_KEY=
PINECONE_INDEX_NAME=
PYCARET_API_URL=http://localhost:8000
```

### PyCaret API (Optional)

```bash
cd pycaret-api
pip install -r requirements.txt
python main.py
```

### Development

```bash
npm run dev
```

## Architecture

```
src/
  app/
    chat/           # Main chat interface
    api/
      chat/         # Groq LLM + Pinecone memory
      upload/       # CSV upload and profiling
      analyze/      # AutoML analysis orchestration
      webhooks/     # Clerk user sync
  components/
    chat/           # Chat message, inline forms
    charts/         # Nivo chart components
    graphs/         # Sigma.js graph components
    ui/             # shadcn/ui components
  lib/
    groq.ts         # Groq LLM client
    pinecone.ts     # Pinecone vector memory
    prisma.ts       # Database client
pycaret-api/
  main.py           # FastAPI PyCaret AutoML server
```
