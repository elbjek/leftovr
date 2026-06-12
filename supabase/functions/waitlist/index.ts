const RESEND_API_URL = "https://api.resend.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const WELCOME_HTML = `
<div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1C1C1A;">
  <h1 style="color: #1B4332; font-weight: 500; font-size: 28px; margin-bottom: 16px;">You're on the list.</h1>
  <p style="font-size: 16px; line-height: 1.6; color: #5D6C60;">
    Thanks for joining the leftovr waitlist. We're building a receipt-powered virtual fridge:
    scan your grocery receipt, see what you have, and cook what should be eaten first.
  </p>
  <p style="font-size: 16px; line-height: 1.6; color: #5D6C60;">
    We'll email you the moment leftovr is ready. Until then &mdash; eat your spinach while it's wonderful.
  </p>
  <p style="font-size: 14px; color: #9AA59C; margin-top: 32px;">&mdash; the leftovr team</p>
</div>
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return json(500, { error: "Waitlist is not configured yet" });
  }

  let email: string | undefined;
  try {
    const body = await req.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : undefined;
    // Honeypot field: real users never fill it, bots do.
    if (typeof body?.company === "string" && body.company.length > 0) {
      return json(200, { ok: true });
    }
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return json(400, { error: "Please enter a valid email address" });
  }

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const audienceId = Deno.env.get("RESEND_AUDIENCE_ID");
  if (audienceId) {
    const contactRes = await fetch(`${RESEND_API_URL}/audiences/${audienceId}/contacts`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email, unsubscribed: false }),
    });
    // 409 = already on the list; treat as success so re-submits stay friendly.
    if (!contactRes.ok && contactRes.status !== 409) {
      console.error("Resend contact create failed", contactRes.status, await contactRes.text());
      return json(502, { error: "Could not join the waitlist right now. Try again in a minute." });
    }
  }

  const from = Deno.env.get("WAITLIST_FROM") ?? "leftovr <onboarding@resend.dev>";
  const emailRes = await fetch(`${RESEND_API_URL}/emails`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      from,
      to: [email],
      subject: "You're on the leftovr waitlist",
      html: WELCOME_HTML,
    }),
  });
  if (!emailRes.ok) {
    console.error("Resend email send failed", emailRes.status, await emailRes.text());
    // Contact was saved (if audience configured) — still report success to the visitor.
    return json(audienceId ? 200 : 502, audienceId ? { ok: true } : { error: "Could not join the waitlist right now. Try again in a minute." });
  }

  return json(200, { ok: true });
});
