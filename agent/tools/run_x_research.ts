import { defineTool } from "eve/tools";
import { never } from "eve/tools/approval";
import { z } from "zod";

import { runXResearch } from "../lib/research.js";

export default defineTool({
  needsApproval: never(),
  description:
    "Search recent public X/Twitter posts for a topic, analyze them in batches, and write a CSV report to disk.",
  inputSchema: z.object({
    query: z.string().min(1).describe("The X/Twitter search topic or keyword."),
    maxPosts: z
      .number()
      .int()
      .positive()
      .max(1000)
      .default(25)
      .describe("Maximum number of posts to scrape and analyze."),
    batchSize: z
      .number()
      .int()
      .positive()
      .max(50)
      .default(10)
      .describe("Number of posts to send to local inference per batch."),
  }),
  async execute(input) {
    return runXResearch(input);
  },
});
