import { randomUUID } from "node:crypto";
import { WebsiteCheckError } from "./errors";
import { buildFindings } from "./pagespeed-findings";
import type { ScoreKey, WebsiteCheckResult, WebsiteCheckStrategy, WebsiteMetric, WebsiteScore } from "./types";

const RESULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface LighthouseAudit {
  id?: string;
  title?: string;
  score?: number | null;
  numericValue?: number;
  displayValue?: string;
  details?: { overallSavingsMs?: number; overallSavingsBytes?: number };
}

export interface PageSpeedResponse {
  id?: string;
  loadingExperience?: { metrics?: Record<string, { percentile?: number; category?: string }> };
  originLoadingExperience?: { metrics?: Record<string, { percentile?: number; category?: string }> };
  lighthouseResult?: {
    finalUrl?: string;
    fetchTime?: string;
    categories?: Record<string, { score?: number | null }>;
    audits?: Record<string, LighthouseAudit>;
  };
  error?: { code?: number; message?: string };
}

function scoreStatus(value: number | null): Pick<WebsiteScore, "status" | "statusLabel"> {
  if (value === null) return { status: "unavailable", statusLabel: "Nicht verfügbar" };
  if (value >= 90) return { status: "very-good", statusLabel: "Sehr gut" };
  if (value >= 50) return { status: "improvement", statusLabel: "Verbesserungspotenzial" };
  return { status: "critical", statusLabel: "Kritisch" };
}

function buildScore(key: ScoreKey, label: string, raw: number | null | undefined): WebsiteScore {
  const value = typeof raw === "number" ? Math.round(Math.max(0, Math.min(1, raw)) * 100) : null;
  return { key, label, value, ...scoreStatus(value) };
}

function metricRating(value: number | null, good: number, poor: number, lowerIsBetter = true) {
  if (value === null) return "unknown" as const;
  if (lowerIsBetter) {
    if (value <= good) return "good" as const;
    if (value > poor) return "poor" as const;
  } else {
    if (value >= good) return "good" as const;
    if (value < poor) return "poor" as const;
  }
  return "needs-improvement" as const;
}

function formatMilliseconds(value: number | null) {
  if (value === null) return null;
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} s`;
}

function formatCls(value: number | null) {
  if (value === null) return null;
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 3 });
}

function getFieldMetric(response: PageSpeedResponse, key: string) {
  const page = response.loadingExperience?.metrics?.[key];
  const origin = response.originLoadingExperience?.metrics?.[key];
  return page ?? origin;
}

function labMetric(
  audits: Record<string, LighthouseAudit>,
  auditKey: string,
  label: string,
  good: number,
  poor: number,
): WebsiteMetric {
  const numericValue = typeof audits[auditKey]?.numericValue === "number" ? audits[auditKey].numericValue! : null;
  return {
    key: auditKey,
    label,
    value: formatMilliseconds(numericValue),
    numericValue,
    unit: "ms",
    source: numericValue === null ? "unavailable" : "lab",
    sourceLabel: numericValue === null ? "Nicht verfügbar" : "Labordaten",
    rating: metricRating(numericValue, good, poor),
  };
}

function clsMetric(audits: Record<string, LighthouseAudit>): WebsiteMetric {
  const numericValue = typeof audits["cumulative-layout-shift"]?.numericValue === "number"
    ? audits["cumulative-layout-shift"].numericValue!
    : null;
  return {
    key: "cumulative-layout-shift",
    label: "Cumulative Layout Shift",
    value: formatCls(numericValue),
    numericValue,
    unit: "score",
    source: numericValue === null ? "unavailable" : "lab",
    sourceLabel: numericValue === null ? "Nicht verfügbar" : "Labordaten",
    rating: metricRating(numericValue, 0.1, 0.25),
  };
}

function fieldMetric(
  response: PageSpeedResponse,
  key: string,
  label: string,
  good: number,
  poor: number,
  transform: (value: number) => number = (value) => value,
  unit: "ms" | "score" = "ms",
): WebsiteMetric | null {
  const metric = getFieldMetric(response, key);
  if (typeof metric?.percentile !== "number") return null;
  const numericValue = transform(metric.percentile);
  return {
    key: `field-${key.toLowerCase()}`,
    label,
    value: unit === "ms" ? formatMilliseconds(numericValue) : formatCls(numericValue),
    numericValue,
    unit,
    source: "field",
    sourceLabel: "Reale Felddaten",
    rating: metricRating(numericValue, good, poor),
  };
}

export function parsePageSpeedResponse(
  response: PageSpeedResponse,
  normalizedUrl: string,
  domain: string,
  strategy: WebsiteCheckStrategy,
): WebsiteCheckResult {
  const lighthouse = response.lighthouseResult;
  if (!lighthouse?.categories || !lighthouse.audits) {
    throw new WebsiteCheckError("INVALID_API_RESPONSE", "Der Analysedienst hat keine vollständigen Ergebnisse geliefert.", 502);
  }

  const categories = lighthouse.categories;
  const audits = lighthouse.audits;
  const scores = {
    performance: buildScore("performance", "Performance", categories.performance?.score),
    accessibility: buildScore("accessibility", "Barrierefreiheit", categories.accessibility?.score),
    bestPractices: buildScore("bestPractices", "Best Practices", categories["best-practices"]?.score),
    seo: buildScore("seo", "SEO", categories.seo?.score),
  } satisfies WebsiteCheckResult["scores"];

  const labMetrics: WebsiteMetric[] = [
    labMetric(audits, "largest-contentful-paint", "Largest Contentful Paint", 2500, 4000),
    labMetric(audits, "first-contentful-paint", "First Contentful Paint", 1800, 3000),
    labMetric(audits, "speed-index", "Speed Index", 3400, 5800),
    labMetric(audits, "total-blocking-time", "Total Blocking Time", 200, 600),
    clsMetric(audits),
  ];

  const fieldInp = fieldMetric(response, "INTERACTION_TO_NEXT_PAINT", "Interaction to Next Paint", 200, 500);
  const fieldLcp = fieldMetric(response, "LARGEST_CONTENTFUL_PAINT_MS", "Largest Contentful Paint", 2500, 4000);
  const fieldCls = fieldMetric(response, "CUMULATIVE_LAYOUT_SHIFT_SCORE", "Cumulative Layout Shift", 0.1, 0.25, (value) => value / 100, "score");
  const fieldData = [fieldLcp, fieldInp, fieldCls].filter((metric): metric is WebsiteMetric => Boolean(metric));

  const metrics = [
    fieldLcp ?? labMetrics[0],
    ...(fieldInp ? [fieldInp] : []),
    fieldCls ?? labMetrics[4],
    labMetrics[1],
    labMetrics[2],
    labMetrics[3],
  ];
  const findings = buildFindings(audits, scores, metrics);
  const numericScores = Object.values(scores).map((score) => score.value).filter((value): value is number => value !== null);
  const average = numericScores.length ? Math.round(numericScores.reduce((sum, value) => sum + value, 0) / numericScores.length) : null;
  const summary = average === null
    ? "Die Analyse enthält nicht für alle Bereiche verwertbare Ergebnisse. Die verfügbaren Befunde wurden dennoch ausgewertet."
    : average >= 90
      ? "Die Website verfügt insgesamt über eine starke technische Basis. Einzelne Optimierungen können die Nutzererfahrung weiter stabilisieren."
      : average >= 50
        ? "Die technische Basis ist grundsätzlich nutzbar, weist aber konkretes Verbesserungspotenzial für Besucher und Sichtbarkeit auf."
        : "Die Ergebnisse deuten auf mehrere relevante technische Schwachstellen hin, die priorisiert geprüft werden sollten.";

  const createdAt = lighthouse.fetchTime ? new Date(lighthouse.fetchTime) : new Date();
  const expiresAt = new Date(createdAt.getTime() + RESULT_TTL_MS);
  return {
    id: randomUUID(),
    status: "completed",
    normalizedUrl,
    domain,
    strategy,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    finalUrl: lighthouse.finalUrl || response.id || normalizedUrl,
    scores,
    metrics,
    findings,
    summary,
    fieldDataAvailable: fieldData.length > 0,
  };
}
