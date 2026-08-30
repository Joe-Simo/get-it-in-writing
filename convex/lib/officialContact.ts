export type OfficialContactPage = {
  url: string;
  markdown?: string;
  title?: string;
};

export type VerifiedOfficialContact = {
  email: string;
  label: string;
  sourceUrl: string;
  sourceExcerpt: string;
};

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const excludedMailbox =
  /^(?:abuse|careers?|compliance|dpo|investors?|jobs?|legal|media|news|no-?reply|privacy|press|security)$/i;
const usefulMailbox =
  /^(?:bookings?|concierge|contact|enquir(?:y|ies)|frontdesk|hello|info|reservations?|sales|service|support)$/i;
const usefulContext =
  /\b(?:book|booking|contact|enquir(?:y|ies)|front desk|guest|reservation|sales|service|support)\b/i;

function mailbox(email: string) {
  return email.split("@", 1)[0] ?? "";
}

function contextAround(markdown: string, email: string) {
  const index = markdown.toLowerCase().indexOf(email.toLowerCase());
  if (index < 0) return "";
  const start = Math.max(0, index - 160);
  const end = Math.min(markdown.length, index + email.length + 160);
  return markdown.slice(start, end).replace(/\s+/g, " ").trim().slice(0, 500);
}

function contactLabel(email: string, context: string) {
  const local = mailbox(email);
  if (excludedMailbox.test(local)) return undefined;
  if (!usefulMailbox.test(local) && !usefulContext.test(context))
    return undefined;
  if (/reservation|booking/i.test(`${local} ${context}`)) return "Reservations";
  if (/front\s?desk|concierge/i.test(`${local} ${context}`))
    return "Guest services";
  if (/sales/i.test(`${local} ${context}`)) return "Sales";
  if (/support|service/i.test(`${local} ${context}`)) return "Customer support";
  return "Official contact";
}

export function extractVerifiedOfficialContacts(pages: OfficialContactPage[]) {
  const contacts = pages.flatMap((page) => {
    const markdown = page.markdown ?? "";
    const emails = markdown.match(emailPattern) ?? [];
    return emails.flatMap((candidate) => {
      const email = candidate.toLowerCase();
      const sourceExcerpt = contextAround(markdown, email);
      const label = contactLabel(email, `${page.title ?? ""} ${sourceExcerpt}`);
      if (!label || !sourceExcerpt) return [];
      return [{ email, label, sourceUrl: page.url, sourceExcerpt }];
    });
  });

  return [
    ...new Map(contacts.map((contact) => [contact.email, contact])).values(),
  ];
}
