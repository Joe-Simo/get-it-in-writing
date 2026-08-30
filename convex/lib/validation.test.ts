import { describe, expect, test } from "vitest";
import {
  assertSupportedDecision,
  normalizeContext,
  normalizeEmail,
  normalizeOfficialUrl,
  normalizeRequirement,
  sourceHost,
} from "./validation";

describe("decision input boundaries", () => {
  test("normalizes a public official URL without preserving its fragment", () => {
    expect(normalizeOfficialUrl(" https://www.example.com/policy#rooms ")).toBe(
      "https://www.example.com/policy",
    );
    expect(sourceHost("https://www.example.com/policy")).toBe("example.com");
  });

  test.each([
    "file:///etc/passwd",
    "http://localhost:3000",
    "http://127.0.0.1/private",
    "http://169.254.169.254/latest/meta-data",
    "http://192.168.1.4",
    "https://user:password@example.com",
  ])("rejects a non-public or credential-bearing source: %s", (url) => {
    expect(() => normalizeOfficialUrl(url)).toThrow();
  });

  test("keeps the decision boundary specific and bounded", () => {
    expect(normalizeRequirement("  We need   connecting rooms.  ")).toBe(
      "We need connecting rooms.",
    );
    expect(() => normalizeRequirement("Maybe yes")).toThrow(
      "Say specifically what must be true",
    );
    expect(normalizeContext("  December 12–14, two rooms  ")).toBe(
      "December 12–14, two rooms",
    );
  });

  test("normalizes an explicitly provided contact address", () => {
    expect(normalizeEmail(" Reservations@Example.com ")).toBe(
      "reservations@example.com",
    );
    expect(() => normalizeEmail("not-an-address")).toThrow(
      "Enter a valid email address",
    );
  });

  test.each([
    "My doctor must guarantee this treatment will cure me.",
    "The lawyer must guarantee I will win the lawsuit.",
    "This insurance policy must definitely cover the surgery.",
    "This investment must guarantee a 20 percent return.",
    "The employer must guarantee I get the job.",
  ])("stops a high-stakes or professional-guarantee decision: %s", (requirement) => {
    expect(() => assertSupportedDecision(requirement)).toThrow(
      "Get It in Writing does not handle",
    );
  });

  test("allows an ordinary purchase, booking, rental, or service boundary", () => {
    expect(() => assertSupportedDecision(
      "The two hotel rooms must have an internal connecting door.",
      "December 12–14",
    )).not.toThrow();
  });
});
