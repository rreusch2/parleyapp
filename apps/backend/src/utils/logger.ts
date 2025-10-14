import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Creates a logger instance with consistent formatting
 * @param service - Name of the service using the logger
 * @returns Winston logger instance
 */
export const createLogger = (service: string) => {
  return winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service },
    transports: [
      // Console transport for development
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(
            info => `${info.timestamp} ${info.level} [${info.service}]: ${info.message}`
          )
        )
      }),
      // File transport for all logs
      new winston.transports.File({ 
        filename: path.join(logDir, 'combined.log') 
      }),
      // File transport for error logs
      new winston.transports.File({ 
        filename: path.join(logDir, 'error.log'), 
        level: 'error' 
      }),
      // Service-specific logs
      new winston.transports.File({ 
        filename: path.join(logDir, `${service}.log`)
      })
    ]
  });
};

// Default logger for general application use
export const logger = createLogger('app'); 