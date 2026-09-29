import { loadEnv } from './config/env.js';
import { buildApp } from './http/app.js';

const env = loadEnv();

const app = await buildApp({ env });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error({ err: error }, 'failed to start');
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}
