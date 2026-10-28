import { describe, expect, it, vi } from "vitest";
import { retry } from "./retry";

describe("retry", () => {
  it("returns as soon as the task succeeds", async () => {
    const task = vi.fn().mockRejectedValueOnce(new Error("not ready")).mockResolvedValueOnce("done");
    const onRetry = vi.fn();
    await expect(retry(task, { attempts: 3, delayMs: 0, onRetry })).resolves.toBe("done");
    expect(task).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it("gives up after the last attempt and rethrows the error", async () => {
    const task = vi.fn().mockRejectedValue(new Error("still down"));
    await expect(retry(task, { attempts: 3, delayMs: 0 })).rejects.toThrow("still down");
    expect(task).toHaveBeenCalledTimes(3);
  });
});
