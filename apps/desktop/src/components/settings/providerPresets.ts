export interface ProviderPreset {
  label: string;
  name: string;
  baseUrl: string;
  description: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    label: "OpenRouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    description: "Routes OpenAI, Claude, DeepSeek, and many hosted models.",
  },
  {
    label: "Fireworks.ai",
    name: "Fireworks.ai",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    description: "Fast hosted open models through an OpenAI-compatible API.",
  },
  {
    label: "DeepSeek Platform",
    name: "DeepSeek Platform",
    baseUrl: "https://api.deepseek.com",
    description: "DeepSeek chat and reasoning models.",
  },
  {
    label: "OpenAI Platform",
    name: "OpenAI Platform",
    baseUrl: "https://api.openai.com/v1",
    description: "Official OpenAI model endpoint.",
  },
  {
    label: "Claude Platform",
    name: "Claude Platform",
    baseUrl: "https://api.anthropic.com/v1/",
    description: "Anthropic Claude through its OpenAI SDK compatibility layer.",
  },
  {
    label: "Custom",
    name: "",
    baseUrl: "",
    description: "Bring any OpenAI-compatible endpoint.",
  },
];
