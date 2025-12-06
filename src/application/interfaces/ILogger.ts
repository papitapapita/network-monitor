/**
 * ILogger Interface
 *
 * Abstraction for logging services used throughout the application layer.
 * This interface allows use cases to log without depending on specific
 * logging implementations (Winston, Bunyan, console, etc.).
 *
 * Following the Dependency Inversion Principle, use cases depend on this
 * abstraction rather than concrete logging implementations.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal'
}

export interface LogContext {
  [key: string]: any;
}

export interface ILogger {
  /**
   * Logs a debug message.
   * Used for detailed diagnostic information.
   *
   * @param message - The log message
   * @param context - Optional context data
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Logs an informational message.
   * Used for general informational messages about application flow.
   *
   * @param message - The log message
   * @param context - Optional context data
   */
  info(message: string, context?: LogContext): void;

  /**
   * Logs a warning message.
   * Used for potentially harmful situations that don't prevent operation.
   *
   * @param message - The log message
   * @param context - Optional context data
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Logs an error message.
   * Used for error events that might still allow the application to continue.
   *
   * @param message - The log message
   * @param error - Optional error object
   * @param context - Optional context data
   */
  error(message: string, error?: Error, context?: LogContext): void;

  /**
   * Logs a fatal error message.
   * Used for severe errors that cause application termination.
   *
   * @param message - The log message
   * @param error - Optional error object
   * @param context - Optional context data
   */
  fatal(message: string, error?: Error, context?: LogContext): void;

  /**
   * Creates a child logger with additional context.
   * Useful for adding consistent context across multiple log calls.
   *
   * @param context - Context to add to all logs from child logger
   * @returns New logger instance with additional context
   */
  child(context: LogContext): ILogger;

  /**
   * Sets the minimum log level.
   * Messages below this level will not be logged.
   *
   * @param level - The minimum log level
   */
  setLevel(level: LogLevel): void;
}
