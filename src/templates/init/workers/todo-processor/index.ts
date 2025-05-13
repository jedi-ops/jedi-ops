/**
 * Todo Processor Worker
 * 
 * A simple example worker that processes todo items from a queue.
 * This demonstrates how to set up a worker with modular processing logic
 * and various processing patterns.
 * 
 * EXTENDING THIS PATTERN:
 * 1. Add new message types to the TodoMessage type union
 * 2. Create processor functions for each message type
 * 3. Update the todoProcessors object with your new handlers
 * 4. Register the processor in the main queue handler
 */

// Define environment variables and bindings
export interface Env {
  // Queue binding - will be created during project setup
  TODO_QUEUE: Queue;
  
  // Environment variables
  AUTH_KEY: string;
  UPSTASH_REDIS_URL?: string;
  UPSTASH_REDIS_TOKEN?: string;
}

/**
 * MESSAGE TYPE DEFINITIONS
 * Define your message types here with clear interfaces for type safety
 */

// Base message type with common fields
export interface BaseMessage {
  id?: string;
  timestamp?: number;
  retry_count?: number;
}

// Counter message for our simple counter example
export interface CounterMessage extends BaseMessage {
  type: 'counter';
  data: {
    start: number;
    end: number;
    step?: number;
  };
}

// Task message for processing to-do tasks
export interface TaskMessage extends BaseMessage {
  type: 'task';
  data: {
    title: string;
    description?: string;
    due_date?: string;
    priority?: 'high' | 'medium' | 'low';
    completed?: boolean;
  };
}

// Union type of all supported message types - add new message types here
export type TodoMessage = CounterMessage | TaskMessage;

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

/**
 * ERROR HANDLING
 * Custom error classes for better error handling and retry logic
 */
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
 * PROCESSOR FUNCTIONS
 * Each processor handles a specific message type
 */

// Counter processor with simple for loop example
async function processCounter(message: CounterMessage, env: Env): Promise<void> {
  console.log(`Processing counter from ${message.data.start} to ${message.data.end}`);
  
  // Validate counter data
  if (message.data.start === undefined || message.data.end === undefined) {
    throw new ValidationError('Counter message missing start or end values');
  }
  
  const start = message.data.start;
  const end = message.data.end;
  const step = message.data.step || 1;
  
  // Validate that the counter range is reasonable
  if (end - start > 10000) {
    throw new ValidationError('Counter range too large (max 10000 iterations)');
  }
  
  // Simple counter loop - replace with your actual processing logic
  console.log(`Starting counter loop from ${start} to ${end} with step ${step}`);
  const startTime = Date.now();
  
  for (let i = start; i <= end; i += step) {
    // Simple processing simulation
    if (i % 100 === 0) {
      console.log(`Counter at ${i}`);
    }
  }
  
  const duration = Date.now() - startTime;
  console.log(`Counter completed in ${duration}ms`);
}

// Task processor for handling todo tasks
async function processTask(message: TaskMessage, env: Env): Promise<void> {
  console.log(`Processing task: ${message.data.title}`);
  
  // Validate task data
  if (!message.data.title) {
    throw new ValidationError('Task message missing title');
  }
  
  // Process based on task properties
  if (message.data.priority === 'high') {
    console.log(`Processing high priority task: ${message.data.title}`);
    // Add your high priority task processing logic here
  } else {
    console.log(`Processing regular task: ${message.data.title}`);
    // Add your regular task processing logic here
  }
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 50));
  
  console.log(`Task processed: ${message.data.title}`);
  
  // Example of how you might mark a task as completed in a database
  // if (env.DATABASE_URL) {
  //   try {
  //     // Update task in database
  //     // await updateTaskStatus(message.data.id, true);
  //   } catch (error) {
  //     throw new ProcessingError(`Failed to update task: ${error.message}`);
  //   }
  // }
}

/**
 * PROCESSOR REGISTRY
 * Register all message processors here to make them available to the queue handler
 */
const todoProcessors = {
  counter: processCounter,
  task: processTask,
  
  // Add your processors here:
  // your_type: yourProcessorFunction,
};

/**
 * QUEUE HANDLER
 * Main worker entry point that processes messages from the queue
 */
export default {
  async queue(batch: MessageBatch<TodoMessage>, env: Env): Promise<void> {
    console.log(`Processing batch of ${batch.messages.length} todo messages`);
    
    for (const message of batch.messages) {
      // Track processing start time for metrics
      const startTime = Date.now();
      
      try {
        console.log(`Processing message ${message.id} of type: ${message.body.type}`);
        
        // Add a unique ID and timestamp if not present
        if (!message.body.id) {
          message.body.id = `todo-${message.id.substring(0, 8)}-${Date.now()}`;
        }
        if (!message.body.timestamp) {
          message.body.timestamp = Date.now();
        }
        
        // Track retry count
        const retryCount = message.body.retry_count || 0;
        message.body.retry_count = retryCount + 1;
        
        // Route message to the appropriate processor based on type
        const processor = todoProcessors[message.body.type as keyof typeof todoProcessors];
        
        if (!processor) {
          console.warn(`Unknown message type: ${message.body.type}`);
          // We ack unknown types to avoid clogging the queue
          message.ack();
          continue;
        }
        
        // Process the message with the appropriate handler
        await processor(message.body as any, env);
        
        // Calculate processing time
        const processingTime = Date.now() - startTime;
        console.log(`Successfully processed message ${message.id} in ${processingTime}ms`);
        
        // Acknowledge successful processing
        message.ack();
      } catch (error: any) {
        const processingTime = Date.now() - startTime;
        console.error(`Error processing message ${message.id} after ${processingTime}ms:`, error);
        
        // Handle different error types with different retry strategies
        if (error instanceof ValidationError) {
          console.error(`Validation error (not retrying): ${error.message}`);
          // Don't retry validation errors
          message.ack();
        } else if (error instanceof ProcessingError && !error.retryable) {
          console.error(`Non-retryable error: ${error.message}`);
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