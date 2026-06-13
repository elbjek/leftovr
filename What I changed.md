 What I changed
  - Added landing/api/waitlist.js — Vercel serverless function (Resend signup + welcome
  email, EN/SR, honeypot, validation). No npm deps, no build.
  - WAITLIST_ENDPOINT → /api/waitlist (same origin, no CORS, no Supabase).

  Deploy (dashboard — easiest)
  1. Push the branch: git add landing && git commit && git push (you commit — I don't
  push without asking).
  2. vercel.com/new → import elbjek/chomp.
  3. Set Root Directory = landing (critical — repo root is the Expo app, not the web
  build). Click Edit next to Root Directory.
  4. Framework Preset = Other. Leave build command empty, output dir empty (static +
  /api auto-detected).
  5. Add env var RESEND_API_KEY = your re_… key. Optional: RESEND_AUDIENCE_ID,
  WAITLIST_FROM (use a verified domain like leftovr <hello@leftovr.app> once your
  domain's verified in Resend; until then it defaults to onboarding@resend.dev).
  6. Deploy.

  Deploy (CLI alternative)
  cd landing
  npx vercel        # first run links/creates project — accept defaults, root is current
  dir
  npx vercel env add RESEND_API_KEY     # paste key, choose Production
  npx vercel --prod

  After deploy
  - Test the form on the live URL → expect the success message + a welcome email.
  - Resend free tier only sends from onboarding@resend.dev to your own verified address
  until you verify a sending domain. To email any signup, verify leftovr.app in Resend →
  DNS records → set WAITLIST_FROM.

  Note: the old supabase/functions/waitlist is now unused by the landing page — harmless
  to leave, or delete it. Want me to remove it?