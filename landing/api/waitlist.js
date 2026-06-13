// Vercel serverless function: waitlist signup → Resend.
// Env vars (set in Vercel project settings):
//   RESEND_API_KEY    (required)
//   RESEND_AUDIENCE_ID (optional — adds the contact to a Resend audience)
//   WAITLIST_FROM     (optional — defaults to onboarding@resend.dev; use a verified domain in prod)

const RESEND_API_URL = "https://api.resend.com";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function welcomeEmail(lang) {
  const wrap = (h1, p1, p2, sign) => `
<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1C1C1A;">
  <h1 style="color: #1B4332; font-weight: 500; font-size: 28px; margin-bottom: 16px;">${h1}</h1>
  <p style="font-size: 16px; line-height: 1.6; color: #5D6C60;">${p1}</p>
  <p style="font-size: 16px; line-height: 1.6; color: #5D6C60;">${p2}</p>
  <p style="font-size: 14px; color: #9AA59C; margin-top: 32px;">${sign}</p>
</div>`;

  if (lang === "sr") {
    return {
      subject: "Na listi čekanja za leftovr si",
      html: wrap(
        "Na listi si.",
        "Hvala što si se prijavio/la na leftovr listu čekanja. Pravimo virtuelni frižider pokretan računom: skeniraj račun, vidi šta imaš i skuvaj ono što prvo treba pojesti.",
        "Javićemo ti se čim leftovr bude spreman. Do tada &mdash; pojedi spanać dok je divan.",
        "&mdash; leftovr tim",
      ),
    };
  }
  return {
    subject: "You're on the leftovr waitlist",
    html: wrap(
      "You're on the list.",
      "Thanks for joining the leftovr waitlist. We're building a receipt-powered virtual fridge: scan your grocery receipt, see what you have, and cook what should be eaten first.",
      "We'll email you the moment leftovr is ready. Until then &mdash; eat your spinach while it's wonderful.",
      "&mdash; the leftovr team",
    ),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    res.status(500).json({ error: "Waitlist is not configured yet" });
    return;
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
  // Honeypot: real users never fill it, bots do.
  if (typeof body.company === "string" && body.company.length > 0) {
    res.status(200).json({ ok: true });
    return;
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const lang = body.lang === "sr" ? "sr" : "en";

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "Please enter a valid email address" });
    return;
  }

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (audienceId) {
    const contactRes = await fetch(`${RESEND_API_URL}/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    // 409 = already on the list; treat as success.
    if (!contactRes.ok && contactRes.status !== 409) {
      console.error("Resend contact create failed", contactRes.status, await contactRes.text());
      res.status(502).json({ error: "Could not join the waitlist right now. Try again in a minute." });
      return;
    }
  }

  const from = process.env.WAITLIST_FROM || "leftovr <onboarding@resend.dev>";
  const welcome = welcomeEmail(lang);
  const emailRes = await fetch(`${RESEND_API_URL}/emails`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ from, to: [email], subject: welcome.subject, html: welcome.html }),
  });
  if (!emailRes.ok) {
    console.error("Resend email send failed", emailRes.status, await emailRes.text());
    if (audienceId) {
      // Contact was saved — still report success to the visitor.
      res.status(200).json({ ok: true });
    } else {
      res.status(502).json({ error: "Could not join the waitlist right now. Try again in a minute." });
    }
    return;
  }

  res.status(200).json({ ok: true });
};

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
