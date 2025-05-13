// This file provides type definitions for Cloudflare Workers
// It's needed to prevent TypeScript errors in template files

interface Queue {
  send(message: any): Promise<void>;
  sendBatch(messages: any[]): Promise<void>;
}

interface MessageBatch<Body = unknown> {
  messages: {
    id: string;
    timestamp: number;
    body: Body;
    ack(): void;
    retry(): void;
  }[];
  queue: string;
}