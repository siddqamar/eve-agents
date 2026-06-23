/**
 * Apify REST API client.
 * Uses native fetch() (Node 24+). No external HTTP dependencies.
 */

const APIFY_BASE = "https://api.apify.com/v2";
const actorPath = "/actors/scrape.badger~twitter-tweets-scraper/runs";

function getApiKey(): string {
  const key = process.env.APIFY_API_KEY;
  if (!key || key === "your_apify_api_key_here") {
    throw new Error(
      "APIFY_API_KEY is not set. Replace the placeholder in .env or export a real Apify token before running the research workflow.",
    );
  }
  return key;
}

interface ActorRunResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

interface RunStatusResponse {
  data: {
    id: string;
    status: string;
    defaultDatasetId: string;
  };
}

/**
 * Start an Apify actor run and return its run ID + dataset ID.
 */
export async function startActorRun(
  actorId: string,
  input: Record<string, unknown>,
): Promise<{ runId: string; datasetId: string }> {
  const token = getApiKey();
  const url = `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Apify startActorRun failed (${res.status}): ${body}`,
    );
  }

  const json = (await res.json()) as ActorRunResponse;
  return {
    runId: json.data.id,
    datasetId: json.data.defaultDatasetId,
  };
}

/**
 * Poll an actor run until it reaches a terminal status.
 * Returns the final status and dataset ID.
 */
export async function waitForRun(
  runId: string,
  pollIntervalMs = 5000,
  maxWaitMs = 300_000,
): Promise<{ status: string; datasetId: string }> {
  const token = getApiKey();
  const url = `${APIFY_BASE}/actor-runs/${runId}?token=${token}`;
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Apify run status check failed (${res.status}): ${body}`,
      );
    }

    const json = (await res.json()) as RunStatusResponse;
    const { status, defaultDatasetId } = json.data;

    if (status === "SUCCEEDED") {
      return { status, datasetId: defaultDatasetId };
    }
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify actor run ${runId} ended with status: ${status}`);
    }

    // Still running — wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Apify actor run ${runId} did not complete within ${maxWaitMs / 1000}s`,
  );
}

/**
 * Fetch all items from an Apify dataset.
 */
export async function getDatasetItems<T = unknown>(
  datasetId: string,
): Promise<T[]> {
  const token = getApiKey();
  const url = `${APIFY_BASE}/datasets/${datasetId}/items?token=${token}&format=json&clean=true`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Apify getDatasetItems failed (${res.status}): ${body}`,
    );
  }

  return (await res.json()) as T[];
}
