/**
 * Raw post shape returned by the Apify twitter-tweets-scraper actor.
 * Fields are optional since the API may omit any of them.
 */
export interface RawPost {
  url?: string;
  tweetUrl?: string;
  author?: {
    name?: string;
    userName?: string;
  };
  authorName?: string;
  authorUserName?: string;
  fullText?: string;
  text?: string;
  full_text?: string;
  likeCount?: number;
  favorite_count?: number;
  replyCount?: number;
  reply_count?: number;
  retweetCount?: number;
  retweet_count?: number;
  bookmarkCount?: number;
  bookmark_count?: number;
  quoteCount?: number;
  createdAt?: string;
}

/**
 * Normalized post with only the fields we need, extracted from RawPost.
 */
export interface NormalizedPost {
  author: string;
  url: string;
  text: string;
  likes: string;
  comments: string;
  reposts: string;
  bookmarks: string;
}

/**
 * Analyzed post after llama.cpp extraction.
 */
export interface AnalyzedPost {
  author: string;
  url: string;
  techStack: string;
  problemStatement: string;
  solutionOffered: string;
  likes: string;
  comments: string;
  reposts: string;
  bookmarks: string;
}

/**
 * Normalize a raw Apify post into a consistent shape.
 * Handles multiple field name conventions across Apify actor versions.
 */
export function normalizePost(raw: RawPost): NormalizedPost {
  const author =
    raw.author?.name ??
    raw.author?.userName ??
    raw.authorName ??
    raw.authorUserName ??
    "N/A";

  const url = raw.url ?? raw.tweetUrl ?? "N/A";

  const text = raw.fullText ?? raw.full_text ?? raw.text ?? "";

  const likes = String(
    raw.likeCount ?? raw.favorite_count ?? "N/A",
  );

  const comments = String(
    raw.replyCount ?? raw.reply_count ?? "N/A",
  );

  const reposts = String(
    raw.retweetCount ?? raw.retweet_count ?? "N/A",
  );

  const bookmarks = String(
    raw.bookmarkCount ?? raw.bookmark_count ?? "N/A",
  );

  return { author, url, text, likes, comments, reposts, bookmarks };
}
