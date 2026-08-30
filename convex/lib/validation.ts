const MAX_URL_LENGTH = 2_048;

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return false;
  }
  const [first = 0, second = 0] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first === 0
  );
}

export function normalizeOfficialUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    throw new Error("Enter a complete official page URL");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Enter a valid official page URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("The official page must use http or https");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "::1" ||
    hostname.startsWith("[") ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error("Use a public official website, not a private network URL");
  }
  if (url.username || url.password) {
    throw new Error("Official page URLs cannot contain credentials");
  }
  url.hash = "";
  return url.toString();
}

export function normalizeRequirement(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  if (text.length < 12) {
    throw new Error("Say specifically what must be true");
  }
  if (text.length > 800) {
    throw new Error("Keep the requirement under 800 characters");
  }
  return text;
}

export function normalizeContext(value: string | undefined) {
  const text = value?.trim().replace(/\s+/g, " ") ?? "";
  if (text.length > 1_500) throw new Error("Keep the context under 1,500 characters");
  return text || undefined;
}

export function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new Error("Enter a valid email address");
  }
  return email;
}

export function boundedText(value: string, max: number, label: string) {
  const text = value.trim();
  if (text.length === 0) throw new Error(`${label} cannot be empty`);
  if (text.length > max) throw new Error(`${label} is too long`);
  return text;
}

export function sourceHost(url: string) {
  return new URL(url).hostname.replace(/^www\./, "");
}
