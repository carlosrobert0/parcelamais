import { subscribeToPreApproval } from "./events";
import { errorSummary, logger } from "./logger";
import { findPreApproval } from "./repository";

const HEARTBEAT_MS = 15_000;
const encoder = new TextEncoder();

export function createSnapshotStream(preApprovalId: string, abortSignal: AbortSignal): ReadableStream<Uint8Array> {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  let unsubscribe: (() => Promise<void>) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let queue = Promise.resolve();

  function write(text: string) {
    if (!closed) controller.enqueue(encoder.encode(text));
  }

  async function stopListening() {
    await unsubscribe?.().catch((error) => logger.warn({ preApprovalId, ...errorSummary(error) }, "could not unsubscribe from pre-approval"));
  }

  async function close() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    await stopListening();
    try {
      controller.close();
    } catch {}
  }

  async function sendSnapshot() {
    const snapshot = await findPreApproval(preApprovalId);
    if (!snapshot) return close();
    write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
    if (snapshot.status === "completed") await close();
  }

  function enqueueSnapshot() {
    queue = queue.then(sendSnapshot).catch((error) => {
      logger.error({ preApprovalId, ...errorSummary(error) }, "snapshot stream failed");
      return close();
    });
  }

  return new ReadableStream({
    async start(streamController) {
      controller = streamController;
      if (abortSignal.aborted) return close();
      abortSignal.addEventListener("abort", () => void close(), { once: true });

      try {
        unsubscribe = await subscribeToPreApproval(preApprovalId, enqueueSnapshot);
      } catch (error) {
        logger.error({ preApprovalId, ...errorSummary(error) }, "could not subscribe to pre-approval");
        return close();
      }

      if (closed) return stopListening();
      heartbeat = setInterval(enqueueSnapshot, HEARTBEAT_MS);
    },
    cancel: close,
  });
}
