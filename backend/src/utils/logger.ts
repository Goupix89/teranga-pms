import winston from 'winston';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  config.isDev
    ? winston.format.combine(winston.format.colorize(), winston.format.simple())
    : winston.format.json()
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'hotel-pms-api' },
  transports: [
    new winston.transports.Console(),
    ...(config.isProd
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 10485760, maxFiles: 5 }),
          new winston.transports.File({ filename: 'logs/combined.log', maxsize: 10485760, maxFiles: 5 }),
        ]
      : []),
  ],
});
