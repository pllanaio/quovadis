import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { WebsiteCheckError } from "./errors";

const MAX_URL_LENGTH = 2048;
const DNS_TIMEOUT_MS = 4_000;
const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.azure.internal",
  "instance-data.ec2.internal",
  "metadata.aws.internal",
]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp", ".test", ".invalid", ".example"];

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type HostResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const defaultResolver: HostResolver = async (hostname) => {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => ({ address: record.address, family: record.family }));
};

function ipv4ToNumber(address: string) {
  return address.split(".").reduce((value, part) => (value << 8) + Number(part), 0) >>> 0;
}

function inIpv4Range(address: string, base: string, prefix: number) {
  const value = ipv4ToNumber(address);
  const baseValue = ipv4ToNumber(base);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

export function isUnsafeIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) {
    const ranges: Array<[string, number]> = [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ];
    return ranges.some(([base, prefix]) => inIpv4Range(address, base, prefix));
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith("ff")) return true;
    if (normalized.startsWith("2001:db8:")) return true;
    if (normalized.startsWith("::ffff:")) return true;
    return false;
  }

  return true;
}

function isBlockedHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return BLOCKED_HOSTS.has(normalized) || BLOCKED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

async function resolveWithTimeout(hostname: string, resolver: HostResolver) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      resolver(hostname),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new WebsiteCheckError("DNS_TIMEOUT", "Die angegebene Website konnte nicht rechtzeitig erreicht werden.", 408)), DNS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function normalizeAndValidateWebsiteUrl(input: unknown, resolver: HostResolver = defaultResolver) {
  if (typeof input !== "string" || !input.trim()) {
    throw new WebsiteCheckError("INVALID_URL", "Bitte geben Sie eine gültige Website-Adresse ein.");
  }

  const trimmed = input.trim();
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new WebsiteCheckError("URL_TOO_LONG", "Die eingegebene Website-Adresse ist zu lang.");
  }

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new WebsiteCheckError("INVALID_URL", "Bitte geben Sie eine gültige Website-Adresse ein.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new WebsiteCheckError("UNSUPPORTED_PROTOCOL", "Es können ausschließlich öffentlich erreichbare HTTP- oder HTTPS-Websites analysiert werden.");
  }
  if (url.username || url.password) {
    throw new WebsiteCheckError("CREDENTIALS_NOT_ALLOWED", "Website-Adressen mit eingebetteten Zugangsdaten können nicht analysiert werden.");
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new WebsiteCheckError("PORT_NOT_ALLOWED", "Diese Adresse verwendet einen nicht unterstützten Port.");
  }

  const urlHostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const hostname = urlHostname.startsWith("[") && urlHostname.endsWith("]") ? urlHostname.slice(1, -1) : urlHostname;
  if (!hostname || isBlockedHostname(hostname)) {
    throw new WebsiteCheckError("PRIVATE_ADDRESS", "Diese Adresse kann aus Sicherheitsgründen nicht analysiert werden.");
  }

  if (isIP(hostname)) {
    if (isUnsafeIpAddress(hostname)) {
      throw new WebsiteCheckError("PRIVATE_ADDRESS", "Diese Adresse kann aus Sicherheitsgründen nicht analysiert werden.");
    }
  } else {
    let records: ResolvedAddress[];
    try {
      records = await resolveWithTimeout(hostname, resolver);
    } catch (error) {
      if (error instanceof WebsiteCheckError) throw error;
      throw new WebsiteCheckError("HOST_UNREACHABLE", "Die angegebene Website konnte nicht erreicht werden.", 422);
    }
    if (!records.length || records.some((record) => isUnsafeIpAddress(record.address))) {
      throw new WebsiteCheckError("PRIVATE_ADDRESS", "Diese Adresse kann aus Sicherheitsgründen nicht analysiert werden.");
    }
  }

  url.hash = "";
  const normalizedUrl = url.toString();
  return { normalizedUrl, domain: hostname, url };
}
