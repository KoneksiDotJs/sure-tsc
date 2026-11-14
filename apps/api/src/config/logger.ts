export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, ...meta }));
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message, ...meta }));
    }
  },
  error(message: string, meta?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, ...meta }));
    }
  },
};
