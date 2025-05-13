/**
 * Dispatch Processor Worker
 * 
 * This worker processes messages from the dispatch queue and routes them
 * to the appropriate handler based on the message type.
 */

// Define environment variables and bindings
export interface Env {
  // Cloudflare Queue binding
  DISPATCH_QUEUE: Queue;
  
  // Environment variables
  AUTH_KEY: string;
  UPSTASH_REDIS_URL?: string;
  UPSTASH_REDIS_TOKEN?: string;
  
  // Add your service API keys or other secrets here
  // EMAIL_API_KEY?: string;
  // SMS_API_KEY?: string;
}

// Define message interfaces for better type safety
export interface BaseMessage {
  type: string;
  timestamp?: number;
  retry_count?: number;
}

export interface EmailMessage extends BaseMessage {
  type: 'email';
  data: {
    to: string;
    subject: string;
    body: string;
    from?: string;
    cc?: string[];
    bcc?: string[];
    attachments?: Array<{name: string, content: string, encoding?: string}>;
  };
}

export interface NotificationMessage extends BaseMessage {
  type: 'notification';
  data: {
    userId: string;
    channel: string;
    title: string;
    body: string;
    priority?: 'high' | 'normal' | 'low';
    data?: Record<string, unknown>;
  };
}

export interface DataSyncMessage extends BaseMessage {
  type: 'data_sync';
  data: {
    entity: string;
    action: 'create' | 'update' | 'delete';
    id: string;
    payload?: Record<string, unknown>;
  };
}

// Union type of all supported message types
export type DispatchMessage = EmailMessage | NotificationMessage | DataSyncMessage;

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

// Set up error classes for better error handling
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

class ServiceError extends Error {
  retryable: boolean;
  
  constructor(message: string, retryable = true) {
    super(message);
    this.name = 'ServiceError';
    this.retryable = retryable;
  }
}

// Message processors
const messageProcessors = {
  // Email processor
  async email(message: EmailMessage, env: Env): Promise<void> {
    console.log(`Processing email to: ${message.data.to}`);
    
    // Validate email data
    if (!message.data.to || !message.data.subject || !message.data.body) {
      throw new ValidationError('Missing required email fields');
    }
    
    // This is where you'd integrate with your email service
    // Example:
    // const emailService = new EmailService(env.EMAIL_API_KEY);
    // await emailService.send({
    //   to: message.data.to,
    //   subject: message.data.subject,
    //   body: message.data.body,
    //   from: message.data.from,
    //   cc: message.data.cc,
    //   bcc: message.data.bcc,
    //   attachments: message.data.attachments
    // });
    
    console.log('Email processed successfully');
  },
  
  // Notification processor
  async notification(message: NotificationMessage, env: Env): Promise<void> {
    console.log(`Processing notification for user: ${message.data.userId}`);
    
    // Validate notification data
    if (!message.data.userId || !message.data.title) {
      throw new ValidationError('Missing required notification fields');
    }
    
    // This is where you'd send the notification
    // Example with different channels:
    switch (message.data.channel) {
      case 'push':
        // await pushNotificationService.send(message.data);
        break;
      case 'sms':
        // await smsService.send(message.data.userId, message.data.body);
        break;
      case 'in_app':
        // Store in database for retrieval by client
        // await db.notifications.insert({ ...message.data });
        break;
      default:
        console.log(`Unknown notification channel: ${message.data.channel}`);
    }
    
    console.log('Notification processed successfully');
  },
  
  // Data sync processor
  async data_sync(message: DataSyncMessage, env: Env): Promise<void> {
    console.log(`Processing data sync for ${message.data.entity} id: ${message.data.id}`);
    
    // Validate sync data
    if (!message.data.entity || !message.data.action || !message.data.id) {
      throw new ValidationError('Missing required data sync fields');
    }
    
    // Handle different sync actions
    switch (message.data.action) {
      case 'create':
      case 'update':
        if (!message.data.payload) {
          throw new ValidationError('Payload required for create/update actions');
        }
        // await syncService.upsert(message.data.entity, message.data.id, message.data.payload);
        break;
      case 'delete':
        // await syncService.delete(message.data.entity, message.data.id);
        break;
    }
    
    console.log('Data sync processed successfully');
  }
};

// Default export with queue handler
export default {
  // This function processes messages from the queue
  async queue(batch: MessageBatch<DispatchMessage>, env: Env): Promise<void> {
    console.log(`Processing batch of ${batch.messages.length} messages`);
    
    for (const message of batch.messages) {
      // Track processing start time for metrics
      const startTime = Date.now();
      
      try {
        console.log(`Processing message ${message.id} of type: ${message.body.type}`);
        
        // Route message to the appropriate processor based on type
        const processor = messageProcessors[message.body.type as keyof typeof messageProcessors];
        
        if (!processor) {
          console.warn(`Unknown message type: ${message.body.type}`);
          // We ack unknown types to avoid clogging the queue
          message.ack();
          continue;
        }
        
        // Process the message
        await processor(message.body as any, env);
        
        // Calculate processing time
        const processingTime = Date.now() - startTime;
        console.log(`Successfully processed message ${message.id} in ${processingTime}ms`);
        
        // Acknowledge successful processing
        message.ack();
      } catch (error: any) {
        const processingTime = Date.now() - startTime;
        console.error(`Error processing message ${message.id} after ${processingTime}ms:`, error);
        
        // Increment retry count if we can
        const retryMessage = message.body as BaseMessage;
        const retryCount = (retryMessage.retry_count || 0) + 1;
        
        // Handle different error types
        if (error.name === 'ValidationError') {
          console.error(`Validation error: ${error.message}`);
          // Don't retry validation errors, they won't succeed
          message.ack();
        } else if (error instanceof ServiceError && !error.retryable) {
          console.error(`Non-retryable service error: ${error.message}`);
          message.ack();
        } else {
          console.error(`Retryable error: ${error.message}`);
          // If the message has a retry_count, we can decide how to handle based on count
          if (retryCount > 5) {
            console.error(`Message ${message.id} exceeded retry limit (${retryCount}), not retrying`);
            message.ack();
            
            // Here you could also send to a dead letter queue or alert system
            // await notifyFailure(message.body, error);
          } else {
            // Update the retry count for the next attempt
            // Note: Cloudflare Queues doesn't support modifying messages on retry
            // This is just to illustrate the pattern
            console.log(`Retrying message ${message.id} (attempt ${retryCount})`);
            message.retry();
          }
        }
      }
    }
  }
};