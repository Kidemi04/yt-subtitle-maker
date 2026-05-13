/**
 * Provider presets — the curated list shown in the "+ Add provider" picker.
 *
 * Each entry is one preset the user can click to prefill a new
 * `TranslatorProfile`'s `name` + `baseUrl`. "Custom…" is the escape hatch:
 * an empty `name` + `baseUrl` means the form opens blank.
 *
 * Single source of truth for the preset list; `ProviderRow.tsx` re-exports
 * this so existing imports keep working, and `AddProviderModal.tsx` (Task 4)
 * pulls from the same const.
 */

export interface ProviderPreset {
  label: string;
  name: string;
  baseUrl: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  { label: "DeepSeek", name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1" },
  { label: "Groq", name: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
  { label: "OpenRouter", name: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  { label: "Together", name: "Together", baseUrl: "https://api.together.xyz/v1" },
  { label: "Mistral", name: "Mistral", baseUrl: "https://api.mistral.ai/v1" },
  { label: "xAI", name: "xAI", baseUrl: "https://api.x.ai/v1" },
  { label: "Fireworks", name: "Fireworks", baseUrl: "https://api.fireworks.ai/inference/v1" },
  { label: "OpenAI", name: "OpenAI", baseUrl: "https://api.openai.com/v1" },
  { label: "Custom…", name: "", baseUrl: "" },
];
