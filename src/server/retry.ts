import { setTimeout as sleep } from "node:timers/promises";

interface RetryOptions {
  attempts: number;
  delayMs: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

export async function retry<T>(task: () => Promise<T>, { attempts, delayMs, onRetry }: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts) throw error;
      onRetry?.(attempt, error);
      await sleep(delayMs);
    }
  }
}
