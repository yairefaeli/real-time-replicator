import { LogLevel } from '@nestjs/common/services/logger.service.js';

const DEFAULT_LOG_LEVELS: LogLevel[] = ['log', 'error', 'warn', 'debug'];
const LOG_LEVELS: readonly LogLevel[] = [
  'log',
  'error',
  'warn',
  'debug',
  'verbose',
  'fatal',
];

export function parseLogLevels(): LogLevel[] {
  const rawLogLevels = process.env['LOG_LEVELS'];

  if (!rawLogLevels) {
    return DEFAULT_LOG_LEVELS;
  }

  const logLevels = rawLogLevels
    .split(',')
    .map((level) => level.trim())
    .filter((level) => level.length > 0);

  for (const level of logLevels) {
    if (!LOG_LEVELS.includes(level as LogLevel)) {
      throw new Error(
        `Invalid LOG_LEVELS value "${level}". Expected one of: ${LOG_LEVELS.join(', ')}.`,
      );
    }
  }

  return logLevels as LogLevel[];
}
