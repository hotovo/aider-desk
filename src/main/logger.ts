import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

import { EventTransport } from './logger/event-transport';

import { LOGS_DIR } from '@/constants';
import { EventManager } from '@/events';

// Create event transport immediately to capture all logs since startup
export const eventTransport = new EventTransport();

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
    // Add event transport immediately to capture all logs from startup
    eventTransport,
  ],
});

// If we're not in production OR running in headless mode (Docker), also log to the console
if (process.env.NODE_ENV !== 'production' || process.env.AIDER_DESK_HEADLESS === 'true') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}

/**
 * Initialize event-based logging (call this after EventManager is available)
 */
export const initEventLogging = (eventManager: EventManager): void => {
  eventTransport.setEventManager(eventManager);
};

export default logger;
