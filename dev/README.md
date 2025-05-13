# Jedi-Ops Worker Platform

```
    ____          ___       ____              
   / / /___  ____/ (_)___  / __ \____  _____  
  / / / __ \/ __  / / __ \/ / / / __ \/ ___/  
 / / / /_/ / /_/ / / /_/ / /_/ / /_/ (__  )   
/_/_/\____/\__,_/_/\____/\____/ .___/____/    
                             /_/            
```

A worker queue platform on Cloudflare Workers created with Jedi-Ops - bringing the Force to your serverless applications.

## Architecture

This project follows a modular architecture designed for easy extension:

```
├── src/
│   ├── index.ts       # Main worker with API endpoints
│   └── todo.ts        # Message types and utilities
├── workers/
│   └── todo-processor/ # Queue processor worker
│       └── index.ts
└── wrangler.toml      # Cloudflare configuration
```

The architecture follows these principles:

1. **Type-Safe Messages**: All message types are defined with TypeScript interfaces
2. **Utility Functions**: Factory functions create properly formatted messages
3. **Queue Processing**: Workers process messages based on their type
4. **Modular Design**: Easy to extend with new message types and processors

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Cloudflare Account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Installation

1. Install dependencies:

```bash
# 🚀 Recommended: Use Bun for faster installation and startup
bun install

# Alternative: use npm if Bun is not available
npm install
```

> 💡 **Why Bun?** Bun uses a Rust-based JavaScript runtime that's significantly faster than Node.js for dependency installation and project startup. It's particularly well-suited for Cloudflare Workers development.

2. Configure your environment:

The project comes with an `.env` file pre-configured with your AUTH_KEY. 

#### Redis Configuration (if enabled)

If you're using Upstash Redis, configure it in your `.env` file:

1. Create an [Upstash Redis database](https://console.upstash.com/)
2. Go to the **Details** tab in your Upstash console
3. Copy the **REST API** details:

```bash
# Add to your .env file
UPSTASH_REDIS_URL="https://your-region.upstash.io/redis/your-database-id"
UPSTASH_REDIS_TOKEN="your-upstash-token"
```

#### Environment Setup Commands

```bash
# View current environment configuration
cat .env

# Edit environment variables
nano .env
```

### Development

Start the local development server:

```bash
# 🚀 Recommended for speed
bun start

# Alternative with npm
npm start
```

The server will start with Wrangler's local development environment, simulating Cloudflare's infrastructure. Your API will be available at http://localhost:8787 by default.

### Deployment

Deploy to Cloudflare Workers:

```bash
# 🚀 Recommended
bun run deploy

# Alternative
npm run deploy
```

This will deploy your application to Cloudflare's global network. You'll receive a workers.dev subdomain where your API is accessible.

## Features

### Modular Architecture

This project follows a modular architecture that makes it easy to extend:

- **Message Types**: Defined in `src/todo.ts` with TypeScript interfaces
- **Message Creation**: Utility functions to create properly formatted messages
- **Queue Processing**: Worker to process different message types
- **API Endpoints**: Secure endpoints to add messages to the queue

### API Endpoints

- `GET /health`: Health check endpoint (no auth required)
- `GET /docs`: API documentation (no auth required)
- `POST /api/todo/counter`: Run a counter task (requires X-Auth-Key header)
- `POST /api/todo/task`: Create a todo task (requires X-Auth-Key header)
- `POST /api/todo/reminder`: Create a reminder (requires X-Auth-Key header)
- `POST /publish`: Publish a message to a Redis channel (requires X-Auth-Key header and Redis configuration)

## Extending the Project

### Adding New Message Types

The project is designed to be easily extended with new message types. Follow these steps:

1. **Define a new message type in `src/todo.ts`**:

```typescript
// Add a new message interface
export interface EmailMessage extends BaseMessage {
  type: 'email';
  data: {
    to: string;
    subject: string;
    body: string;
    // Add any other fields you need
  };
}

// Update the union type to include your new type
export type TodoMessage = CounterMessage | TaskMessage | ReminderMessage | EmailMessage;
```

2. **Add a utility function to create messages**:

```typescript
export function createEmail(to: string, subject: string, body: string): EmailMessage {
  // Validate inputs
  if (!to || !subject) {
    throw new Error('Email requires a recipient and subject');
  }
  
  return {
    type: 'email',
    timestamp: Date.now(),
    data: {
      to,
      subject,
      body
    }
  };
}
```

3. **Create an API endpoint in `src/index.ts`**:

```typescript
api.post('/api/todo/email', async (c) => {
  try {
    const data = await c.req.json();
    
    // Use the utility function
    const message = createEmail(data.to, data.subject, data.body);
    
    // Send to queue
    await c.env.TODO_QUEUE.send(message);
    
    return c.json({
      success: true,
      message: 'Email queued successfully'
    });
  } catch (error) {
    // Error handling...
  }
});
```

4. **Implement the processor in `workers/todo-processor/index.ts`**:

```typescript
async function processEmail(message: EmailMessage, env: Env): Promise<void> {
  console.log(`Processing email to: ${message.data.to}`);
  // Implement your email sending logic here
}

// Add to the processors object
const todoProcessors = {
  counter: processCounter,
  task: processTask,
  reminder: processReminder,
  email: processEmail  // Your new processor
};
```

### Adding New Queue Consumers

To add a completely new queue type:

```bash
npx jedi-ops add queue-consumer --name your-consumer-name
```

This will:
1. Create a new worker directory in `workers/your-consumer-name`
2. Add the queue configuration to `wrangler.toml`
3. Set up a basic worker template for processing messages

Example of a customized queue worker:

```typescript
// workers/email-processor/index.ts
import { sendEmail } from './email-service';

export interface Env {
  EMAIL_PROCESSOR_QUEUE: Queue;
  API_KEY: string;
}

export default {
  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        const { to, subject, body } = message.body as EmailMessage;
        
        // Process the email
        await sendEmail(to, subject, body, env.API_KEY);
        
        // Acknowledge the message
        message.ack();
      } catch (error) {
        console.error(`Error processing email: ${error}`);
        message.retry();
      }
    }
  }
};

interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}
```

### Building End-to-End Workflows

To create complete workflows from API to queue to processing:

1. **API Layer**: Define endpoints in `src/index.ts` to accept client requests
   ```typescript
   // Add a new endpoint to src/index.ts
   app.post('/api/send-email', async (c) => {
     try {
       const body = await c.req.json();
       await c.env.EMAIL_PROCESSOR_QUEUE.send(body);
       return c.json({ success: true });
     } catch (error) {
       return c.json({ success: false, error: String(error) }, 500);
     }
   });
   ```

2. **Queue Configuration**: Update `wrangler.toml` with the new queue (or use `jedi-ops add`)
   ```toml
   [[queues.producers]]
   queue = "email-queue"
   binding = "EMAIL_PROCESSOR_QUEUE"
   
   [[queues.consumers]]
   queue = "email-queue"
   max_batch_size = 10
   max_retries = 3
   dead_letter_queue = "email-dlq"
   ```

3. **Worker Implementation**: Create the worker that processes the queue messages
   ```bash
   npx jedi-ops add queue-consumer --name email-processor
   ```

4. **Testing the Workflow**: 
   - Start local development: `npm start`
   - Send a test request:
     ```bash
     curl -X POST https://your-project.your-subdomain.workers.dev/api/send-email \
       -H "X-Auth-Key: your-auth-key" \
       -H "Content-Type: application/json" \
       -d '{"to":"user@example.com","subject":"Test","body":"Hello world"}'
     ```

### Pub/Sub with Upstash Redis

If you enabled Redis, you can use the pub/sub functionality:

1. **Publishing Messages**:
   ```bash
   curl -X POST https://your-project.your-subdomain.workers.dev/publish \
     -H "X-Auth-Key: your-auth-key" \
     -H "Content-Type: application/json" \
     -d '{"channel":"notifications","message":{"event":"new_user","data":{"id":123}}}'
   ```

2. **Subscribing in Workers**:
   ```typescript
   // In a custom worker
   import { Redis } from '@upstash/redis/cloudflare';
   
   export default {
     async fetch(request, env) {
       const redis = new Redis({
         url: env.UPSTASH_REDIS_URL,
         token: env.UPSTASH_REDIS_TOKEN,
       });
       
       // Subscribe to channel (note: this approach is for demonstration)
       // For long-lived subscriptions, consider a dedicated Worker
       const message = await redis.subscribe('notifications', (message) => {
         console.log('Received notification:', message);
       });
       
       return new Response('Subscribed');
     }
   };
   ```

### Advanced Configuration

#### Custom Error Handling

Implement custom error handling for queue processing:

```typescript
// workers/your-processor/index.ts
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        // Processing logic
        message.ack();
      } catch (error) {
        // Custom error handling based on error type
        if (error.name === 'ValidationError') {
          console.error(`Validation error: ${error.message}`);
          // Don't retry validation errors
          message.ack();
        } else if (error.name === 'RateLimitError') {
          console.error(`Rate limit error: ${error.message}`);
          // Wait and retry rate limit errors
          message.retry();
        } else {
          console.error(`Unknown error: ${error.message}`);
          message.retry();
        }
      }
    }
  }
};
```

#### Scaling Considerations

For high-throughput applications:

1. Adjust queue batch settings in `wrangler.toml`:
   ```toml
   [[queues.consumers]]
   queue = "your-queue"
   max_batch_size = 100          # Process more messages per batch
   max_batch_timeout = 30        # Wait longer to fill batches
   max_retries = 5               # More retries for resilience
   ```

2. Optimize worker code for performance:
   - Use efficient data structures
   - Minimize external API calls when possible
   - Consider batching operations to external services

## Examples

### Using the Todo Processor

This project comes with a ready-to-use `todo-processor` worker that processes different types of messages. You can interact with it using the API endpoints:

#### Counter Example

The Counter task is a simple example that loops from a start number to an end number with a specified step.

```bash
# Run a counter from 1 to 1000 with step 5
curl -X POST https://your-project.workers.dev/api/todo/counter \
  -H "X-Auth-Key: your-auth-key" \
  -H "Content-Type: application/json" \
  -d '{"start": 1, "end": 1000, "step": 5}'
```

#### Task Management

Create a task with priority, description, and due date:

```bash
curl -X POST https://your-project.workers.dev/api/todo/task \
  -H "X-Auth-Key: your-auth-key" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete project documentation", 
    "priority": "high", 
    "description": "Finish all documentation sections",
    "due_date": "2023-12-31"
  }'
```

#### Reminders

Schedule reminders for specific users:

```bash
curl -X POST https://your-project.workers.dev/api/todo/reminder \
  -H "X-Auth-Key: your-auth-key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Team meeting", 
    "user_id": "user123", 
    "scheduled_for": "2023-12-15T15:00:00Z",
    "send_email": true,
    "send_push": true
  }'
```

### How It Works

The system is based on a modular message processing architecture:

1. **Message Creation**:
   - The API endpoints use utility functions from `src/todo.ts`
   - These functions create properly formatted messages with validation

2. **Queue Processing**:
   - Messages are sent to the Cloudflare Queue
   - The `todo-processor` worker pulls messages in batches
   - Messages are routed to the appropriate handler based on their `type`

3. **Error Handling**:
   - Validation errors prevent invalid messages from being processed
   - Retryable errors are automatically retried with backoff
   - Non-retryable errors are acked and logged

### Email Processing System

```typescript
// src/index.ts (main worker)
app.post('/api/send-email', async (c) => {
  try {
    const { to, subject, body } = await c.req.json();
    
    // Validate input
    if (!to || !subject || !body) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }
    
    // Add to email queue
    await c.env.EMAIL_QUEUE.send({ to, subject, body });
    
    return c.json({ success: true, message: 'Email queued' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// workers/email-processor/index.ts
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const { to, subject, body } = message.body;
        
        // Send email (using a hypothetical email service)
        const result = await sendEmail(to, subject, body, env.EMAIL_API_KEY);
        console.log(`Email sent to ${to}, ID: ${result.id}`);
        
        message.ack();
      } catch (error) {
        console.error(`Failed to send email: ${error.message}`);
        message.retry();
      }
    }
  }
};
```

### Real-time Notifications

```typescript
// src/index.ts (using Redis pub/sub)
app.post('/api/notify', async (c) => {
  try {
    const { userId, notification } = await c.req.json();
    
    // Publish to Redis
    const redis = new Redis({
      url: c.env.UPSTASH_REDIS_URL,
      token: c.env.UPSTASH_REDIS_TOKEN,
    });
    
    await redis.publish(`user:${userId}:notifications`, JSON.stringify(notification));
    
    return c.json({ success: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});
```

## Troubleshooting

### Common Issues

1. **Queue binding errors**: Ensure your `wrangler.toml` has the correct queue configuration
2. **Auth key errors**: Make sure you're sending the `X-Auth-Key` header with API requests
3. **Redis connection issues**: Verify your Upstash Redis credentials in your `.env` file

### Path Aliases

This project uses TypeScript path aliases to make imports cleaner:
- `@/*` for files in the `src/` directory
- `@workers/*` for files in the `workers/` directory

For example:
```typescript
// Old way
import { SomeType } from '../../../workers/some-processor';

// New way with path aliases
import { SomeType } from '@workers/some-processor';
```

### Debugging

For local development debugging:

```bash
# Run with verbose logging
npx wrangler dev --verbose

# Test queue processing locally
npx wrangler dev --test-scheduled
```

### Environment Variables

This project uses a `.env` file for environment variables. During development, they're automatically loaded by Wrangler. For production deployment, you can set them in the Cloudflare dashboard or using the Wrangler CLI:

```bash
# Set environment variables for production
npx wrangler secret put AUTH_KEY
npx wrangler secret put UPSTASH_REDIS_URL
npx wrangler secret put UPSTASH_REDIS_TOKEN
```

## Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Hono Documentation](https://honojs.dev/)
- [Upstash Redis Documentation](https://docs.upstash.com/redis)

## License

MIT