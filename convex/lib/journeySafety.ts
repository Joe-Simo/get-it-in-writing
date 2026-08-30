const privateIpv4 = /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.|0\.)/;

export function normalizePublicWebsiteUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Enter a complete website URL, including https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only public http and https websites can be checked");
  }
  if (url.username || url.password) {
    throw new Error("Website URLs cannot contain credentials");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "::1" ||
    privateIpv4.test(hostname)
  ) {
    throw new Error("Only public websites can be checked");
  }
  url.hash = "";
  return url.toString();
}

export function websiteDomain(value: string) {
  return new URL(normalizePublicWebsiteUrl(value)).hostname
    .toLowerCase()
    .replace(/^www\./, "");
}

export function boundedPlainText(value: string, label: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length < 2) throw new Error(`${label} is required`);
  if (normalized.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer`);
  }
  return normalized;
}

export function safeSlug(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 42) || "customer-journey"
  );
}

export function senderDomain(value: string) {
  const match = value.match(/<([^>]+)>/);
  const address = (match?.[1] ?? value).trim().toLowerCase();
  const separator = address.lastIndexOf("@");
  return separator === -1 ? "" : address.slice(separator + 1);
}

export function containsCorrelationToken(
  content: string,
  correlationToken: string,
) {
  return content.toLowerCase().includes(correlationToken.toLowerCase());
}
