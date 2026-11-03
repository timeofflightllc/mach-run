import { BETA_SECTIONS, betaPlanLabel, type BetaAnswers } from "./form";

export type BetaExportRow = {
  name: string;
  email: string;
  pass: number;
  submittedAt: string;
  answers: BetaAnswers;
};

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

const CSV_HEAD = [
  "name",
  "email",
  "tested_on",
  "device",
  "plan",
  ...BETA_SECTIONS.flatMap((section) => [
    `${section.key}_notes`,
    ...section.prompts.map((_, index) => `${section.key}_${index + 1}`),
  ]),
  "hat_full_name",
  "hat_line1",
  "hat_line2",
  "hat_city",
  "hat_state",
  "hat_zip",
  "hat_country",
  "hat_notes",
  "hat_decline",
  "pass",
  "submitted_at",
];

export function betaCsv(rows: BetaExportRow[]): string {
  const lines = [CSV_HEAD.join(",")];
  for (const row of rows) {
    const answers = row.answers;
    const cells = [
      answers.name,
      answers.email || row.email,
      answers.testedOn,
      answers.device,
      betaPlanLabel(answers.plan),
      ...BETA_SECTIONS.flatMap((section) => [
        answers.sections[section.key].notes,
        ...section.prompts.map((_, index) => answers.sections[section.key].replies[index] ?? ""),
      ]),
      answers.hat.fullName,
      answers.hat.line1,
      answers.hat.line2,
      answers.hat.city,
      answers.hat.state,
      answers.hat.zip,
      answers.hat.country,
      answers.hat.notes,
      yesNo(answers.hat.decline),
      String(row.pass),
      row.submittedAt,
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n");
}

export function betaText(row: BetaExportRow): string {
  const answers = row.answers;
  const lines = [
    "MACH RUN beta debrief",
    `Pass: ${row.pass}`,
    `Submitted: ${row.submittedAt}`,
    `Name: ${answers.name}`,
    `Email: ${answers.email || row.email}`,
    `Date of testing: ${answers.testedOn}`,
    `Device / browser: ${answers.device}`,
    `Plan: ${betaPlanLabel(answers.plan)}`,
    "",
  ];
  for (const section of BETA_SECTIONS) {
    const answer = answers.sections[section.key];
    if (section.phase) lines.push(section.phase);
    lines.push(section.title);
    if (answer.notes.trim()) {
      lines.push(answer.notes);
      lines.push("");
    }
    section.prompts.forEach((prompt, index) => {
      lines.push(prompt);
      lines.push(answer.replies[index] ?? "");
      lines.push("");
    });
  }
  lines.push("Thank-you gift — mailing address");
  lines.push(`Please do not send a hat: ${yesNo(answers.hat.decline)}`);
  lines.push(`Full name: ${answers.hat.fullName}`);
  lines.push(`Street address (line 1): ${answers.hat.line1}`);
  lines.push(`Street address (line 2): ${answers.hat.line2}`);
  lines.push(`City: ${answers.hat.city}`);
  lines.push(`State: ${answers.hat.state}`);
  lines.push(`ZIP: ${answers.hat.zip}`);
  lines.push(`Country: ${answers.hat.country}`);
  lines.push(`Delivery notes: ${answers.hat.notes}`);
  return lines.join("\n");
}
