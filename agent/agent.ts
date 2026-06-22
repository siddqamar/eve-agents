import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const localLlama = createOpenAICompatible({
  name: "llama-cpp",
  baseURL: process.env.LLAMA_ENDPOINT ?? "http://localhost:8080/v1",
});

const modelContextWindowTokens = Number.parseInt(
  process.env.LLAMA_CONTEXT_WINDOW_TOKENS ?? "8192",
  10,
);

export default defineAgent({
  model: localLlama.chatModel("LiquidAI/LFM2.5-350M-GGUF:Q4_K_M"),
  modelContextWindowTokens: Number.isFinite(modelContextWindowTokens)
    ? modelContextWindowTokens
    : 8192,
  compaction: {
    thresholdPercent: 0.75,
  },
});
