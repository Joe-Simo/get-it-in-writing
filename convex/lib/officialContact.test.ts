import { describe, expect, it } from "vitest";
import { extractVerifiedOfficialContacts } from "./officialContact";

describe("extractVerifiedOfficialContacts", () => {
  it("keeps a relevant provider contact with its exact official-page context", () => {
    expect(
      extractVerifiedOfficialContacts([
        {
          url: "https://hotel.example/faq/reservations",
          title: "Reservations FAQ",
          markdown:
            "Interconnecting rooms are subject to availability. Contact our Reservations team at reservations@hotel.example to make arrangements.",
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        email: "reservations@hotel.example",
        label: "Reservations",
        sourceUrl: "https://hotel.example/faq/reservations",
      }),
    ]);
  });

  it("rejects unrelated legal and no-reply mailboxes", () => {
    expect(
      extractVerifiedOfficialContacts([
        {
          url: "https://hotel.example/privacy",
          title: "Privacy",
          markdown:
            "Privacy questions: privacy@hotel.example. Automated mail: no-reply@hotel.example.",
        },
      ]),
    ).toEqual([]);
  });
});
