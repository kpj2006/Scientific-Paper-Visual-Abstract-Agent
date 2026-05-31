# OOBE Research Agent

Autonomous on-chain research agent for the OOBE Protocol × Ace Data Cloud bounty.

## Workflow

```text
Cron Scheduler
  -> Fetch new arXiv papers (Tier 1)
  -> Optional ar5iv extraction (Tier 2)
  -> PDF fallback extraction (Tier 3)
  -> Ace Chat summarization
  -> Ace Embeddings duplicate detection
  -> Ace Flux image generation
  -> Ace Luma video generation
  -> Social post generation
  -> PostgreSQL persistence
  -> x402 payment settlement + usage tracking
```

## Implemented components

- **Scheduler (`src/scheduler.ts`)**
  - Runs cron cycles and discovers SAP tools from Synapse Gateway.
- **Queue + Worker (`src/queue/paper-queue.ts`, `src/worker.ts`)**
  - Uses BullMQ + Redis for async paper processing.
- **ArXiv ingestion (`src/arxiv/client.ts`)**
  - Pulls title, authors, abstract, publication date, categories from arXiv API.
- **Tiered extraction (`src/arxiv/extractor.ts`)**
  - Abstract-first strategy, ar5iv section extraction, PDF fallback excerpt.
- **Ace workflow adapter (`src/ace/client.ts`)**
  - Chat, embeddings, image, and video calls with x402 settlement per service call.
- **Persistence (`src/db.ts`, `src/store/papers.ts`)**
  - Stores papers, extracted context, generated outputs, SAP tools, and x402 analytics.

## Stack

- TypeScript + Node.js
- BullMQ + Redis
- PostgreSQL
- SAP/Synapse adapter hooks
- Ace Data Cloud service adapter

## Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis:
   - `docker compose up -d`
3. Install dependencies:
   - `npm install`

## Commands

- `npm run dev` - run scheduler + worker.
- `npm run scheduler` - scheduler only.
- `npm run worker` - worker only.
- `npm run once` - run one scheduler cycle.
- `npm run typecheck` - TypeScript check.
- `npm run build` - compile to `dist/`.

## Notes

- All service usage events store service name, request count, payment amount, and transaction hash.
- If external endpoints are unavailable, adapters fall back safely so the local pipeline remains runnable.
