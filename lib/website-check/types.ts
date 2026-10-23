export type WebsiteCheckStrategy = "mobile" | "desktop";
export type ScoreKey = "performance" | "accessibility" | "bestPractices" | "seo";
export type MetricSource = "lab" | "field" | "unavailable";
export type MetricRating = "good" | "needs-improvement" | "poor" | "unknown";
export type FindingSeverity = "critical" | "warning" | "opportunity";

export interface WebsiteScore {
  key: ScoreKey;
  label: string;
  value: number | null;
  status: "very-good" | "improvement" | "critical" | "unavailable";
  statusLabel: string;
}

export interface WebsiteMetric {
  key: string;
  label: string;
  value: string | null;
  numericValue: number | null;
  unit: "ms" | "score" | "none";
  source: MetricSource;
  sourceLabel: string;
  rating: MetricRating;
}

export interface WebsiteFinding {
  id: string;
  title: string;
  technicalSummary: string;
  businessImpact: string;
  severity: FindingSeverity;
  priority: number;
}

export type IntelligenceStatus = "good" | "warning" | "critical" | "info" | "unknown";

export interface IntelligenceItem {
  label: string;
  value: string;
  status: IntelligenceStatus;
  evidence?: string;
}

export interface IntelligenceSection {
  key: string;
  title: string;
  description: string;
  score: number | null;
  confidence: "high" | "medium" | "low";
  items: IntelligenceItem[];
}

export interface SiteIntelligenceResult {
  scannedAt: string;
  sections: IntelligenceSection[];
  technologies: string[];
  structuredDataTypes: string[];
  socialProfiles: string[];
  detectedContacts: {
    emails: string[];
    phones: string[];
    addresses: string[];
  };
  notes: string[];
}

export interface WebsiteCheckResult {
  id: string;
  status: "completed";
  normalizedUrl: string;
  domain: string;
  strategy: WebsiteCheckStrategy;
  createdAt: string;
  expiresAt: string;
  finalUrl: string;
  scores: Record<ScoreKey, WebsiteScore>;
  metrics: WebsiteMetric[];
  findings: WebsiteFinding[];
  summary: string;
  fieldDataAvailable: boolean;
  intelligence?: SiteIntelligenceResult;
}

export interface AnalysisTokenPayload {
  purpose: "website-check-analysis";
  analysis: WebsiteCheckResult;
}

export interface MarketingConfirmationPayload {
  purpose: "website-check-marketing-confirmation";
  jti: string;
  leadId: string;
  email: string;
  firstName: string;
  company: string;
  requestedAt: string;
  consentedAt: string;
  consentTextVersion: string;
  source: string;
}

export interface ReportLeadInput {
  firstName: string;
  lastName?: string;
  company: string;
  email: string;
  phone?: string;
  marketingConsent: boolean;
  consentTextVersion: string;
  source: string;
}

export interface ApiErrorShape {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

export interface WebsiteLeadRecord {
  id: string;
  firstName: string;
  lastName?: string;
  company: string;
  email: string;
  phone?: string;
  analysisId: string;
  reportRequestedAt: string;
  marketingConsent: boolean;
  marketingConsentAt?: string;
  consentTextVersion: string;
  source: string;
  doubleOptInStatus: "not-requested" | "pending" | "confirmed";
  doubleOptInAt?: string;
  withdrawalStatus: "not-withdrawn" | "withdrawn";
  withdrawnAt?: string;
}