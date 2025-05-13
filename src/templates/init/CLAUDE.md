# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Jedi-Ops is a worker queue platform for Cloudflare Workers with a modular architecture designed for easy extension. It uses Cloudflare Queues for background processing and optionally Upstash Redis for pub/sub messaging.

## Architecture

The project follows a modular architecture:
- `src/index.ts`: Main worker with API endpoints
- `src/todo.ts`: Message type definitions and utility functions
- `workers/todo-processor/index.ts`: Queue processor worker

The core architectural pattern is:
1. Define message types with TypeScript interfaces
2. Create factory functions to generate properly formatted messages
3. Process messages in the queue worker based on message type
4. Expose API endpoints to add messages to the queue

## Common Commands

### Development

```bash
# Install dependencies (Bun recommended for speed)
bun install

# Start local development server
bun start

# Deploy to Cloudflare
bun run deploy
```

### Adding New Message Types

To extend with new message types:

1. Add new message interface in `src/todo.ts`
2. Add factory function in `src/todo.ts`
3. Add API endpoint in `src/index.ts`
4. Add processor function in `workers/todo-processor/index.ts`

## Environment Setup

Environment variables are stored in the `.env` file:
- `AUTH_KEY`: Required for API authentication
- `UPSTASH_REDIS_URL`: Optional for Redis pub/sub
- `UPSTASH_REDIS_TOKEN`: Optional for Redis pub/sub

## Code Style Guidelines

- Use TypeScript interfaces for all message types
- Include validation in factory functions
- Follow the modular pattern when extending
- Use proper error handling with specific error types

## Important Notes

- Always include the `X-Auth-Key` header when making API requests
- The project uses path aliases: `@/*` for src and `@workers/*` for workers
- When adding new processors, register them in the `todoProcessors` object
- Use descriptive message types that follow the established pattern