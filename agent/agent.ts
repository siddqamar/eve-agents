import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { defineAgent } from "eve";

const localLlama = createOpenAICompatible({
  name: "llama-cpp",
  baseURL: process.env.LLAMA_ENDPOINT ?? "http://localhost:8080/v1",
});

export default defineAgent({
  model: localLlama.chatModel("openai/gpt-4o-mini"),
  compaction: {
    thresholdPercent: 0.75,
  },
});
