/**
 * Jedi-Ops Main Worker
 * 
 * This is the primary worker that handles HTTP requests and dispatches
 * tasks to background queues. It demonstrates the modular architecture
 * of Jedi-Ops for building serverless applications.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import { Redis } from '@upstash/redis/cloudflare';

// Import message types and handlers from the todo module
import { 
  CounterMessage,
  TaskMessage,
  ReminderMessage,
  createCounter,
  createTask,
  createReminder
} from './todo';

// Define environment variables and bindings
export interface Env {
  // Cloudflare Queue binding
  TODO_QUEUE: Queue;
  
  // Environment variables
  AUTH_KEY: string;
  UPSTASH_REDIS_URL: string;
  UPSTASH_REDIS_TOKEN: string;
}

// Create a new Hono app
const app = new Hono<{ Bindings: Env }>();

// Add middlewares
app.use('*', logger());
app.use('*', timing());
app.use('*', cors({
  origin: '*', // Update this for production
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Auth-Key'],
  exposeHeaders: ['X-Response-Time'],
  maxAge: 86400,
}));

// Auth middleware for protected routes
const authMiddleware = async (c: any, next: any) => {
  const authKey = c.req.header('X-Auth-Key');
  
  if (!authKey || authKey !== c.env.AUTH_KEY) {
    return c.json(
      {
        success: false,
        error: 'Unauthorized: Invalid or missing X-Auth-Key'
      },
      401
    );
  }
  
  await next();
};

// Public routes (no auth required)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    features: {
      queues: !!c.env.DISPATCH_QUEUE,
      redis: !!(c.env.UPSTASH_REDIS_URL && c.env.UPSTASH_REDIS_TOKEN)
    }
  });
});

app.get('/', (c) => {
  return c.json({
    name: 'Jedi-Ops Worker',
    description: 'Worker queue platform for Cloudflare Workers',
    docs: '/docs'
  });
});

// Simple documentation endpoint
app.get('/docs', (c) => {
  return c.json({
    endpoints: [
      {
        path: '/health',
        method: 'GET',
        description: 'Health check endpoint',
        auth: false
      },
      {
        path: '/api/todo/counter',
        method: 'POST',
        description: 'Runs a counter task in the todo queue',
        auth: true,
        body: {
          start: 'number',
          end: 'number',
          step: 'number (optional)'
        }
      },
      {
        path: '/api/todo/task',
        method: 'POST',
        description: 'Creates a todo task',
        auth: true,
        body: {
          title: 'string',
          description: 'string (optional)',
          priority: 'string (optional)',
          due_date: 'string (optional)'
        }
      },
      {
        path: '/api/todo/reminder',
        method: 'POST',
        description: 'Creates a reminder',
        auth: true,
        body: {
          message: 'string',
          user_id: 'string',
          scheduled_for: 'string (ISO date)',
          send_email: 'boolean (optional)',
          send_push: 'boolean (optional)'
        }
      },
      {
        path: '/publish',
        method: 'POST',
        description: 'Publishes a message to a Redis channel',
        auth: true,
        body: {
          channel: 'string',
          message: 'any'
        }
      }
    ]
  });
});

// Protected API routes (require auth)
const api = app.use('/*', authMiddleware);

// Todo API Endpoints with utility function usage
api.post('/api/todo/counter', async (c) => {
  try {
    const data = await c.req.json();
    
    // Validate counter data
    if (data.start === undefined || data.end === undefined) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: start, end'
        },
        400
      );
    }
    
    try {
      // Create counter message using the utility function
      const message = createCounter(data.start, data.end, data.step || 1);
      
      // Send to queue
      await c.env.TODO_QUEUE.send(message);
      
      return c.json({
        success: true,
        message: 'Counter job queued successfully',
        id: `counter-${message.timestamp}`,
        range: `${message.data.start} to ${message.data.end} (step: ${message.data.step})`
      });
    } catch (e: any) {
      return c.json(
        {
          success: false,
          error: e.message
        },
        400
      );
    }
  } catch (error: any) {
    console.error('Error queueing counter job:', error);
    return c.json(
      {
        success: false,
        error: `Failed to queue counter job: ${error.message}`
      },
      500
    );
  }
});

api.post('/api/todo/task', async (c) => {
  try {
    const data = await c.req.json();
    
    // Use utility function to create the task
    try {
      const message = createTask(
        data.title,
        data.description,
        data.priority,
        data.due_date
      );
      
      // Send to queue
      await c.env.TODO_QUEUE.send(message);
      
      return c.json({
        success: true,
        message: 'Task queued successfully',
        id: `task-${message.timestamp}`,
        title: message.data.title
      });
    } catch (e: any) {
      return c.json(
        {
          success: false,
          error: e.message
        },
        400
      );
    }
  } catch (error: any) {
    console.error('Error queueing task:', error);
    return c.json(
      {
        success: false,
        error: `Failed to queue task: ${error.message}`
      },
      500
    );
  }
});

api.post('/api/todo/reminder', async (c) => {
  try {
    const data = await c.req.json();
    
    try {
      // Use utility function to create the reminder
      const message = createReminder(
        data.message,
        data.user_id,
        data.scheduled_for,
        data.send_email,
        data.send_push
      );
      
      // Send to queue
      await c.env.TODO_QUEUE.send(message);
      
      return c.json({
        success: true,
        message: 'Reminder queued successfully',
        id: `reminder-${message.timestamp}`,
        scheduled_for: message.data.scheduled_for
      });
    } catch (e: any) {
      return c.json(
        {
          success: false,
          error: e.message
        },
        400
      );
    }
  } catch (error: any) {
    console.error('Error queueing reminder:', error);
    return c.json(
      {
        success: false,
        error: `Failed to queue reminder: ${error.message}`
      },
      500
    );
  }
});

// Redis pub/sub endpoint if Upstash Redis is configured
api.post('/publish', async (c) => {
  try {
    const { channel, message } = await c.req.json();
    
    // Validate request
    if (!channel || !message) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: channel and message'
        },
        400
      );
    }
    
    // Check if Redis is configured
    if (!c.env.UPSTASH_REDIS_URL || !c.env.UPSTASH_REDIS_TOKEN) {
      return c.json(
        {
          success: false,
          error: 'Redis is not configured. Please set UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN in your .env file.'
        },
        503
      );
    }
    
    try {
      // Initialize Redis client
      const redis = new Redis({
        url: c.env.UPSTASH_REDIS_URL,
        token: c.env.UPSTASH_REDIS_TOKEN,
      });
    
      // Add timestamp to message if it's an object
      const messageToPublish = typeof message === 'object' && message !== null
        ? { ...message, timestamp: Date.now() }
        : message;
      
      // Publish message to channel
      await redis.publish(channel, messageToPublish);
      
      return c.json({
        success: true,
        message: `Message published to ${channel} successfully`,
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('Redis connection error:', error);
      return c.json(
        {
          success: false,
          error: `Redis connection error: ${error.message}`
        },
        500
      );
    }
  } catch (error: any) {
    console.error('Error publishing message:', error);
    return c.json(
      {
        success: false,
        error: `Failed to publish message: ${error.message}`
      },
      500
    );
  }
});

// Add Todo API endpoints
api.post('/api/todo/counter', async (c) => {
  try {
    const data = await c.req.json();
    
    // Validate counter data
    if (data.start === undefined || data.end === undefined) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: start, end'
        },
        400
      );
    }
    
    // Create counter message
    const message: CounterMessage = {
      type: 'counter',
      timestamp: Date.now(),
      data: {
        start: data.start,
        end: data.end,
        step: data.step || 1
      }
    };
    
    // Validate counter range
    if (message.data.end - message.data.start > 10000) {
      return c.json(
        {
          success: false,
          error: 'Counter range too large (max 10000 iterations)'
        },
        400
      );
    }
    
    // Send to todo queue
    await c.env.TODO_QUEUE.send(message);
    
    return c.json({
      success: true,
      message: 'Counter job queued successfully',
      id: `counter-${message.timestamp}`,
      range: `${message.data.start} to ${message.data.end} (step: ${message.data.step})`
    });
  } catch (error: any) {
    console.error('Error queueing counter job:', error);
    return c.json(
      {
        success: false,
        error: `Failed to queue counter job: ${error.message}`
      },
      500
    );
  }
});

api.post('/api/todo/task', async (c) => {
  try {
    const data = await c.req.json();
    
    // Validate task data
    if (!data.title) {
      return c.json(
        {
          success: false,
          error: 'Missing required field: title'
        },
        400
      );
    }
    
    // Create task message
    const message: TaskMessage = {
      type: 'task',
      timestamp: Date.now(),
      data: {
        title: data.title,
        description: data.description,
        due_date: data.due_date,
        priority: data.priority || 'medium',
        completed: false
      }
    };
    
    // Send to todo queue
    await c.env.TODO_QUEUE.send(message);
    
    return c.json({
      success: true,
      message: 'Task queued successfully',
      id: `task-${message.timestamp}`,
      title: message.data.title
    });
  } catch (error: any) {
    console.error('Error queueing task:', error);
    return c.json(
      {
        success: false,
        error: `Failed to queue task: ${error.message}`
      },
      500
    );
  }
});

// Error handling for routes that don't exist
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      '/health',
      '/docs',
      '/api/todo/counter', 
      '/api/todo/task',
      '/api/todo/reminder',
      '/publish'
    ]
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error(`Unhandled error: ${err.message}`);
  return c.json({
    success: false,
    error: 'Internal server error',
    message: err.message
  }, 500);
});

// Export default worker fetch handler
export default {
  fetch: app.fetch,
};