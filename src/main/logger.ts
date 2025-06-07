import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { LOGS_DIR } from './constants';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new DailyRotateFile({
      filename: `${LOGS_DIR}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxSize: '20m',
      maxFiles: '14d',
    }),
    new DailyRotateFile({
      filename: `${LOGS_DIR}/combined-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

// If we're not in production, also log to the console
if (process.env.NODE_ENV !== 'production') {
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  });
  
  // Handle EPIPE errors gracefully
  consoleTransport.on('error', (error) => {
    if ((error as any).code === 'EPIPE') {
      // Silently ignore EPIPE errors (broken pipe)
      return;
    }
    // Log other errors to stderr if possible
    console.error('Logger console transport error:', error);
  });
  
  logger.add(consoleTransport);
}

export default logger;
