import nodemailer from "nodemailer";

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function sendEditLinkMail(input: {
  to: string;
  personName: string;
  editUrl: string;
}) {
  const host = requireEnv("SMTP_HOST");
  const port = Number(process.env.SMTP_PORT || "587");
  const user = requireEnv("SMTP_USER");
  const pass = requireEnv("SMTP_PASS");
  const from = requireEnv("SMTP_FROM");
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });

  await transport.sendMail({
    from,
    to: input.to,
    subject: "Bearbeitungslink fuer das UKB Telefonbuch",
    text: [
      `Hallo ${input.personName},`,
      "",
      "du hast einen Bearbeitungslink fuer deinen Kontakt im UKB Telefonbuch angefordert.",
      "Bitte nutze diesen Link nur, wenn du diese Person selbst bist.",
      "",
      input.editUrl,
      "",
      "Falls du diese Anfrage nicht selbst ausgelöst hast, ignoriere diese E-Mail.",
    ].join("\n"),
  });
}
