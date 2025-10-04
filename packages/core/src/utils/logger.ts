/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple structured logger for adapter system
 * Can be extended to integrate with winston/pino in the future
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  [key: string]: any;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  constructor() {
    // Read log level from environment
    const envLevel = process.env['GEMINI_CLI_LOG_LEVEL']?.toUpperCase();
    if (envLevel === 'DEBUG') this.level = LogLevel.DEBUG;
    else if (envLevel === 'INFO') this.level = LogLevel.INFO;
    else if (envLevel === 'WARN') this.level = LogLevel.WARN;
    else if (envLevel === 'ERROR') this.level = LogLevel.ERROR;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (level < this.level) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';

    // Format: [timestamp] LEVEL message {context}
    const logLine = `[${timestamp}] ${levelName} ${message}${contextStr}`;

    // Use appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(logLine);
        break;
      case LogLevel.WARN:
        console.warn(logLine);
        break;
      case LogLevel.ERROR:
        console.error(logLine);
        break;
    }
  }
}

export const logger = new Logger();
