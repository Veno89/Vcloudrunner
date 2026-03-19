import { createApiLifecycle } from './bootstrap.js';

const lifecycle = createApiLifecycle();

process.on('SIGTERM', () => void lifecycle.shutdown('SIGTERM'));
process.on('SIGINT', () => void lifecycle.shutdown('SIGINT'));

void lifecycle.start();
