export const logger = {
  info: (message: string, metadata?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', message, ...metadata }));
  },
  error: (message: string, metadata?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', message, ...metadata }));
  }
};
