import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { analyzeBatch } from "./llama.js";
import { getDatasetItems, startActorRun, waitForRun } from "./apify.js";
import type { AnalyzedPost, NormalizedPost, RawPost } from "./types.js";
import { normalizePost } from "./types.js";

const DEFAULT_ACTOR_ID = "scrape.badger~twitter-tweets-scraper";
const DEFAULT_MAX_POSTS = 25;
const DEFAULT_BATCH_SIZE = 10;

function toInt(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value ?? Number.NaN)) return fallback;
  const rounded = Math.trunc(value ?? fallback);
  return Math.min(max, Math.max(min, rounded));
}

function sanitizeFilePart(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug.slice(0, 48) || "x-research";
}

function parseDate(value: string): number {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function sortLatestFirst(posts: NormalizedPost[]): NormalizedPost[] {
  return [...posts].sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function csvEscape(value: string): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function toCsv(posts: AnalyzedPost[]): string {
  const header = [
    "author",
    "url",
    "createdAt",
    "techStack",
    "problemStatement",
    "solutionOffered",
    "likes",
    "comments",
    "reposts",
    "bookmarks",
  ];

  const rows = posts.map((post) =>
    [
      post.author,
      post.url,
      post.createdAt,
      post.techStack,
      post.problemStatement,
      post.solutionOffered,
      post.likes,
      post.comments,
      post.reposts,
      post.bookmarks,
    ]
      .map((value) => csvEscape(String(value ?? "N/A")))
      .join(","),
  );

  return [header.join(","), ...rows].join("\n");
}

function summarizeTechStacks(posts: AnalyzedPost[]): string[] {
  const counts = new Map<string, number>();

  for (const post of posts) {
    for (const part of post.techStack.split(",")) {
      const stack = part.trim();
      if (!stack || stack === "N/A") continue;
      counts.set(stack, (counts.get(stack) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([stack, count]) => `${stack} (${count})`);
}

export interface ResearchRunOptions {
  query: string;
  maxPosts?: number;
  batchSize?: number;
}

export interface ResearchRunResult {
  query: string;
  actorId: string;
  totalFetched: number;
  analyzedCount: number;
  csvPath: string;
  batches: number;
  latestPostAt: string;
  topTechStacks: string[];
}

export async function runXResearch({
  query,
  maxPosts = DEFAULT_MAX_POSTS,
  batchSize = DEFAULT_BATCH_SIZE,
}: ResearchRunOptions): Promise<ResearchRunResult> {
  const boundedMaxPosts = toInt(maxPosts, DEFAULT_MAX_POSTS, 1, 1000);
  const boundedBatchSize = toInt(batchSize, DEFAULT_BATCH_SIZE, 1, 50);

  const { runId, datasetId } = await startActorRun(DEFAULT_ACTOR_ID, {
    searchTerms: [query],
    maxItems: boundedMaxPosts,
  });

  await waitForRun(runId);

  const rawItems = await getDatasetItems<RawPost>(datasetId);
  const normalized = sortLatestFirst(rawItems.map(normalizePost)).slice(0, boundedMaxPosts);

  const analyzed: AnalyzedPost[] = [];
  const batches = chunk(normalized, boundedBatchSize);

  for (const batch of batches) {
    const result = await analyzeBatch(batch);
    analyzed.push(...result);
  }

  const outDir = path.resolve(process.cwd(), ".output", "x-research");
  await mkdir(outDir, { recursive: true });

  const safeQuery = sanitizeFilePart(query);
  const reportPath = path.join(outDir, `${safeQuery}-${Date.now()}.csv`);
  await writeFile(reportPath, toCsv(analyzed), "utf8");

  return {
    query,
    actorId: DEFAULT_ACTOR_ID,
    totalFetched: normalized.length,
    analyzedCount: analyzed.length,
    csvPath: reportPath,
    batches: batches.length,
    latestPostAt: normalized[0]?.createdAt ?? "N/A",
    topTechStacks: summarizeTechStacks(analyzed),
  };
}
