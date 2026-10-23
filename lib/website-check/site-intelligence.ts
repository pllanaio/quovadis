import dns from "node:dns/promises";
import tls from "node:tls";
import type { IntelligenceItem, IntelligenceSection, SiteIntelligenceResult } from "./types";
import { normalizeAndValidateWebsiteUrl } from "./url-security";

const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 12_000;

function uniq(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function item(label: string, value: string, status: IntelligenceItem["status"] = "info", evidence?: string): IntelligenceItem {
  return { label, value, status, ...(evidence ? { evidence } : {}) };
}

function section(key: string, title: string, description: string, score: number | null, confidence: IntelligenceSection["confidence"], items: IntelligenceItem[]): IntelligenceSection {
  return { key, title, description, score, confidence, items };
}

function scoreFlags(flags: boolean[]) {
  return flags.length ? Math.round((flags.filter(Boolean).length / flags.length) * 100) : null;
}

function firstMatch(html: string, pattern: RegExp) {
  return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function allMatches(html: string, pattern: RegExp, group = 1) {
  return uniq([...html.matchAll(pattern)].map((match) => match[group] || ""));
}

function asString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "Unbekannt";
}

async function fetchHtmlSafely(input: string, signal?:AbortSignal) {
  let current = (await normalizeAndValidateWebsiteUrl(input)).normalizedUrl;
  for (let redirect = 0; redirect < 5; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: signal ? AbortSignal.any([signal,controller.signal]) : controller.signal,
        headers: {
          "User-Agent": "Leon-Pllana-Website-Check/1.0 (+https://pllana.io/website-check)",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new Error("Redirect ohne Ziel");
        current = (await normalizeAndValidateWebsiteUrl(new URL(location, current).toString())).normalizedUrl;
        continue;
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("text/html")) throw new Error("Keine HTML-Seite");
      if(!response.body)throw Error('Leere HTML-Antwort');
      const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;if(value){size+=value.byteLength;if(size>MAX_HTML_BYTES){await reader.cancel();throw Error('HTML-Antwort zu groß');}chunks.push(value)}}}finally{reader.releaseLock()}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}const html=new TextDecoder().decode(bytes);
      return { html, headers: response.headers, status: response.status, finalUrl: current };
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Zu viele Weiterleitungen");
}

function detectTechnologies(html: string, headers: Headers) {
  const source = html.toLowerCase();
  const poweredBy = (headers.get("x-powered-by") || "").toLowerCase();
  const server = (headers.get("server") || "").toLowerCase();
  const checks: Array<[string, boolean]> = [
    ["WordPress", /wp-content\/|wp-includes\//.test(source)],
    ["WooCommerce", /woocommerce|wc-blocks/.test(source)],
    ["TYPO3", /typo3temp\/|typo3conf\//.test(source)],
    ["Joomla", /joomla|\/media\/system\/js\//.test(source)],
    ["Drupal", /drupal-settings-json|\/sites\/default\/files\//.test(source)],
    ["Shopware", /shopware|sw-context-token/.test(source)],
    ["Shopify", /cdn\.shopify\.com|shopify\.theme/.test(source)],
    ["Wix", /wixstatic\.com|wix-code-sdk/.test(source)],
    ["Squarespace", /squarespace/.test(source)],
    ["Webflow", /data-wf-page|webflow\.js/.test(source)],
    ["Framer", /framerusercontent\.com|data-framer-name/.test(source)],
    ["Jimdo", /jimstatic\.com|jimdo\.com/.test(source)],
    ["IONOS Website Builder", /website-editor\.net|mywebsite-editor\.com|cm4all/.test(source)],
    ["Next.js", /\/_next\/|__next_data__/.test(source) || poweredBy.includes("next.js")],
    ["Nuxt", /\/_nuxt\/|__nuxt__/.test(source)],
    ["React", /data-reactroot|react-dom/.test(source)],
    ["Vue", /data-v-|vue\.js|vue\.min\.js/.test(source)],
    ["Angular", /ng-version|angular\.js/.test(source)],
    ["Astro", /astro-island|data-astro-cid/.test(source)],
    ["PHP", poweredBy.includes("php")],
    ["ASP.NET", poweredBy.includes("asp.net") || source.includes("__viewstate")],
    ["nginx", server.includes("nginx")],
    ["Apache", server.includes("apache")],
    ["Cloudflare", server.includes("cloudflare") || headers.has("cf-ray")],
    ["Vercel", server.includes("vercel") || headers.has("x-vercel-id")],
  ];
  const technologies = checks.filter(([, found]) => found).map(([name]) => name);
  const generator = firstMatch(html, /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i);
  if (generator) technologies.push(generator);
  return uniq(technologies);
}

function extractJsonLdTypes(html: string) {
  const blocks = allMatches(html, /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  const types: string[] = [];
  for (const block of blocks) {
    try {
      const walk = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) return value.forEach(walk);
        const record = value as Record<string, unknown>;
        const type = record["@type"];
        if (typeof type === "string") types.push(type);
        if (Array.isArray(type)) types.push(...type.filter((entry): entry is string => typeof entry === "string"));
        Object.values(record).forEach(walk);
      };
      walk(JSON.parse(block));
    } catch {
      // Ungültiges JSON-LD wird lediglich nicht ausgewertet.
    }
  }
  return uniq(types);
}

function getCertificate(hostname: string): Promise<{ issuer: string; validTo: string; protocol: string } | null> {
  if(process.env.HTTP_PROXY||process.env.HTTPS_PROXY)return Promise.resolve(null);
  return new Promise((resolve) => {
    const socket = tls.connect({ host: hostname, port: 443, servername: hostname, rejectUnauthorized: true, timeout: 6_000 }, () => {
      const certificate = socket.getPeerCertificate();
      const protocol = socket.getProtocol() || "Unbekannt";
      socket.end();
      if (!certificate || !certificate.valid_to) return resolve(null);
      const issuer = asString(certificate.issuer?.O) !== "Unbekannt" ? asString(certificate.issuer?.O) : asString(certificate.issuer?.CN);
      resolve({ issuer, validTo: certificate.valid_to, protocol });
    });
    socket.on("error", () => resolve(null));
    socket.on("timeout", () => { socket.destroy(); resolve(null); });
  });
}

export async function scanSiteIntelligence(input: string, signal?:AbortSignal): Promise<SiteIntelligenceResult> {
  const { html, headers, status, finalUrl } = await fetchHtmlSafely(input,signal);
  const url = new URL(finalUrl);
  const host = url.hostname;
  const lower = html.toLowerCase();
  const technologies = detectTechnologies(html, headers);
  const scripts = allMatches(html, /<script[^>]+src=["']([^"']+)["']/gi);
  const styles = allMatches(html, /<link[^>]+href=["']([^"']+)["'][^>]*>/gi);
  const images = allMatches(html, /<img\b[^>]*>/gi, 0);
  const links = allMatches(html, /<a[^>]+href=["']([^"']+)["']/gi);
  const headings = allMatches(html, /<(h[1-6])\b[^>]*>/gi);
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const structuredDataTypes = extractJsonLdTypes(html);
  const emails = uniq(allMatches(html, /mailto:([^"'?\s>]+)/gi).concat(allMatches(html, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 0))).slice(0, 10);
  const phones = uniq(allMatches(html, /tel:([^"'?\s>]+)/gi)).slice(0, 10);
  const socialProfiles = uniq(links.filter((link) => /linkedin\.com|instagram\.com|facebook\.com|youtube\.com|youtu\.be|tiktok\.com|x\.com|twitter\.com/i.test(link))).slice(0, 12);
  const cookies = headers.getSetCookie?.() || [];
  const server = headers.get("server") || "Nicht offengelegt";
  const poweredBy = headers.get("x-powered-by") || "Nicht offengelegt";
  const contentEncoding = headers.get("content-encoding") || "Keine Komprimierung erkennbar";
  const cacheControl = headers.get("cache-control") || "Nicht gesetzt";

  const [aRecords, aaaaRecords, mxRecords, nsRecords, txtRecords, certificate] = await Promise.all([
    dns.resolve4(host).catch(() => []),
    dns.resolve6(host).catch(() => []),
    dns.resolveMx(host).catch(() => []),
    dns.resolveNs(host).catch(() => []),
    dns.resolveTxt(host).catch(() => []),
    getCertificate(host),
  ]);
  const txtFlat = txtRecords.map((parts) => parts.join(""));
  const spf = txtFlat.find((record) => record.startsWith("v=spf1"));
  const dmarc = await dns.resolveTxt(`_dmarc.${host}`).then((records) => records.map((parts) => parts.join("")).find((record) => record.startsWith("v=DMARC1"))).catch(() => undefined);

  const trackers = [
    ["Google Analytics", /google-analytics\.com|gtag\(|googletagmanager\.com\/gtag/.test(lower)],
    ["Google Tag Manager", lower.includes("googletagmanager.com/gtm.js")],
    ["Meta Pixel", /connect\.facebook\.net|fbq\(/.test(lower)],
    ["LinkedIn Insight", lower.includes("snap.licdn.com")],
    ["TikTok Pixel", lower.includes("analytics.tiktok.com")],
    ["Microsoft Clarity", lower.includes("clarity.ms")],
    ["Hotjar", /hotjar\.com|hj\(/.test(lower)],
    ["Matomo", /matomo\.js|piwik\.js/.test(lower)],
  ].filter(([, found]) => found).map(([name]) => String(name));

  const imageFormats = uniq(images.map((tag) => firstMatch(tag, /src=["']([^"']+)/i).split(/[?#]/)[0].split(".").pop()?.toUpperCase() || "Unbekannt"));
  const imagesWithoutAlt = images.filter((tag) => !/\balt=["'][^"']*["']/i.test(tag)).length;
  const imagesWithoutLazy = images.filter((tag) => !/\bloading=["']lazy["']/i.test(tag)).length;
  const imagesWithoutDimensions = images.filter((tag) => !(/\bwidth=/.test(tag) && /\bheight=/.test(tag))).length;
  const externalFonts = uniq(styles.concat(scripts).filter((resource) => /fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net/i.test(resource)));
  const hasFaq = structuredDataTypes.includes("FAQPage") || /häufige fragen|faq/i.test(html);
  const hasQuestions = /<h[1-6][^>]*>[^<]*(wie|was|warum|wann|wo|welche|wer)\b/i.test(html);
  const hasOrganization = structuredDataTypes.some((type) => ["Organization", "LocalBusiness", "Corporation", "ProfessionalService"].includes(type));
  const hasAuthor = /rel=["']author["']|itemprop=["']author["']|"author"\s*:/i.test(html);
  const hasDates = /datePublished|dateModified|<time\b/i.test(html);
  const hasSources = /quellen|sources|literatur|references/i.test(html);
  const hasSemantic = ["<main", "<nav", "<header", "<footer", "<article", "<section"].filter((tag) => lower.includes(tag)).length >= 4;
  const securityHeaders = ["strict-transport-security", "content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"];
  const forms = allMatches(html, /<form\b[\s\S]*?<\/form>/gi, 0);
  const hasCaptcha = /recaptcha|hcaptcha|turnstile/i.test(html);
  const hasConsent = /cookiebot|usercentrics|consentmanager|borlabs|cookie consent|klaro/i.test(html);
  const viewport = firstMatch(html, /<meta[^>]+name=["']viewport["'][^>]+content=["']([^"']+)["']/i);
  const language = firstMatch(html, /<html[^>]+lang=["']([^"']+)/i) || "Nicht angegeben";
  const addresses = uniq(allMatches(html, /\b\d{5}\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß.-]+(?:\s+[A-Za-zÄÖÜäöüß.-]+){0,3}/g, 0)).slice(0, 5);
  const presentSecurity = securityHeaders.filter((name) => headers.has(name));

  const sections: IntelligenceSection[] = [
    section("technology", "1. Technologie-Stack & CMS", "Erkannte Systeme, Frameworks und Server-Indikatoren.", null, technologies.length ? "medium" : "low", [item("Erkannte Technologien", technologies.join(", ") || "Keine eindeutige Erkennung", technologies.length ? "good" : "unknown"), item("X-Powered-By", poweredBy), item("Server", server)]),
    section("hosting", "2. Hosting & Infrastruktur", "Öffentlich erkennbare Hosting-, CDN- und Proxy-Signale.", null, "medium", [item("Server/CDN", server), item("IPv4", aRecords.join(", ") || "Nicht gefunden"), item("IPv6", aaaaRecords.join(", ") || "Nicht gefunden", aaaaRecords.length ? "good" : "warning"), item("Nameserver", nsRecords.join(", ") || "Nicht gefunden")]),
    section("dns", "3. DNS & E-Mail-Domain", "DNS-, Mail- und Authentifizierungs-Einträge der Domain.", scoreFlags([aRecords.length > 0, nsRecords.length > 0, mxRecords.length > 0, Boolean(spf), Boolean(dmarc), aaaaRecords.length > 0]), "high", [item("MX", mxRecords.map((record) => record.exchange).join(", ") || "Nicht gefunden"), item("SPF", spf || "Nicht gefunden", spf ? "good" : "warning"), item("DMARC", dmarc || "Nicht gefunden", dmarc ? "good" : "warning")]),
    section("ssl", "4. SSL/TLS", "Zertifikat, HTTPS und Transport-Sicherheit.", scoreFlags([url.protocol === "https:", Boolean(certificate), headers.has("strict-transport-security")]), "high", [item("HTTPS", url.protocol === "https:" ? "Aktiv" : "Nicht aktiv", url.protocol === "https:" ? "good" : "critical"), item("TLS-Protokoll", certificate?.protocol || "Nicht ermittelbar"), item("Zertifikatsaussteller", certificate?.issuer || "Nicht ermittelbar"), item("Zertifikat gültig bis", certificate?.validTo || "Nicht ermittelbar"), item("HSTS", headers.get("strict-transport-security") || "Nicht gesetzt")]),
    section("performance", "5. Technische Auslieferung", "Antwort, Komprimierung, Caching und Dokumentumfang.", scoreFlags([status < 400, /gzip|br/i.test(contentEncoding), headers.has("cache-control")]), "high", [item("HTTP-Status", String(status)), item("HTML-Größe", `${Math.round(Buffer.byteLength(html, "utf8") / 1024)} KB`), item("Skripte", String(scripts.length)), item("Stylesheets/Ressourcen", String(styles.length)), item("Komprimierung", contentEncoding), item("Cache-Control", cacheControl)]),
    section("images", "6. Bilder", "Formate, Alternativtexte, Lazy Loading und feste Abmessungen.", scoreFlags([imagesWithoutAlt === 0, imagesWithoutLazy === 0, imagesWithoutDimensions === 0, imageFormats.some((format) => ["WEBP", "AVIF"].includes(format))]), "high", [item("Bilder gefunden", String(images.length)), item("Formate", imageFormats.join(", ") || "Keine"), item("Ohne Alt-Attribut", String(imagesWithoutAlt)), item("Ohne Lazy Loading", String(imagesWithoutLazy)), item("Ohne Width/Height", String(imagesWithoutDimensions))]),
    section("fonts", "7. Schriftarten", "Externe Font-Dienste und potenziell zusätzliche Verbindungen.", externalFonts.length ? 40 : 100, "medium", [item("Externe Font-Ressourcen", externalFonts.join(", ") || "Keine bekannten externen Font-Dienste erkannt", externalFonts.length ? "warning" : "good")]),
    section("tracking", "8. Tracking & Marketing-Technologien", "Im Quelltext erkannte Analyse- und Marketingdienste.", null, "medium", [item("Erkannte Dienste", trackers.join(", ") || "Keine bekannten Tracker erkannt")]),
    section("cookies", "9. Cookies & Consent", "Direkt gesetzte Cookies und Consent-Indikatoren.", scoreFlags([hasConsent || cookies.length === 0]), "medium", [item("Set-Cookie-Header", String(cookies.length)), item("Consent-Lösung", hasConsent ? "Erkannt" : "Nicht eindeutig erkannt")]),
    section("seo", "10. SEO-Grundlagen", "Meta-Daten, Canonical, Sprache und Überschriften.", scoreFlags([Boolean(title), description.length >= 70, Boolean(canonical), language !== "Nicht angegeben", headings.includes("h1")]), "high", [item("Title", title || "Fehlt"), item("Meta Description", description || "Fehlt"), item("Canonical", canonical || "Fehlt"), item("Dokumentsprache", language), item("Überschriften", headings.join(", ") || "Keine erkannt")]),
    section("aeo", "11. AEO – Antwortfähigkeit", "Struktur und Signale für direkte Antworten.", scoreFlags([hasFaq, hasQuestions, structuredDataTypes.length > 0, hasSemantic, Boolean(title), Boolean(description)]), "medium", [item("FAQ-Inhalte/Schema", hasFaq ? "Vorhanden" : "Nicht erkannt"), item("Frageorientierte Überschriften", hasQuestions ? "Vorhanden" : "Nicht erkannt"), item("Semantische HTML-Struktur", hasSemantic ? "Gut erkennbar" : "Ausbaufähig"), item("Strukturierte Datentypen", structuredDataTypes.join(", ") || "Keine")]),
    section("geo", "12. GEO – KI-Sichtbarkeit", "Maschinenlesbare Entitäten und Vertrauenssignale.", scoreFlags([hasOrganization, hasAuthor, hasDates, hasSources, structuredDataTypes.length > 0, emails.length + phones.length > 0, lower.includes("impressum"), lower.includes("datenschutz")]), "medium", [item("Unternehmens-Entität", hasOrganization ? "Strukturiert vorhanden" : "Nicht eindeutig strukturiert"), item("Autor/Verantwortlichkeit", hasAuthor ? "Erkennbar" : "Nicht erkannt"), item("Aktualitätsdaten", hasDates ? "Vorhanden" : "Nicht erkannt"), item("Quellen/Referenzen", hasSources ? "Vorhanden" : "Nicht erkannt")]),
    section("accessibility", "13. Barrierefreiheit Plus", "Zusätzliche Zugänglichkeits-Indikatoren.", scoreFlags([imagesWithoutAlt === 0, language !== "Nicht angegeben", hasSemantic, /skip-link|skip to content|zum inhalt/i.test(html), forms.every((form) => !/<input/i.test(form) || /<label/i.test(form))]), "medium", [item("Bild-Alternativtexte", imagesWithoutAlt ? `${imagesWithoutAlt} potenziell fehlend` : "Keine fehlenden erkannt"), item("Skip-Link", /skip-link|skip to content|zum inhalt/i.test(html) ? "Erkannt" : "Nicht erkannt"), item("Landmarken", hasSemantic ? "Mehrere vorhanden" : "Wenige erkannt")]),
    section("security", "14. Sicherheits-Header", "Browserseitige Schutzmaßnahmen.", Math.round((presentSecurity.length / securityHeaders.length) * 100), "high", securityHeaders.map((name) => item(name, headers.get(name) || "Nicht gesetzt", headers.has(name) ? "good" : "warning"))),
    section("responsive", "15. Responsive & Mobile", "Viewport- und Responsive-Indikatoren.", scoreFlags([Boolean(viewport), /@media\s*\(/i.test(html), /srcset=|<picture/i.test(html)]), "medium", [item("Viewport", viewport || "Fehlt"), item("Media Queries", /@media\s*\(/i.test(html) ? "Erkannt" : "Nicht erkannt"), item("Responsive Images", /srcset=|<picture/i.test(html) ? "Erkannt" : "Nicht erkannt")]),
    section("forms", "16. Formulare", "Formulare, Captcha- und Datenschutzindikatoren.", null, "medium", [item("Formulare", String(forms.length)), item("Captcha", hasCaptcha ? "Erkannt" : "Nicht erkannt"), item("Datenschutz-/Einwilligungstext", forms.some((form) => /datenschutz|einwilligung|privacy|consent/i.test(form)) ? "Erkannt" : "Nicht erkannt")]),
    section("legal", "17. Rechtliches & Datenschutz", "Links und technische Pflichtinformationen.", scoreFlags([lower.includes("impressum"), lower.includes("datenschutz"), hasConsent || cookies.length === 0]), "medium", [item("Impressum", lower.includes("impressum") ? "Verlinkt/erwähnt" : "Nicht erkannt"), item("Datenschutz", lower.includes("datenschutz") ? "Verlinkt/erwähnt" : "Nicht erkannt"), item("Cookie-Consent", hasConsent ? "Erkannt" : "Nicht eindeutig erkannt")]),
    section("social", "18. Social Media", "Öffentlich verlinkte Unternehmensprofile.", null, "high", [item("Profile", socialProfiles.join(", ") || "Keine bekannten Social-Profile erkannt")]),
    section("company", "19. Unternehmensdaten", "Öffentlich extrahierbare Kontakt- und Unternehmenssignale.", scoreFlags([emails.length > 0, phones.length > 0, addresses.length > 0, hasOrganization]), "medium", [item("E-Mail-Adressen", emails.join(", ") || "Keine erkannt"), item("Telefonnummern", phones.join(", ") || "Keine erkannt"), item("Adresshinweise", addresses.join(" | ") || "Keine erkannt"), item("Strukturierte Unternehmensdaten", hasOrganization ? "Vorhanden" : "Nicht erkannt")]),
  ];

  return {
    scannedAt: new Date().toISOString(),
    sections,
    technologies,
    structuredDataTypes,
    socialProfiles,
    detectedContacts: { emails, phones, addresses },
    notes: ["Erkennungen zu CMS, Hosting, AEO und GEO beruhen teilweise auf öffentlich sichtbaren Indikatoren und sind keine Garantie."],
  };
}
