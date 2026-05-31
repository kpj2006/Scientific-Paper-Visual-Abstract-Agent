# OOBE Research Agent

Autonomous research agent for the OOBE Protocol x Ace Data Cloud bounty. The service watches newly published arXiv papers, extracts only the minimum useful context, runs Ace Data Cloud workflows through x402 settlement, and records every service call for analytics.

## What it does

- Polls arXiv on a schedule and deduplicates papers with PostgreSQL.
- Uses tiered extraction: arXiv API first, ar5iv HTML for richer context, PDF fallback only when necessary.
- Calls Ace Data Cloud for summarization, embeddings, image generation, and video generation.
- Discovers SAP tools through Synapse Gateway and keeps the agent registration flow separate from the paper pipeline.
- Logs service usage, request counts, payment amounts, and transaction hashes for later audit.

## Stack

- TypeScript + Node.js
- SAP SDK and Synapse client adapters
- Ace Data Cloud SDK + x402 payment handler
- PostgreSQL
- BullMQ + Redis

## Local setup

1. Copy `.env.example` to `.env` and fill in the required keys.
2. Start PostgreSQL and Redis locally.
3. Install dependencies with `npm install`.
4. Run `npm run typecheck`.

## Commands

- `npm run dev` - watch mode for the main service.
- `npm run scheduler` - run only the cron scheduler.
- `npm run worker` - run the queue worker.
- `npm run once` - process one fetch-and-run cycle.
- `npm run build` - compile to `dist/`.

## Notes

- The project is scaffolded to keep x402 payment settlement and service logging explicit from the start.
- The SAP and Ace client adapters are isolated so the exact SDK method surface can be updated without touching the pipeline.