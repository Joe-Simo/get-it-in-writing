export type ExportRequirement = {
  text: string;
  category: string;
  criticality: string;
  status: string;
  requiredWithBid: boolean;
  dueDateText?: string;
  ownerLabel?: string;
  note?: string;
  sourceTitle: string;
  sourceUrl: string;
  sourceQuote: string;
};

export type ExportConstructionCheck = {
  label: string;
  category: string;
  severity: string;
  status: string;
  explanation: string;
  ownerLabel?: string;
  note?: string;
};

export type ReadinessExport = {
  opportunityTitle: string;
  solicitationNumber?: string;
  agency?: string;
  solicitationUrl?: string;
  decision?: string;
  decisionRationale?: string;
  requirements: ExportRequirement[];
  checks: ExportConstructionCheck[];
  generatedAt: Date;
};

function safeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 72) || "readiness-packet"
  );
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadReadinessWorkbook(data: ReadinessExport) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Signal Garden";
  workbook.created = data.generatedAt;

  const overview = workbook.addWorksheet("Decision record", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  overview.columns = [
    { header: "Field", key: "field", width: 28 },
    { header: "Value", key: "value", width: 88 },
  ];
  overview.addRows([
    { field: "Opportunity", value: data.opportunityTitle },
    { field: "Solicitation", value: data.solicitationNumber ?? "Not recorded" },
    { field: "Agency", value: data.agency ?? "Not recorded" },
    { field: "Source", value: data.solicitationUrl ?? "Not recorded" },
    { field: "Human decision", value: data.decision ?? "Undecided" },
    { field: "Decision rationale", value: data.decisionRationale ?? "Not recorded" },
    { field: "Generated", value: data.generatedAt.toISOString() },
  ]);

  const matrix = workbook.addWorksheet("Compliance matrix", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  matrix.autoFilter = "A1:K1";
  matrix.columns = [
    { header: "Criticality", key: "criticality", width: 16 },
    { header: "Status", key: "status", width: 16 },
    { header: "Requirement", key: "requirement", width: 52 },
    { header: "Category", key: "category", width: 18 },
    { header: "With bid", key: "withBid", width: 12 },
    { header: "Owner", key: "owner", width: 22 },
    { header: "Due / timing", key: "due", width: 24 },
    { header: "Team note", key: "note", width: 40 },
    { header: "Source", key: "source", width: 34 },
    { header: "Source quote", key: "quote", width: 60 },
    { header: "Source URL", key: "url", width: 52 },
  ];
  matrix.addRows(
    data.requirements.map((requirement) => ({
      criticality: requirement.criticality,
      status: requirement.status,
      requirement: requirement.text,
      category: requirement.category,
      withBid: requirement.requiredWithBid ? "Yes" : "No",
      owner: requirement.ownerLabel ?? "Unassigned",
      due: requirement.dueDateText ?? "Not stated",
      note: requirement.note ?? "",
      source: requirement.sourceTitle,
      quote: requirement.sourceQuote,
      url: requirement.sourceUrl,
    })),
  );

  const checks = workbook.addWorksheet("Construction checks", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  checks.autoFilter = "A1:G1";
  checks.columns = [
    { header: "Severity", key: "severity", width: 16 },
    { header: "Status", key: "status", width: 18 },
    { header: "Construction check", key: "label", width: 42 },
    { header: "Category", key: "category", width: 18 },
    { header: "Owner", key: "owner", width: 22 },
    { header: "Team note", key: "note", width: 40 },
    { header: "Why it matters", key: "explanation", width: 70 },
  ];
  checks.addRows(
    data.checks.map((check) => ({
      severity: check.severity,
      status: check.status,
      label: check.label,
      category: check.category,
      owner: check.ownerLabel ?? "Unassigned",
      note: check.note ?? "",
      explanation: check.explanation,
    })),
  );

  for (const sheet of workbook.worksheets) {
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF111612" },
    };
    sheet.getRow(1).alignment = { vertical: "middle", wrapText: true };
    sheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
  }

  const bytes = await workbook.xlsx.writeBuffer();
  download(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${safeFileName(data.opportunityTitle)}-readiness.xlsx`,
  );
}

export async function downloadReadinessBrief(data: ReadinessExport) {
  const {
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");
  const line = (label: string, value: string) =>
    new Paragraph({
      children: [
        new TextRun({ text: `${label}: `, bold: true }),
        new TextRun(value),
      ],
    });
  const checkRows = data.checks.map(
    (check) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(check.severity)] }),
          new TableCell({ children: [new Paragraph(check.status)] }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: check.label, bold: true })] }),
              new Paragraph(check.explanation),
            ],
          }),
        ],
      }),
  );
  const requirementRows = data.requirements.map(
    (requirement) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(requirement.criticality)] }),
          new TableCell({ children: [new Paragraph(requirement.status)] }),
          new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: requirement.text, bold: true })] }),
              new Paragraph(`Source: ${requirement.sourceTitle}`),
              new Paragraph(`Evidence: ${requirement.sourceQuote}`),
            ],
          }),
        ],
      }),
  );
  const headerRow = (thirdColumn: string) =>
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ children: [new Paragraph("Severity")] }),
        new TableCell({ children: [new Paragraph("Status")] }),
        new TableCell({ children: [new Paragraph(thirdColumn)] }),
      ],
    });

  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: "SIGNAL GARDEN / SOURCE-VERIFIED PRE-BID READINESS",
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({ text: data.opportunityTitle, heading: HeadingLevel.HEADING_1 }),
          line("Solicitation", data.solicitationNumber ?? "Not recorded"),
          line("Agency", data.agency ?? "Not recorded"),
          line("Human decision", data.decision ?? "Undecided"),
          line("Decision rationale", data.decisionRationale ?? "Not recorded"),
          line("Generated", data.generatedAt.toISOString()),
          new Paragraph({
            text: "Construction readiness checks",
            heading: HeadingLevel.HEADING_1,
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow("Check and evidence standard"), ...checkRows],
          }),
          new Paragraph({ text: "Sourced compliance matrix", heading: HeadingLevel.HEADING_1 }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow("Requirement and source proof"), ...requirementRows],
          }),
          new Paragraph({
            text: "Signal Garden separates verified source evidence from unverified construction checks. Human reviewers retain the final bid/no-bid decision.",
          }),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(document);
  download(blob, `${safeFileName(data.opportunityTitle)}-readiness.docx`);
}
