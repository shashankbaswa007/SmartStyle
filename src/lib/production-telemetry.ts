import { logger } from '@/lib/logger';

interface CounterContext {
  [key: string]: string | number | boolean | null | undefined;
}

export function incrementProductionCounter(
  name: string,
  value = 1,
  context: CounterContext = {}
): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  logger.info('telemetry_counter', {
    name,
    value,
    ...context,
  });
}
