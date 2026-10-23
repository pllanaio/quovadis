import { WebsiteCheckError } from "./errors";
import type { WebsiteCheckStrategy } from "./types";
import type { PageSpeedResponse } from "./pagespeed-parser";

const PAGE_SPEED_ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const ANALYSIS_TIMEOUT_MS = 50_000;

async function readLimitedJson(response: Response, maxBytes = 6_000_000) {
  const declared = Number(response.headers.get("content-length") || "0");
  if (declared > maxBytes) {
    throw new WebsiteCheckError("UPSTREAM_RESPONSE_TOO_LARGE", "Der Analysedienst hat eine unerwartet große Antwort geliefert.", 502);
  }
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new WebsiteCheckError("UPSTREAM_RESPONSE_TOO_LARGE", "Der Analysedienst hat eine unerwartet große Antwort geliefert.", 502);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes)) as PageSpeedResponse;
  } catch (error) {
    if (error instanceof WebsiteCheckError) throw error;
    return null;
  } finally {
    reader.releaseLock();
  }
}

export async function fetchPageSpeed(
  normalizedUrl: string,
  strategy: WebsiteCheckStrategy,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = ANALYSIS_TIMEOUT_MS,
  apiKey?: string,
  signal?: AbortSignal,
) {
  const endpoint = new URL(PAGE_SPEED_ENDPOINT);
  endpoint.searchParams.set("url", normalizedUrl);
  endpoint.searchParams.set("strategy", strategy);
  if(apiKey) endpoint.searchParams.set("key", apiKey);
  for (const category of ["performance", "accessibility", "best-practices", "seo"]) {
    endpoint.searchParams.append("category", category);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(endpoint, {
      signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const data = await readLimitedJson(response);
    if (!response.ok || !data) {
      if (response.status === 429) {
        throw new WebsiteCheckError("UPSTREAM_RATE_LIMIT", "Der Analysedienst ist momentan ausgelastet. Bitte versuchen Sie es erneut.", 503);
      }
      if (response.status === 400 || response.status === 404) {
        throw new WebsiteCheckError("SITE_UNREACHABLE", "Die angegebene Website konnte nicht erreicht werden.", 422);
      }
      throw new WebsiteCheckError("PAGESPEED_ERROR", "Die Website konnte vom Analysedienst nicht vollständig geprüft werden.", 502);
    }
    if (data.error) {
      throw new WebsiteCheckError("PAGESPEED_ERROR", "Die Website konnte vom Analysedienst nicht vollständig geprüft werden.", 502);
    }
    return data;
  } catch (error) {
    if (error instanceof WebsiteCheckError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new WebsiteCheckError("ANALYSIS_TIMEOUT", "Die Analyse hat zu lange gedauert. Bitte versuchen Sie es erneut.", 504);
    }
    throw new WebsiteCheckError("PAGESPEED_UNAVAILABLE", "Der Analysedienst ist momentan nicht erreichbar. Bitte versuchen Sie es erneut.", 503);
  } finally {
    clearTimeout(timeout);
  }
}
