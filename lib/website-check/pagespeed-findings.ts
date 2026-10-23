import type { WebsiteCheckResult, WebsiteFinding, WebsiteMetric } from "./types";

interface LighthouseAudit {
  score?: number | null;
  numericValue?: number;
  details?: { overallSavingsMs?: number; overallSavingsBytes?: number };
}

function pushFinding(findings: WebsiteFinding[], finding: WebsiteFinding) {
  if (!findings.some((item) => item.id === finding.id)) findings.push(finding);
}

export function buildFindings(
  audits: Record<string, LighthouseAudit>,
  scores: WebsiteCheckResult["scores"],
  metrics: WebsiteMetric[],
) {
  const findings: WebsiteFinding[] = [];
  const lcp = metrics.find((metric) => metric.label === "Largest Contentful Paint");
  const cls = metrics.find((metric) => metric.label === "Cumulative Layout Shift");
  const tbt = metrics.find((metric) => metric.key === "total-blocking-time");

  if (lcp && lcp.numericValue !== null && lcp.rating !== "good") {
    pushFinding(findings, {
      id: "slow-main-content",
      title: "Der wichtigste Seiteninhalt erscheint vergleichsweise spät",
      technicalSummary: `Largest Contentful Paint: ${lcp.value ?? "nicht verfügbar"}.`,
      businessImpact: "Besucher könnten insbesondere auf Smartphones abspringen, bevor Ihr Angebot vollständig sichtbar ist.",
      severity: lcp.rating === "poor" ? "critical" : "warning",
      priority: lcp.rating === "poor" ? 100 : 78,
    });
  }

  if (cls && cls.numericValue !== null && cls.rating !== "good") {
    pushFinding(findings, {
      id: "layout-shifts",
      title: "Elemente verschieben sich während des Ladens",
      technicalSummary: `Cumulative Layout Shift: ${cls.value ?? "nicht verfügbar"}.`,
      businessImpact: "Das kann unruhig wirken und birgt das Risiko von Fehlklicks, besonders bei Formularen und Buttons.",
      severity: cls.rating === "poor" ? "critical" : "warning",
      priority: cls.rating === "poor" ? 92 : 72,
    });
  }

  const unusedJavaScript = audits["unused-javascript"];
  const jsSavings = unusedJavaScript?.details?.overallSavingsMs ?? 0;
  if ((unusedJavaScript?.score ?? 1) < 0.9 && (jsSavings >= 200 || (tbt?.numericValue ?? 0) > 200)) {
    pushFinding(findings, {
      id: "javascript-load",
      title: "Der Browser muss vergleichsweise viel JavaScript verarbeiten",
      technicalSummary: tbt?.value ? `Total Blocking Time: ${tbt.value}.` : "Nicht benötigte Skripte wurden als Optimierungspotenzial erkannt.",
      businessImpact: "Dadurch kann sich die Website vor allem auf weniger leistungsstarken Smartphones verzögert oder schwerfällig anfühlen.",
      severity: (tbt?.rating === "poor" || jsSavings > 600) ? "critical" : "warning",
      priority: (tbt?.rating === "poor" || jsSavings > 600) ? 90 : 70,
    });
  }

  const imageAuditKeys = ["uses-optimized-images", "uses-responsive-images", "modern-image-formats", "uses-text-compression"];
  if (imageAuditKeys.some((key) => (audits[key]?.score ?? 1) < 0.9)) {
    pushFinding(findings, {
      id: "asset-size",
      title: "Bilder oder übertragene Dateien bieten Optimierungspotenzial",
      technicalSummary: "PageSpeed hat unnötig große oder nicht optimal ausgelieferte Ressourcen erkannt.",
      businessImpact: "Kleinere Dateien können Ladezeiten und mobile Datenverbindungen entlasten, ohne die sichtbare Qualität zu verschlechtern.",
      severity: "opportunity",
      priority: 62,
    });
  }

  if ((audits["image-alt"]?.score ?? 1) < 1) {
    pushFinding(findings, {
      id: "missing-alt-text",
      title: "Einige Bilder sind für Screenreader nicht ausreichend beschrieben",
      technicalSummary: "Bei mindestens einem Bild fehlt ein geeigneter Alternativtext.",
      businessImpact: "Dadurch können wichtige Inhalte für Menschen mit assistiven Technologien schwerer verständlich sein.",
      severity: "warning",
      priority: 80,
    });
  }

  if ((scores.seo.value ?? 100) < 90) {
    pushFinding(findings, {
      id: "seo-basics",
      title: "Technische SEO-Grundlagen sind nicht vollständig umgesetzt",
      technicalSummary: `SEO-Basis-Score: ${scores.seo.value ?? "nicht verfügbar"} von 100.`,
      businessImpact: "Das deutet auf Verbesserungspotenzial bei der technischen Darstellung und Verständlichkeit für Suchmaschinen hin.",
      severity: (scores.seo.value ?? 100) < 50 ? "critical" : "warning",
      priority: (scores.seo.value ?? 100) < 50 ? 88 : 68,
    });
  }

  if ((scores.accessibility.value ?? 100) < 90 && !findings.some((item) => item.id === "missing-alt-text")) {
    pushFinding(findings, {
      id: "accessibility-basics",
      title: "Die Zugänglichkeit weist technische Lücken auf",
      technicalSummary: `Barrierefreiheits-Score: ${scores.accessibility.value ?? "nicht verfügbar"} von 100.`,
      businessImpact: "Einige Besucher könnten Inhalte oder Bedienelemente schwieriger wahrnehmen und nutzen.",
      severity: (scores.accessibility.value ?? 100) < 50 ? "critical" : "warning",
      priority: (scores.accessibility.value ?? 100) < 50 ? 86 : 66,
    });
  }

  if ((scores.bestPractices.value ?? 100) < 90) {
    pushFinding(findings, {
      id: "technical-quality",
      title: "Bei der technischen Qualität wurden Auffälligkeiten erkannt",
      technicalSummary: `Best-Practices-Score: ${scores.bestPractices.value ?? "nicht verfügbar"} von 100.`,
      businessImpact: "Die Befunde können den professionellen Gesamteindruck, die Stabilität oder die Wartbarkeit der Website beeinflussen.",
      severity: (scores.bestPractices.value ?? 100) < 50 ? "critical" : "opportunity",
      priority: (scores.bestPractices.value ?? 100) < 50 ? 82 : 58,
    });
  }

  if (!findings.length) {
    findings.push({
      id: "solid-baseline",
      title: "Die technische Basis macht einen soliden Eindruck",
      technicalSummary: "In den priorisierten Prüfpunkten wurden keine deutlichen kritischen Auffälligkeiten erkannt.",
      businessImpact: "Regelmäßige Kontrollen bleiben sinnvoll, weil Inhalte, Erweiterungen und Drittanbieter-Skripte die Werte verändern können.",
      severity: "opportunity",
      priority: 10,
    });
  }

  return findings.sort((a, b) => b.priority - a.priority).slice(0, 5);
}
