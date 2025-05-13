/**
 * Queue Consumer Worker Template
 * 
 * This template provides a structure for processing messages from a Cloudflare Queue.
 * Customize it to handle your specific message types and processing logic.
 */

// Define environment variables and bindings
export interface Env {
  // Queue binding will be automatically added based on the queue name
  QUEUE_NAME_QUEUE: Queue;
  
  // Environment variables
  AUTH_KEY: string;
  UPSTASH_REDIS_URL?: string;
  UPSTASH_REDIS_TOKEN?: string;
  
  // Add your custom environment variables here
  // API_KEY?: string;
  // DATABASE_URL?: string;
}

// Message interface - customize this for your message types
export interface QueueMessage {
  id?: string;
  timestamp?: number;
  retry_count?: number;
  // Add your message fields here
  action?: string;
  entity?: string;
  data?: Record<string, unknown>;
}

// Define the message batch interface from Cloudflare
export interface MessageBatch<Body = unknown> {
  messages: {
    id: string;
    timestamp: number;
    body: Body;
    ack: () => void;
    retry: () => void;
  }[];
  queue: string;
}

// Error types for better error handling
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ProcessingError extends Error {
  retryable: boolean;
  
  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'ProcessingError';
    this.retryable = retryable;
  }
}

/**
 * Process a single message
 * This is where you'll put your business logic for handling messages
 */
async function processMessage(message: QueueMessage, env: Env): Promise<void> {
  console.log(`Processing message: ${JSON.stringify(message, null, 2)}`);
  
  // Validate message
  if (!message.action) {
    throw new ValidationError('Message is missing required "action" field');
  }
  
  // Process based on action
  switch (message.action) {
    case 'create':
      await handleCreate(message, env);
      break;
    case 'update':
      await handleUpdate(message, env);
      break;
    case 'delete':
      await handleDelete(message, env);
      break;
    default:
      throw new ValidationError(`Unknown action: ${message.action}`);
  }
}

/**
 * Handler functions for different message actions
 * Replace these with your actual implementation
 */
async function handleCreate(message: QueueMessage, env: Env): Promise<void> {
  console.log(`Creating ${message.entity} with data: ${JSON.stringify(message.data)}`);
  // Add your creation logic here
  
  // Example of error handling:
  // if (!message.data) {
  //   throw new ValidationError('No data provided for create action');
  // }
  
  // Example of external API call:
  // try {
  //   const response = await fetch('https://api.example.com/resource', {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'Authorization': `Bearer ${env.API_KEY}`
  //     },
  //     body: JSON.stringify(message.data)
  //   });
  //
  //   if (!response.ok) {
  //     const errorData = await response.json();
  //     throw new ProcessingError(`API error: ${errorData.message}`, 
  //       response.status !== 400 && response.status !== 422); // Only retry non-validation errors
  //   }
  // } catch (error) {
  //   if (error instanceof ProcessingError) {
  //     throw error;
  //   }
  //   throw new ProcessingError(`Failed to create resource: ${error.message}`);
  // }
}

async function handleUpdate(message: QueueMessage, env: Env): Promise<void> {
  console.log(`Updating ${message.entity} id ${message.data?.id} with data: ${JSON.stringify(message.data)}`);
  // Add your update logic here
}

async function handleDelete(message: QueueMessage, env: Env): Promise<void> {
  console.log(`Deleting ${message.entity} id ${message.data?.id}`);
  // Add your deletion logic here
}

export default {
  // This function processes messages from the queue
  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    console.log(`Processing batch of ${batch.messages.length} messages`);
    
    for (const message of batch.messages) {
      const startTime = Date.now();
      
      try {
        console.log(`Processing message with ID: ${message.id} (${new Date(message.timestamp).toISOString()})`);
        
        // Track retry count if available
        let retryCount = 0;
        if (message.body.retry_count !== undefined) {
          retryCount = message.body.retry_count;
          message.body.retry_count++;
        } else {
          message.body.retry_count = 1;
        }
        
        // Add a unique ID if not present
        if (!message.body.id) {
          message.body.id = `msg-${message.id.substring(0, 8)}-${Date.now()}`;
        }
        
        // Process the message
        await processMessage(message.body, env);
        
        // Processing time metrics
        const processingTime = Date.now() - startTime;
        console.log(`Successfully processed message ${message.id} in ${processingTime}ms`);
        
        // Acknowledge the message to remove it from the queue
        message.ack();
      } catch (error: any) {
        const processingTime = Date.now() - startTime;
        console.error(`Error processing message ${message.id} after ${processingTime}ms:`, error);
        
        // Handle different error types
        if (error instanceof ValidationError) {
          console.error(`Validation error (not retrying): ${error.message}`);
          // Don't retry validation errors
          message.ack();
        } else if (error instanceof ProcessingError && !error.retryable) {
          console.error(`Non-retryable processing error: ${error.message}`);
          message.ack();
        } else {
          // For retryable errors, implement backoff strategy
          const retryCount = message.body.retry_count || 0;
          if (retryCount >= 5) {
            console.error(`Message ${message.id} exceeded max retries (${retryCount}), not retrying`);
            message.ack();
            
            // Optionally log to a dead letter queue or monitoring system
            // await logFailedMessage(message.body, error.message, env);
          } else {
            console.log(`Retrying message ${message.id} (attempt ${retryCount + 1})`);
            message.retry();
          }
        }
      }
    }
  }
};