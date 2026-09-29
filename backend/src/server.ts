import { loadDotEnvFile } from './config/dotenv.js';
import { loadEnv } from './config/env.js';
import { buildApp } from './http/app.js';

// Read .env before the configuration is parsed. Variables already set in the
// real environment take precedence, so a deployment's injected credentials
// always win over a file.
const dotenv = loadDotEnvFile();

const env = loadEnv();

const app = await buildApp({ env });

app.log.info(
  { path: dotenv.path, loaded: dotenv.loaded, reason: dotenv.reason },
  dotenv.loaded ? 'loaded configuration from .env' : 'starting without a .env file',
);

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
