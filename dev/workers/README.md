# Queue Workers

Cloudflare Queues are currently disabled in this project.

To enable queue processing:

1. Update wrangler.toml to uncomment and configure the queue bindings
2. Run `jedi-ops add queue-consumer --name your-processor-name`
