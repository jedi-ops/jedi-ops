# Jedi-Ops

```
    ____          ___       ____              
   / / /___  ____/ (_)___  / __ \____  _____  
  / / / __ \/ __  / / __ \/ / / / __ \/ ___/  
 / / / /_/ / /_/ / / /_/ / /_/ / /_/ (__  )   
/_/_/\____/\__,_/_/\____/\____/ .___/____/    
                             /_/            
                      Worker Queue Platform
```

A command-line interface (CLI) tool for creating worker queue platforms on Cloudflare Workers. Jedi-Ops brings the Force to your serverless applications.

## Overview

Jedi-Ops simplifies the development of serverless applications with worker queues on Cloudflare Workers. It scaffolds projects with pre-configured components, including:

- Cloudflare Queues for task management
- Hono for secure webhook integrations
- Optional Upstash Redis for pub/sub messaging

## Installation

### Using npx (without installation)

```bash
# 🚀 Recommended - no installation needed
npx create-jedi-ops@latest
```

### Global Installation

```bash
# With bun (recommended for speed - uses Rust runtime)
bun install -g create-jedi-ops

# With npm
npm install -g create-jedi-ops
```

> 💡 **Why Bun?** Bun uses a Rust-based JavaScript runtime that's significantly faster than Node.js for dependency installation and project startup. It's particularly well-suited for Cloudflare Workers development.

## Usage

### Creating a New Project

```bash
# Interactive setup (recommended)
npx create-jedi-ops@latest

# Or if installed globally
jedi-ops init
```

The CLI will guide you through an interactive setup process to configure:
- Project name and location
- Cloudflare Queues enablement
- Upstash Redis integration
- Authentication key generation

#### Command Options

```bash
# Create with specific options
npx create-jedi-ops@latest -n my-jedi-project -d ./projects/jedi

# Skip prompts and use defaults
npx create-jedi-ops@latest -y
```

Available options:
- `-n, --name <name>`: Project name (default: "jedi-ops-project")
- `-d, --directory <directory>`: Target directory (default: ./<name>)
- `-y, --yes`: Skip prompts and use defaults

### Adding Components

Once you have a project, you can add new components:

```bash
npx jedi-ops add queue-consumer --name my-processor
```

This will:
1. Create a new queue consumer worker
2. Update the wrangler.toml file with necessary queue bindings

Available components:
- `queue-consumer`: Generic queue consumer worker
- `dispatch-processor`: Specialized queue consumer for dispatching tasks

## Project Structure

The generated project includes:

```
your-project/
├── package.json
├── wrangler.toml
├── tsconfig.json
├── src/
│   └── index.ts        # Main worker with Hono for webhooks and queue production
└── workers/
    └── dispatch-processor/ # Queue consumer worker
        └── index.ts
```

## Features

- **Cloudflare Queues**: Pre-configured for background job processing
- **Webhook Endpoints**: Secured with authkey authentication
- **TypeScript**: Full type safety with Cloudflare Workers types
- **Pub/Sub Messaging**: Optional Upstash Redis integration

## Development of Jedi-Ops CLI

### Prerequisites

- Node.js v16+ or Bun (recommended)
- Cloudflare Workers knowledge

### Building the CLI

```bash
# Install dependencies
bun install  # or npm install

# Build the CLI
bun run build  # or npm run build
```

### Local Testing

```bash
# Link for local development
bun link  # or npm link

# Test with a new project
jedi-ops init --name test-project
```

## Sample Projects

Jedi-Ops works well for various async processing needs:

- Event processing pipelines
- Background job processing
- Data transformation workflows
- Notification systems
- Email processing/delivery
- Webhook handling and distribution

## The Force is Strong with This One

Jedi-Ops simplifies building serverless applications with Cloudflare Workers. By combining the power of queue processing, webhook handling, and pub/sub messaging, you can build powerful applications that run at the edge.

```
"Do. Or do not. There is no try." - Master Yoda
```

## License

MIT