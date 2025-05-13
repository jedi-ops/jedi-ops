/**
 * Todo Module
 * 
 * This file demonstrates how to create a modular system for handling
 * different types of messages in Jedi-Ops. You can use this pattern to
 * extend the system with your own message types and handlers.
 * 
 * EXTENDING THIS PATTERN:
 * 1. Add new message interfaces to define the structure of your messages
 * 2. Export utility functions to create properly formatted messages
 * 3. Add handler functions in your worker's processor
 */

// ===================================================================
// MESSAGE TYPE DEFINITIONS
// ===================================================================

/**
 * Base interface for all message types
 * All message types should extend this to ensure consistency
 */
export interface BaseMessage {
  id?: string;        // Optional unique identifier
  type: string;       // Message type - used for routing to correct handler
  timestamp?: number; // When the message was created
  retry_count?: number; // Used to track retry attempts
}

/**
 * Counter Message
 * A simple example that performs a counting operation
 */
export interface CounterMessage extends BaseMessage {
  type: 'counter';
  data: {
    start: number;
    end: number;
    step?: number;
  };
}

/**
 * Task Message
 * Represents a todo task to be processed
 */
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

/**
 * Reminder Message
 * Example of extending the system with a new message type
 */
export interface ReminderMessage extends BaseMessage {
  type: 'reminder';
  data: {
    message: string;
    user_id: string;
    scheduled_for: string;
    send_email?: boolean;
    send_push?: boolean;
  };
}

// Union type of all supported message types
// Add your new message types to this union to get TypeScript support
export type TodoMessage = CounterMessage | TaskMessage | ReminderMessage;

// ===================================================================
// MESSAGE CREATION UTILITIES
// ===================================================================

/**
 * Creates a properly formatted counter message
 * 
 * @example
 * const message = createCounter(1, 100, 2);
 * await env.TODO_QUEUE.send(message);
 */
export function createCounter(start: number, end: number, step: number = 1): CounterMessage {
  // Validate inputs
  if (typeof start !== 'number' || typeof end !== 'number') {
    throw new Error('Start and end must be numbers');
  }
  
  if (end - start > 10000) {
    throw new Error('Counter range too large (max 10000 iterations)');
  }
  
  return {
    type: 'counter',
    timestamp: Date.now(),
    data: {
      start,
      end,
      step
    }
  };
}

/**
 * Creates a properly formatted task message
 * 
 * @example
 * const message = createTask("Complete project", "High priority task", "high");
 * await env.TODO_QUEUE.send(message);
 */
export function createTask(
  title: string,
  description?: string,
  priority: 'high' | 'medium' | 'low' = 'medium',
  due_date?: string
): TaskMessage {
  // Validate inputs
  if (!title) {
    throw new Error('Task title is required');
  }
  
  return {
    type: 'task',
    timestamp: Date.now(),
    data: {
      title,
      description,
      priority,
      due_date,
      completed: false
    }
  };
}

/**
 * Creates a properly formatted reminder message
 * 
 * @example
 * const message = createReminder("Meeting reminder", "user123", "2023-12-31T12:00:00Z", true);
 * await env.TODO_QUEUE.send(message);
 */
export function createReminder(
  message: string,
  user_id: string,
  scheduled_for: string,
  send_email: boolean = false,
  send_push: boolean = true
): ReminderMessage {
  // Validate inputs
  if (!message || !user_id) {
    throw new Error('Reminder message and user_id are required');
  }
  
  // Validate date format
  if (scheduled_for && isNaN(Date.parse(scheduled_for))) {
    throw new Error('Invalid date format for scheduled_for');
  }
  
  return {
    type: 'reminder',
    timestamp: Date.now(),
    data: {
      message,
      user_id,
      scheduled_for,
      send_email,
      send_push
    }
  };
}

// ===================================================================
// HOW TO EXTEND THIS SYSTEM
// ===================================================================

/**
 * EXTENDING WITH YOUR OWN MESSAGE TYPES:
 * 
 * 1. Define a new message interface:
 *    
 *    export interface EmailMessage extends BaseMessage {
 *      type: 'email';
 *      data: {
 *        to: string;
 *        subject: string;
 *        body: string;
 *        // Add any other fields you need
 *      };
 *    }
 * 
 * 2. Add your new type to the TodoMessage union:
 *    
 *    export type TodoMessage = CounterMessage | TaskMessage | ReminderMessage | EmailMessage;
 * 
 * 3. Create a utility function to generate messages:
 *    
 *    export function createEmail(to: string, subject: string, body: string): EmailMessage {
 *      return {
 *        type: 'email',
 *        timestamp: Date.now(),
 *        data: {
 *          to,
 *          subject,
 *          body
 *        }
 *      };
 *    }
 * 
 * 4. Add a handler in your worker (src/workers/todo-processor/index.ts):
 *    
 *    async function processEmail(message: EmailMessage, env: Env): Promise<void> {
 *      // Your email processing logic here
 *    }
 * 
 * 5. Register your handler in the todoProcessors object:
 *    
 *    const todoProcessors = {
 *      counter: processCounter,
 *      task: processTask,
 *      reminder: processReminder,
 *      email: processEmail  // Add your new processor here
 *    };
 * 
 * 6. Create an API endpoint to use your new message type:
 * 
 *    app.post('/api/email', async (c) => {
 *      // Extract data from request
 *      const { to, subject, body } = await c.req.json();
 *      
 *      // Create and send the message
 *      const message = createEmail(to, subject, body);
 *      await c.env.TODO_QUEUE.send(message);
 *      
 *      return c.json({ success: true });
 *    });
 */