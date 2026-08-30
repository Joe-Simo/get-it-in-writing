import { describe, expect, it } from "vitest";
import {
  boundedPlainText,
  containsCorrelationToken,
  normalizePublicWebsiteUrl,
  senderDomain,
  websiteDomain,
} from "./journeySafety";

describe("customer journey safety", () => {
  it("normalizes public websites and removes fragments", () => {
    expect(normalizePublicWebsiteUrl("https://Example.com/contact#form")).toBe(
      "https://example.com/contact",
    );
    expect(websiteDomain("https://www.Example.com/contact")).toBe(
      "example.com",
    );
  });

  it.each([
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://10.1.2.3",
    "https://intranet.local",
    "ftp://example.com",
    "https://user:pass@example.com",
  ])("rejects non-public targets: %s", (url) => {
    expect(() => normalizePublicWebsiteUrl(url)).toThrow();
  });

  it("bounds owner-authored copy", () => {
    expect(boundedPlainText("  Quote   request ", "Name", 40)).toBe(
      "Quote request",
    );
    expect(() => boundedPlainText("x".repeat(41), "Name", 40)).toThrow();
  });

  it("matches an inbox confirmation without storing a mailbox address", () => {
    expect(senderDomain("Support <hello@example.com>")).toBe("example.com");
    expect(containsCorrelationToken("Reference SG-A1B2", "sg-a1b2")).toBe(true);
  });
});
