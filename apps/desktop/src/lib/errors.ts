export function formatErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message === "Failed to fetch" || message.includes("Network request failed")) {
    return "Backend is not reachable. Start the backend service, then try again.";
  }
  return message;
}
