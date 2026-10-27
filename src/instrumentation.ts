export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { prepareDatabase } = await import("./server/startup");
  await prepareDatabase();
}
