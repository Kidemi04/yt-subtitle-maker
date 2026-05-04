import { ApiClient } from "@yt-subtitle-maker/api-client";

/**
 * Singleton API client. Backend URL defaults to the spec's 127.0.0.1:8000
 * — when Settings is wired up (Phase 11) the user-configured value will
 * call `apiClient.setBaseUrl(...)` so all callers see the new host.
 */
export const apiClient = new ApiClient("http://127.0.0.1:8000");
