// Chomp — Onboarding screens (Language pick, Hook 1-5, Signup, Personalize Q1-Q4)

// ─────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────
function PageDots({ count, current }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
      {Array.from({ length: count }).map((_, i) =>
      <div key={i} style={{
        width: i === current ? 22 : 6,
        height: 6,
        borderRadius: 999,
        background: i === current ? 'var(--primary)' : 'var(--hairline-strong)',
        transition: 'width 0.2s'
      }} />
      )}
    </div>);

}

function Wordmark({ size = 28 }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      chomp<span style={{ color: 'var(--accent)' }}>.</span>
    </span>);

}

function ScreenPad({ children, top = 24, bottom = 32, style = {} }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      padding: `${top}px 28px ${bottom}px`,
      minHeight: 0,
      ...style
    }}>
      {children}
    </div>);

}

// ─────────────────────────────────────────────────────────────
// LANGUAGE — "Choose your language" (first onboarding step)
// ─────────────────────────────────────────────────────────────
const CHOMP_LANG_KEY = 'chomp.lang';

function LanguagePick({ next }) {
  const [lang, setLang] = React.useState(() => {
    try { return localStorage.getItem(CHOMP_LANG_KEY) || 'en'; } catch (e) { return 'en'; }
  });
  const choose = (v) => {
    setLang(v);
    try { localStorage.setItem(CHOMP_LANG_KEY, v); } catch (e) {}
  };

  const langs = [
    { value: 'en', native: 'English', sub: 'English', flag: '🇬🇧' },
    { value: 'sr', native: 'Srpski', sub: 'Serbian', flag: '🇷🇸' }];


  return (
    <div className="screen">
      <ScreenPad top={92}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
          <Wordmark size={32} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <h1 className="t-display" style={{ margin: '0 0 10px' }}>
            Choose your <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>language</span>
          </h1>
          <p className="t-body muted" style={{ margin: 0 }}>
            Izaberite jezik. You can change this anytime in Settings.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {langs.map((l) => {
            const isSel = lang === l.value;
            return (
              <button key={l.value} onClick={() => choose(l.value)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 22px',
                background: isSel ? 'var(--primary)' : '#FFFEFB',
                color: isSel ? 'var(--surface)' : 'var(--text)',
                border: `1.5px solid ${isSel ? 'var(--primary)' : 'var(--hairline)'}`,
                borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'background 0.15s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                    background: isSel ? 'rgba(248,244,238,0.15)' : 'var(--surface-2)',
                    border: `1px solid ${isSel ? 'rgba(248,244,238,0.25)' : 'var(--hairline)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, lineHeight: 1
                  }}>{l.flag}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 17 }}>{l.native}</div>
                    {l.sub !== l.native && <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{l.sub}</div>}
                  </div>
                </div>
                <div style={{
                  width: 24, height: 24, borderRadius: 999,
                  border: `1.5px solid ${isSel ? 'var(--surface)' : 'var(--hairline-strong)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {isSel && <div style={{ width: 12, height: 12, borderRadius: 999, background: 'var(--surface)' }} />}
                </div>
              </button>);

          })}
        </div>

        <button className="btn-primary" onClick={next} style={{ marginTop: 16 }}>Continue</button>
      </ScreenPad>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// HOOK 1 — "How much food did you throw away last week?"
// ─────────────────────────────────────────────────────────────
function Hook1({ next }) {
  return (
    <div className="screen">
      <ScreenPad top={68}>
        <div style={{ marginBottom: 28 }}>
          <PageDots count={5} current={0} />
        </div>

        {/* Illustration: forgotten fridge */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
          <ForgottenFridge />
        </div>

        <div>
          <h1 className="t-display" style={{ margin: '0 0 16px', color: 'var(--text)' }}>
            How much food did you throw away <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>last week?</span>
          </h1>
          <p className="t-body muted" style={{ margin: '0 0 32px', maxWidth: '90%' }}>
            The average household tosses 30% of what they buy. That's about $1,500 a year — straight into the bin.
          </p>
          <button className="btn-primary" onClick={next}>Continue</button>
        </div>
      </ScreenPad>
    </div>);

}

function ForgottenFridge() {
  return (
    <svg width="220" height="220" viewBox="0 0 220 220" fill="none">
      <defs>
        <linearGradient id="fridge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1ECE2" />
          <stop offset="1" stopColor="#E8E1D3" />
        </linearGradient>
      </defs>
      {/* fridge body */}
      <rect x="50" y="20" width="120" height="180" rx="14" fill="url(#fridge)" stroke="#1B4332" strokeOpacity="0.15" />
      {/* divider */}
      <line x1="50" y1="78" x2="170" y2="78" stroke="#1B4332" strokeOpacity="0.15" />
      {/* handles */}
      <rect x="58" y="34" width="3" height="32" rx="1.5" fill="#1B4332" opacity="0.4" />
      <rect x="58" y="92" width="3" height="92" rx="1.5" fill="#1B4332" opacity="0.4" />
      {/* sad item */}
      <circle cx="115" cy="48" r="10" fill="#D4A843" opacity="0.4" />
      {/* dust/decay marks inside lower */}
      <circle cx="90" cy="120" r="6" fill="#6B7A6D" opacity="0.25" />
      <circle cx="130" cy="135" r="9" fill="#6B7A6D" opacity="0.2" />
      <circle cx="105" cy="160" r="5" fill="#6B7A6D" opacity="0.3" />
      <circle cx="145" cy="170" r="4" fill="#6B7A6D" opacity="0.25" />
      {/* question mark above */}
      <text x="190" y="32" fontSize="28" fill="#1B4332" opacity="0.4" fontFamily="Fraunces, serif" fontStyle="italic">?</text>
      <text x="34" y="64" fontSize="18" fill="#1B4332" opacity="0.3" fontFamily="Fraunces, serif" fontStyle="italic">?</text>
    </svg>);

}

// ─────────────────────────────────────────────────────────────
// HOOK 2 — "Your fridge has a memory problem. We fixed it."
// ─────────────────────────────────────────────────────────────
function Hook2({ next }) {
  return (
    <div className="screen">
      <ScreenPad top={68}>
        <div style={{ marginBottom: 28 }}><PageDots count={5} current={1} /></div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ReceiptToFridge />
        </div>

        <div>
          <h1 className="t-display" style={{ margin: '0 0 16px' }}>
            Your fridge has a memory problem. <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>We fixed it.</span>
          </h1>
          <p className="t-body muted" style={{ margin: '0 0 32px' }}>
            Snap your receipt. Chomp remembers every item, knows when each one's at its best, and quietly keeps track.
          </p>
          <button className="btn-primary" onClick={next}>Continue</button>
        </div>
      </ScreenPad>
    </div>);

}

function ReceiptToFridge() {
  return (
    <svg width="280" height="200" viewBox="0 0 280 200" fill="none">
      {/* receipt */}
      <g transform="translate(10,20)">
        <path d="M0 0 L80 0 L80 140 L70 132 L60 140 L50 132 L40 140 L30 132 L20 140 L10 132 L0 140 Z" fill="#FFFEFB" stroke="#1B4332" strokeOpacity="0.18" />
        <rect x="10" y="14" width="50" height="3" rx="1" fill="#1C1C1A" opacity="0.6" />
        <rect x="10" y="26" width="40" height="2" rx="1" fill="#6B7A6D" />
        <rect x="10" y="44" width="60" height="2" rx="1" fill="#6B7A6D" />
        <rect x="10" y="52" width="44" height="2" rx="1" fill="#6B7A6D" />
        <rect x="10" y="60" width="56" height="2" rx="1" fill="#6B7A6D" />
        <rect x="10" y="68" width="36" height="2" rx="1" fill="#6B7A6D" />
        <rect x="10" y="76" width="50" height="2" rx="1" fill="#6B7A6D" />
        <rect x="10" y="92" width="60" height="3" rx="1" fill="#1C1C1A" opacity="0.7" />
      </g>
      {/* arrow with sparkles */}
      <g transform="translate(110,90)">
        <path d="M0 10 L40 10 M30 0 L40 10 L30 20" stroke="#1B4332" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="-6" r="2" fill="#D4A843" />
        <circle cx="30" cy="26" r="2" fill="#D4A843" />
      </g>
      {/* fridge filling */}
      <g transform="translate(170,18)">
        <rect x="0" y="0" width="100" height="160" rx="12" fill="#F1ECE2" stroke="#1B4332" strokeOpacity="0.18" />
        <line x1="0" y1="62" x2="100" y2="62" stroke="#1B4332" strokeOpacity="0.15" />
        {/* items */}
        <rect x="10" y="14" width="22" height="36" rx="3" fill="#4F8A5B" opacity="0.7" />
        <rect x="38" y="14" width="22" height="36" rx="3" fill="#D4A843" opacity="0.85" />
        <rect x="66" y="14" width="22" height="36" rx="3" fill="#C76845" opacity="0.7" />
        <rect x="10" y="74" width="18" height="34" rx="3" fill="#1B4332" opacity="0.5" />
        <rect x="34" y="74" width="28" height="34" rx="3" fill="#4F8A5B" opacity="0.55" />
        <rect x="68" y="74" width="20" height="34" rx="3" fill="#D4A843" opacity="0.65" />
        <rect x="10" y="116" width="34" height="32" rx="3" fill="#6B7A6D" opacity="0.45" />
        <rect x="50" y="116" width="38" height="32" rx="3" fill="#4F8A5B" opacity="0.45" />
      </g>
    </svg>);

}

// ─────────────────────────────────────────────────────────────
// HOOK 3 — "Scan your receipt. We do the rest."
// ─────────────────────────────────────────────────────────────
function Hook3({ next }) {
  const Step = ({ n, label }) =>
  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{
      width: 36, height: 36, borderRadius: 999, background: 'var(--primary)',
      color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 15, flexShrink: 0
    }}>{n}</div>
      <span className="t-h3">{label}</span>
    </div>;


  return (
    <div className="screen">
      <ScreenPad top={68}>
        <div style={{ marginBottom: 28 }}><PageDots count={5} current={2} /></div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ScanLoop />
        </div>

        <div>
          <h1 className="t-display" style={{ margin: '0 0 20px' }}>
            Scan your receipt. <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>We do the rest.</span>
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            <Step n="1" label="Snap" />
            <Step n="2" label="Fridge updates" />
            <Step n="3" label="Cook tonight" />
          </div>
          <button className="btn-primary" onClick={next}>Continue</button>
        </div>
      </ScreenPad>
    </div>);

}

function ScanLoop() {
  return (
    <svg width="260" height="160" viewBox="0 0 260 160" fill="none">
      <g transform="translate(0,20)">
        <rect x="0" y="0" width="80" height="120" rx="10" fill="#FFFEFB" stroke="#1B4332" strokeOpacity="0.18" />
        {/* camera viewfinder corners */}
        <path d="M10 10 L10 20 M10 10 L20 10" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M70 10 L70 20 M70 10 L60 10" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M10 110 L10 100 M10 110 L20 110" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M70 110 L70 100 M70 110 L60 110" stroke="#D4A843" strokeWidth="2.5" strokeLinecap="round" />
        <rect x="20" y="30" width="40" height="2" rx="1" fill="#6B7A6D" />
        <rect x="20" y="40" width="32" height="2" rx="1" fill="#6B7A6D" />
        <rect x="20" y="50" width="44" height="2" rx="1" fill="#6B7A6D" />
      </g>
      <path d="M88 80 L98 80 M92 76 L98 80 L92 84" stroke="#1B4332" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(102,20)">
        <rect x="0" y="0" width="56" height="120" rx="8" fill="#F1ECE2" stroke="#1B4332" strokeOpacity="0.18" />
        <line x1="0" y1="50" x2="56" y2="50" stroke="#1B4332" strokeOpacity="0.15" />
        <rect x="6" y="8" width="12" height="34" rx="2" fill="#4F8A5B" opacity="0.7" />
        <rect x="22" y="8" width="12" height="34" rx="2" fill="#D4A843" opacity="0.85" />
        <rect x="38" y="8" width="12" height="34" rx="2" fill="#C76845" opacity="0.7" />
        <rect x="6" y="58" width="20" height="28" rx="2" fill="#4F8A5B" opacity="0.5" />
        <rect x="30" y="58" width="20" height="28" rx="2" fill="#1B4332" opacity="0.5" />
        <rect x="6" y="94" width="44" height="20" rx="2" fill="#D4A843" opacity="0.45" />
      </g>
      <path d="M166 80 L176 80 M170 76 L176 80 L170 84" stroke="#1B4332" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <g transform="translate(180,20)">
        <rect x="0" y="0" width="80" height="120" rx="10" fill="#FFFEFB" stroke="#1B4332" strokeOpacity="0.18" />
        {/* simple dish */}
        <ellipse cx="40" cy="80" rx="28" ry="6" fill="#1B4332" opacity="0.1" />
        <ellipse cx="40" cy="74" rx="26" ry="14" fill="#FFFEFB" stroke="#1B4332" strokeOpacity="0.3" />
        <ellipse cx="40" cy="70" rx="22" ry="10" fill="#D4A843" opacity="0.4" />
        <circle cx="32" cy="68" r="3" fill="#4F8A5B" />
        <circle cx="46" cy="65" r="2.5" fill="#C76845" />
        <circle cx="40" cy="74" r="2" fill="#1B4332" opacity="0.6" />
        <text x="40" y="106" fontSize="9" fill="#1B4332" textAnchor="middle" fontWeight="600">20 min</text>
      </g>
    </svg>);

}

// ─────────────────────────────────────────────────────────────
// HOOK 4 — "Never open your fridge wondering what to cook again."
// ─────────────────────────────────────────────────────────────
function Hook4({ next }) {
  return (
    <div className="screen">
      <ScreenPad top={68}>
        <div style={{ marginBottom: 28 }}><PageDots count={5} current={3} /></div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SocialProof />
        </div>

        <div>
          <h1 className="t-display" style={{ margin: '0 0 16px' }}>
            Never open the fridge <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>wondering</span> again.
          </h1>
          <p className="t-body muted" style={{ margin: '0 0 32px' }}>
            One tap gives you a recipe built from exactly what you've got — prioritised by what to eat first.
          </p>
          <button className="btn-primary" onClick={next}>Continue</button>
        </div>
      </ScreenPad>
    </div>);

}

function SocialProof() {
  const Quote = ({ text, who, offset, rot, bg }) =>
  <div style={{
    position: 'absolute',
    transform: `translate(${offset[0]}px, ${offset[1]}px) rotate(${rot}deg)`,
    width: 200,
    padding: '14px 16px',
    background: bg,
    borderRadius: 14,
    border: '1px solid var(--hairline)',
    boxShadow: '0 10px 24px rgba(27,67,50,0.06)'
  }}>
      <div className="t-small" style={{ color: 'var(--text)', marginBottom: 6 }}>"{text}"</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>— {who}</div>
    </div>;

  return (
    <div style={{ position: 'relative', width: 280, height: 220 }}>
      <Quote text="I haven't binned a vegetable in a month." who="Maya, London" offset={[-20, 0]} rot={-3} bg="#FFFEFB" />
      <Quote text="Finally know what's in my own fridge." who="Daniel, NYC" offset={[60, 90]} rot={4} bg="#F0DDA8" />
    </div>);

}

// ─────────────────────────────────────────────────────────────
// HOOK 5 — CTA
// ─────────────────────────────────────────────────────────────
function Hook5({ next }) {
  return (
    <div className="screen">
      <ScreenPad top={68}>
        <div style={{ marginBottom: 28 }}><PageDots count={5} current={4} /></div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Wordmark size={64} />
            <div className="t-small muted" style={{ marginTop: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 11 }}>
              what's for dinner?
            </div>
          </div>
        </div>

        <div>
          <h1 className="t-display" style={{ margin: '0 0 12px', textAlign: 'center' }}>
            Let's get you fed.
          </h1>
          <p className="t-body muted" style={{ margin: '0 0 28px', textAlign: 'center' }}>
            Free. No card needed.
          </p>
          <button className="btn-primary" onClick={next}>Get started — it's free</button>
        </div>
      </ScreenPad>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SIGNUP
// ─────────────────────────────────────────────────────────────
function Signup({ next, onAuth }) {
  const pick = onAuth || (() => {});
  const AuthBtn = ({ icon, label, method, bg, fg, border }) =>
  <button onClick={() => { pick(method); next(); }} style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    width: '100%', height: 56, borderRadius: 999,
    background: bg, color: fg, border: border || 'none',
    fontFamily: 'inherit', fontWeight: 600, fontSize: 16, cursor: 'pointer'
  }}>
      {icon}<span>{label}</span>
    </button>;


  return (
    <div className="screen">
      <ScreenPad top={88}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 48 }}>
          <Wordmark size={36} />
          <p className="t-body muted" style={{ marginTop: 18, textAlign: 'center', maxWidth: 260 }}>
            Create an account so your fridge follows you across devices.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <AuthBtn
            method="apple"
            bg="#000" fg="#fff"
            icon={<svg width="18" height="20" viewBox="0 0 18 20" fill="#fff"><path d="M14.6 10.6c0-2 1.6-3 1.7-3-0.9-1.4-2.4-1.6-2.9-1.6-1.2-0.1-2.4 0.7-3 0.7-0.6 0-1.6-0.7-2.6-0.7-1.3 0-2.5 0.8-3.2 2-1.4 2.4-0.4 5.9 1 7.8 0.7 0.9 1.5 2 2.5 1.9 1 0 1.4-0.6 2.6-0.6 1.2 0 1.5 0.6 2.6 0.6 1.1 0 1.8-0.9 2.4-1.9 0.8-1.1 1.1-2.1 1.1-2.2-0.1-0.1-2.2-0.8-2.2-3zm-2-5.6c0.5-0.6 0.9-1.5 0.8-2.4-0.8 0-1.7 0.5-2.2 1.2-0.5 0.5-0.9 1.5-0.8 2.3 0.9 0.1 1.7-0.4 2.2-1.1z" /></svg>}
            label="Continue with Apple" />
          
          <AuthBtn
            method="google"
            bg="#FFFEFB" fg="#1C1C1A" border="1px solid var(--hairline-strong)"
            icon={<svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8c-.2 1.1-.8 2.1-1.8 2.7v2.3h2.9c1.7-1.6 2.7-3.9 2.7-6.6z" /><path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2L12.1 13.5c-.8.5-1.9.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.4C2.4 15.9 5.5 18 9 18z" /><path fill="#FBBC04" d="M3.9 10.7c-.2-.5-.3-1.1-.3-1.7s.1-1.2.3-1.7V4.9H.9C.3 6.1 0 7.5 0 9s.3 2.9.9 4.1l3-2.4z" /><path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.4l2.6-2.6C13.5.9 11.4 0 9 0 5.5 0 2.4 2.1.9 4.9l3 2.4C4.6 5.1 6.6 3.6 9 3.6z" /></svg>}
            label="Continue with Google" />
          
          <AuthBtn
            method="email"
            bg="var(--primary)" fg="var(--surface)"
            icon={<svg width="18" height="14" viewBox="0 0 18 14" fill="none"><rect x="0.5" y="0.5" width="17" height="13" rx="2" stroke="#F8F4EE" strokeWidth="1.5" /><path d="M1 2L9 8L17 2" stroke="#F8F4EE" strokeWidth="1.5" strokeLinecap="round" /></svg>}
            label="Continue with email" />
          
        </div>

        <div style={{ flex: 1 }} />

        <p className="t-small muted" style={{ textAlign: 'center', marginTop: 24 }}>
          By continuing you agree to our <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Terms</span> and <span style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Privacy</span>.
        </p>
      </ScreenPad>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// NAME — captured after signup. Prefilled from Google/Apple,
// asked outright when the user signed up with email.
// ─────────────────────────────────────────────────────────────
function NameScreen({ next, method = 'email' }) {
  const providerName = { google: 'Jovana Marković', apple: 'Jovana Marković' };
  const provider = method === 'google' ? 'Google' : method === 'apple' ? 'Apple' : null;
  const [name, setName] = React.useState(providerName[method] || '');
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    setName(providerName[method] || '');
  }, [method]);

  const valid = name.trim().length > 0;
  const go = () => {
    if (!valid) return;
    try { localStorage.setItem('chomp.name', name.trim()); } catch (e) {}
    next();
  };

  return (
    <div className="screen">
      <ScreenPad top={100}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="t-display" style={{ margin: '0 0 10px' }}>
            What should we <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>call you?</span>
          </h1>
          <p className="t-body muted" style={{ margin: 0 }}>
            {provider ?
            `We pulled this from your ${provider} account — edit it if it's not quite right.` :
            "We'll use it to greet you and personalise your recipes."}
          </p>
        </div>

        <div>
          <label className="t-micro" style={{ color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
            Your name
          </label>
          <div style={{ position: 'relative' }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="e.g. Mila"
              style={{
                width: '100%', height: 60, padding: '0 18px',
                background: '#FFFEFB', color: 'var(--text)',
                border: `1.5px solid ${focused ? 'var(--primary)' : 'var(--hairline-strong)'}`,
                borderRadius: 16, outline: 'none',
                fontFamily: 'inherit', fontWeight: 600, fontSize: 18,
                boxShadow: focused ? '0 0 0 4px var(--primary-50)' : 'none',
                transition: 'border 0.15s, box-shadow 0.15s'
              }} />

            {valid &&
            <svg width="22" height="22" viewBox="0 0 22 22" style={{ position: 'absolute', right: 18, top: 19 }}>
                <circle cx="11" cy="11" r="11" fill="var(--green)" />
                <path d="M6 11.5L9.5 15L16 8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          </div>

          {provider &&
          <div className="chip" style={{ marginTop: 12 }}>
              <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6L5 9L10 3" stroke="var(--primary)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              From your {provider} account
            </div>
          }
        </div>

        <div style={{ flex: 1 }} />

        <button className="btn-primary" onClick={go} disabled={!valid} style={{
          opacity: valid ? 1 : 0.4,
          cursor: valid ? 'pointer' : 'not-allowed'
        }}>Continue</button>
      </ScreenPad>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// PERSONALIZATION — shared question screen
// ─────────────────────────────────────────────────────────────
function QuestionScreen({ step, total, eyebrow, title, subtitle, options, selected, onSelect, next, multi = false, skippable = false }) {
  return (
    <div className="screen">
      <ScreenPad top={68}>
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--hairline)' }}>
            <div style={{
              width: `${step / total * 100}%`, height: '100%',
              borderRadius: 4, background: 'var(--primary)',
              transition: 'width 0.3s'
            }} />
          </div>
          <span className="t-small muted">{step}/{total}</span>
        </div>

        <div style={{ marginBottom: 24 }}>
          {eyebrow && <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 10 }}>{eyebrow}</div>}
          <h1 className="t-h1" style={{ margin: '0 0 8px', maxWidth: '92%' }}>{title}</h1>
          {subtitle && <p className="t-body muted" style={{ margin: 0 }}>{subtitle}</p>}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
          {options.map((opt) => {
            const isSelected = multi ? selected.includes(opt.value) : selected === opt.value;
            return (
              <button key={opt.value} onClick={() => onSelect(opt.value)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '20px 22px',
                background: isSelected ? 'var(--primary)' : '#FFFEFB',
                color: isSelected ? 'var(--surface)' : 'var(--text)',
                border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--hairline)'}`,
                borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'background 0.15s'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {opt.emoji && <span style={{ fontSize: 22 }}>{opt.emoji}</span>}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{opt.label}</div>
                    {opt.sub && <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>{opt.sub}</div>}
                  </div>
                </div>
                {multi &&
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: `1.5px solid ${isSelected ? 'var(--surface)' : 'var(--hairline-strong)'}`,
                  background: isSelected ? 'var(--surface)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    {isSelected && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6L5 9L10 3" stroke="#1B4332" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                  </div>
                }
              </button>);

          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <button className="btn-primary" onClick={next}>Continue</button>
          {skippable && <button className="btn-text" onClick={next}>Skip for now</button>}
        </div>
      </ScreenPad>
    </div>);

}

function PQ1({ next }) {
  const [sel, setSel] = React.useState('partner');
  return <QuestionScreen
    step={1} total={4}
    eyebrow="A few quick questions"
    title="Who are you cooking for?"
    subtitle="This sets your default serving sizes."
    options={[
    { value: 'me', label: 'Just me', sub: '1 serving', emoji: '🍽️' },
    { value: 'partner', label: 'Me and a partner', sub: '2 servings', emoji: '🍽️🍽️' },
    { value: 'family', label: 'Family (3 – 4)', sub: '4 servings', emoji: '👨‍👩‍👧' },
    { value: 'big', label: 'A bigger household', sub: '5+ servings', emoji: '🏠' }]
    }
    selected={sel} onSelect={setSel}
    next={next} />;

}

function PQ2({ next }) {
  const [sel, setSel] = React.useState('weekly');
  return <QuestionScreen
    step={2} total={4}
    eyebrow="How you shop"
    title="How do you usually shop?"
    subtitle="So we know how often to check in."
    options={[
    { value: 'weekly', label: 'One big weekly shop' },
    { value: 'few', label: 'A few times a week' },
    { value: 'asneed', label: 'Whenever I need something' }]
    }
    selected={sel} onSelect={setSel}
    next={next} />;

}

function PQ3({ next }) {
  const [sel, setSel] = React.useState('waste');
  return <QuestionScreen
    step={3} total={4}
    eyebrow="What matters"
    title="What matters most to you?"
    subtitle="We'll frame things in the way that lands for you."
    options={[
    { value: 'waste', label: 'Reducing food waste' },
    { value: 'money', label: 'Saving money' },
    { value: 'quick', label: 'Quick meal ideas' },
    { value: 'all', label: 'All of the above' }]
    }
    selected={sel} onSelect={setSel}
    next={next} />;

}

function PQ4({ next }) {
  const [sel, setSel] = React.useState(['fish']);
  const toggle = (v) => setSel((s) => s.includes(v) ? s.filter((x) => x !== v) : [...s, v]);
  return <QuestionScreen
    step={4} total={4}
    eyebrow="Dietary"
    title="Anything you never eat?"
    subtitle="We'll keep these out of recipe suggestions."
    options={[
    { value: 'meat', label: 'Meat' },
    { value: 'fish', label: 'Fish & seafood' },
    { value: 'dairy', label: 'Dairy' },
    { value: 'gluten', label: 'Gluten' },
    { value: 'nuts', label: 'Nuts' }]
    }
    selected={sel} onSelect={toggle}
    multi skippable
    next={next} />;

}

window.OnboardingScreens = { LanguagePick, Hook1, Hook2, Hook3, Hook4, Hook5, Signup, NameScreen, PQ1, PQ2, PQ3, PQ4 };
