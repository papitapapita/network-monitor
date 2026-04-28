import winston from 'winston';
import {
  ILogger,
  LogLevel,
  LogContext
} from '../../application/shared/interfaces/ILogger';

/**
 * WinstonLogger
 *
 * Concrete implementation of ILogger using Winston library.
 * Provides structured logging with multiple transports (console, file).
 */
export class WinstonLogger implements ILogger {
  private logger: winston.Logger;
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: context,
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, ...meta }) => {
                const metaStr =
                  Object.keys(meta).length > 0
                    ? JSON.stringify(meta, null, 2)
                    : '';
                return `${timestamp} [${level}]: ${message} ${metaStr}`;
              }
            )
          )
        })
      ]
    });

    // Add file transport in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error'
        })
      );
      this.logger.add(
        new winston.transports.File({
          filename: 'logs/combined.log'
        })
      );
    }
  }

  public debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { ...this.context, ...context });
  }

  public info(message: string, context?: LogContext): void {
    this.logger.info(message, { ...this.context, ...context });
  }

  public warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { ...this.context, ...context });
  }

  public error(
    message: string,
    error?: Error,
    context?: LogContext
  ): void {
    this.logger.error(message, {
      ...this.context,
      ...context,
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          }
        : undefined
    });
  }

  public fatal(
    message: string,
    error?: Error,
    context?: LogContext
  ): void {
    this.logger.error(message, {
      ...this.context,
      ...context,
      level: 'fatal',
      error: error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          }
        : undefined
    });
  }

  public child(context: LogContext): ILogger {
    return new WinstonLogger({ ...this.context, ...context });
  }

  public setLevel(level: LogLevel): void {
    this.logger.level = level;
  }
}
