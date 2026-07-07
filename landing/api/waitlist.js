// Vercel serverless function: waitlist signup → Resend.
// Env vars (set in Vercel project settings):
//   RESEND_API_KEY    (required)
//   RESEND_AUDIENCE_ID (optional — adds the contact to a Resend audience)
//   WAITLIST_FROM     (optional — defaults to onboarding@resend.dev; use a verified domain in prod)

const RESEND_API_URL = "https://api.resend.com";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Rate limit: max signups per IP within the window.
// ponytail: in-memory, so the limit is per warm instance, not global — good
// enough for a waitlist as a throttle on top of the captcha. For a hard global
// cap, back this with Vercel KV / Upstash Redis keyed by IP.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const rateHits = new Map();

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (rateHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (hits.length >= RATE_LIMIT_MAX) {
    rateHits.set(ip, hits);
    return true;
  }
  hits.push(now);
  rateHits.set(ip, hits);
  return false;
}

async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // No secret configured yet: don't block signups. Swap in real keys to enforce.
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY not set — captcha verification skipped");
    return true;
  }
  if (!token) return false;
  try {
    const params = new URLSearchParams({ secret, response: token });
    if (ip && ip !== "unknown") params.append("remoteip", ip);
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verify error:", err);
    return false;
  }
}

function welcomeEmail(lang) {
  // Email-client-safe: table layout, inline styles, hosted PNG logo, web-safe font fallbacks.
  const render = (c) => {
    const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
    const SANS = "'Plus Jakarta Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
    const step = (n, t) => `
              <tr>
                <td width="44" valign="top" style="font-family: ${SERIF}; font-size: 19px; font-weight: 600; color: #D4A843; padding: 0 0 16px;">${n}</td>
                <td valign="top" style="font-family: ${SANS}; font-size: 16px; font-weight:500; color: #1C1C1A; padding: 2px 0 16px;">${t}</td>
              </tr>`;
    return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light only" />
<meta name="supported-color-schemes" content="light only" />
<title>${c.subject}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
  body { margin:0; padding:0; }
  img { border:0; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
  a { text-decoration:none; }
</style>
</head>
<body style="margin:0; padding:0; background:#EFE9DD;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">${c.preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE9DD;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px; max-width:520px; background:#FFFEFB; border:1px solid rgba(27,67,50,0.10); border-radius:20px; overflow:hidden;">
          <!-- logo -->
          <tr>
            <td align="center" style="background:#FFFEFB; padding: 48px 40px 0;">
              <img src="https://leftovr.co/email-logo.png" width="148" alt="leftovr" style="display:block; margin:0 auto; width:148px; max-width:148px; height:auto; border:0;" />
            </td>
          </tr>
          <!-- body -->
          <tr>
            <td align="center" style="padding: 22px 46px 4px;">
              <h1 style="margin:0 0 16px; font-family: ${SERIF}; font-weight:600; font-size:32px; line-height:1.18; color:#1B4332;">${c.h1}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 46px 8px;">
              <p style="margin:0 0 16px; font-family: ${SANS}; font-size:16px; line-height:1.65; color:#5D6C60;">${c.p1}</p>
              <p style="margin:0 0 26px; font-family: ${SANS}; font-size:16px; line-height:1.65; color:#5D6C60;">${c.p2}</p>
            </td>
          </tr>
          <!-- steps card -->
          <tr>
            <td style="padding: 0 46px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F4EE; border:1px solid rgba(27,67,50,0.08); border-radius:16px;">
                <tr><td style="padding: 24px 26px 10px;">
                  <div style="font-family: ${SANS}; font-size:12px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#9AA59C; padding-bottom:18px;">${c.stepsTitle}</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    ${step("01", c.s1)}${step("02", c.s2)}${step("03", c.s3)}
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>
          <!-- signoff -->
          <tr>
            <td style="padding: 22px 46px 34px;">
              <p style="margin:0; font-family: ${SERIF}; font-size:16px; font-style:italic; color:#5D6C60;">${c.sign}</p>
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td align="center" style="padding: 24px 46px; border-top:1px solid rgba(27,67,50,0.10); background:#FFFEFB;">
              <a href="https://leftovr.co" style="font-family: ${SANS}; font-size:14px; font-weight:600; color:#1B4332; text-decoration:none;">leftovr.co</a>
              <p style="margin:8px 0 0; font-family: ${SANS}; font-size:12px; line-height:1.5; color:#9AA59C;">${c.footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  };

  if (lang === "sr") {
    return {
      subject: "Na listi čekanja za leftovr si",
      html: render({
        subject: "Na listi čekanja za leftovr si",
        preheader: "Skeniraj račun, vidi šta imaš, skuvaj ono što prvo treba pojesti.",
        h1: "Na listi si.",
        p1: "Hvala što si se prijavio/la na leftovr listu čekanja. Pravimo kuhinju koja vodi računa na osnovu računa — bez ručnog unosa, bez tabela.",
        p2: "Javićemo ti se čim leftovr bude spreman. Do tada — pojedi spanać dok je divan.",
        stepsTitle: "Kako radi",
        s1: "Slikaj račun",
        s2: "Kuhinja vodi računa",
        s3: "Skuvaj ono što imaš",
        sign: "— leftovr tim",
        footer: "Dobijaš ovaj mejl jer si se prijavio/la na leftovr listu čekanja.",
      }),
    };
  }
  return {
    subject: "You're on the leftovr waitlist",
    html: render({
      subject: "You're on the leftovr waitlist",
      preheader: "Scan a receipt, see what you have, cook what should go first.",
      h1: "You're on the list.",
      p1: "Thanks for joining the leftovr waitlist. We're building a receipt-powered kitchen that keeps track — no manual tracking, no spreadsheets, no guilt.",
      p2: "We'll email you the moment leftovr is ready. Until then — eat your spinach while it's wonderful.",
      stepsTitle: "How it works",
      s1: "Snap your receipt",
      s2: "Your kitchen keeps track",
      s3: "Cook what you have",
      sign: "— the leftovr team",
      footer: "You're getting this because you joined the leftovr waitlist.",
    }),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many attempts. Please try again in a few minutes." });
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

  // Captcha: block bots before doing any paid work (Resend calls).
  const captchaOk = await verifyTurnstile(body.turnstileToken, ip);
  if (!captchaOk) {
    res.status(403).json({ error: "Captcha verification failed. Please try again." });
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
      console.error(`Resend contact create FAILED for ${email} — status ${contactRes.status}: ${await contactRes.text()}`);
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
    const detail = await emailRes.text();
    console.error(`Resend welcome email FAILED for ${email} — status ${emailRes.status}: ${detail}`);
    if (audienceId) {
      // Contact was saved but the welcome email did not send — log loudly so it can be resent manually.
      console.error(`ACTION NEEDED: ${email} is on the waitlist but never got the welcome email — resend it.`);
      res.status(200).json({ ok: true });
    } else {
      res.status(502).json({ error: "Could not join the waitlist right now. Try again in a minute." });
    }
    return;
  }

  const sent = await emailRes.json().catch(() => ({}));
  console.log(`Welcome email sent to ${email}${sent.id ? ` (id ${sent.id})` : ""}`);
  res.status(200).json({ ok: true });
};

function safeParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
