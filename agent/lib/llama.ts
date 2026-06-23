/**
 * llama.cpp HTTP client.
 * Targets the OpenAI-compatible /v1/chat/completions endpoint.
 */

import type { AnalyzedPost, NormalizedPost } from "./types.js";

function getEndpoint(): string {
  return process.env.LLAMA_ENDPOINT ?? "http://localhost:8080/v1";
}

/**
 * The structured system prompt for per-batch analysis.
 * Tightly constrained to prevent token blowout and enforce JSON output.
 */
function buildSystemPrompt(postCount: number): string {
  return `You are a structured data extractor. Analyze the following X/Twitter posts and extract information into a strict JSON array. Output ONLY valid JSON — no commentary, no markdown fences, no explanation, no trailing text.

Each post must be extracted into this exact schema:
{
  "author": "string (author name or handle from the post metadata)",
  "url": "string (the post URL from metadata)",
  "createdAt": "string (post timestamp from metadata, or N/A if missing)",
  "techStack": "string (comma-separated tools, frameworks, or languages discussed — e.g. LangChain, CrewAI, Python — or N/A if none mentioned)",
  "problemStatement": "string (the core pain point or task the author is trying to automate or solve, max 80 words, or N/A)",
  "solutionOffered": "string (how the author addressed the problem, max 80 words, or N/A)",
  "likes": "string (number from metadata, or N/A)",
  "comments": "string (number from metadata, or N/A)",
  "reposts": "string (number from metadata, or N/A)",
  "bookmarks": "string (number from metadata, or N/A)"
}

Rules:
- Output a JSON array of exactly ${postCount} objects.
- If a field's data is missing or you cannot determine it, use "N/A".
- Do NOT wrap the output in markdown code fences.
- Do NOT add any text before or after the JSON array.
- Keep problemStatement and solutionOffered concise (max 80 words each).
- techStack should only list specific tools, frameworks, languages, or platforms.`;
}

/**
 * Build the user message with minified post data to reduce token usage.
 */
function buildUserMessage(posts: NormalizedPost[]): string {
  // Strip down to only essential fields, minified
  const minimal = posts.map((p) => ({
    a: p.author,
    u: p.url,
    d: p.createdAt,
    t: p.text.slice(0, 500), // cap text at 500 chars to prevent blowout
    l: p.likes,
    c: p.comments,
    r: p.reposts,
    b: p.bookmarks,
  }));

  return `Analyze these ${posts.length} X/Twitter posts. Field key: a=author, u=url, t=text, l=likes, c=comments, r=reposts, b=bookmarks.\n\n${JSON.stringify(minimal)}`;
}

/**
 * Parse the llama.cpp response, extracting the JSON array.
 * Handles common LLM output quirks (markdown fences, trailing text).
 */
function parseAnalysisResponse(raw: string): AnalyzedPost[] {
  let cleaned = raw.trim();

  // Strip markdown code fences if present despite instructions
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  }

  // Find the JSON array boundaries
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) {
    throw new Error("llama.cpp response does not contain a JSON array");
  }

  cleaned = cleaned.slice(start, end + 1);

  const parsed: unknown = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error("llama.cpp response is not a JSON array");
  }

  // Validate and apply defaults
  return parsed.map((item: Record<string, unknown>) => ({
    author: String(item.author ?? "N/A"),
    url: String(item.url ?? "N/A"),
    createdAt: String(item.createdAt ?? "N/A"),
    techStack: String(item.techStack ?? "N/A"),
    problemStatement: String(item.problemStatement ?? "N/A"),
    solutionOffered: String(item.solutionOffered ?? "N/A"),
    likes: String(item.likes ?? "N/A"),
    comments: String(item.comments ?? "N/A"),
    reposts: String(item.reposts ?? "N/A"),
    bookmarks: String(item.bookmarks ?? "N/A"),
  }));
}

/**
 * Send a batch of normalized posts to llama.cpp for analysis.
 * Returns typed AnalyzedPost[] with fallback defaults applied.
 */
export async function analyzeBatch(
  posts: NormalizedPost[],
): Promise<AnalyzedPost[]> {
  const endpoint = getEndpoint();
  const url = `${endpoint}/chat/completions`;

  const body = {
    messages: [
      { role: "system", content: buildSystemPrompt(posts.length) },
      { role: "user", content: buildUserMessage(posts) },
    ],
    temperature: 0.1, // low temp for deterministic extraction
    max_tokens: 4096,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(
      `llama.cpp request failed (${res.status}): ${errBody}`,
    );
  }

  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("llama.cpp returned an empty response");
  }

  return parseAnalysisResponse(content);
}
