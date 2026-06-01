// Chomp — Setup screens (Fill fridge, Scan, Processing, Celebration, Notification)
// and Core app screens (Home, Recipes, Recipe detail, Cooked, Insights, Paywall)

// ─────────────────────────────────────────────────────────────
// Helpers reused — minimal local versions
// ─────────────────────────────────────────────────────────────
const Pad = ({ children, top = 24, bottom = 32, style = {} }) =>
<div style={{
  flex: 1, display: 'flex', flexDirection: 'column',
  padding: `${top}px 24px ${bottom}px`, minHeight: 0, ...style
}}>{children}</div>;


// ─────────────────────────────────────────────────────────────
// BOTTOM NAVIGATION — shared across the main app pages.
// 4 tabs (Fridge · Recipes · Insights · Settings) + a raised
// center Scan action that opens the scan-choice sheet.
// ─────────────────────────────────────────────────────────────
const TAB_ICONS = {
  fridge: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2.5" width="12" height="19" rx="3.5" />
      <line x1="6" y1="10" x2="18" y2="10" />
      <line x1="9" y1="6" x2="9" y2="7.5" />
      <line x1="9" y1="13" x2="9" y2="16" />
    </svg>),
  recipes: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 3v18" />
      <path d="M5 3v5a2 2 0 0 0 4 0V3" />
      <path d="M17 3c-1.6 1-2.6 3-2.6 6 0 2 1.1 3 2.6 3.2V21" />
    </svg>),
  insights: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="20" x2="5" y2="13" />
      <line x1="12" y1="20" x2="12" y2="8" />
      <line x1="19" y1="20" x2="19" y2="11" />
    </svg>),
  settings: (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="15" cy="8" r="2.6" fill="var(--surface)" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="9" cy="16" r="2.6" fill="var(--surface)" />
    </svg>),
  scan: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14v18l-2.3-1.8-2.35 1.8L12 19.2 9.65 21 7.3 19.2 5 21V3z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="13" y2="12" />
    </svg>)
};

function TabBar({ active, nav, onScan }) {
  const tabs = [
  { id: 'fridge', label: 'Fridge', screen: 'home' },
  { id: 'recipes', label: 'Recipes', screen: 'recipeslist' },
  { id: 'insights', label: 'Insights', screen: 'insights' },
  { id: 'settings', label: 'Settings', screen: 'settings' }];


  const Tab = ({ t }) => {
    const on = active === t.id;
    return (
      <button onClick={() => nav && nav(t.screen)} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        color: on ? 'var(--primary)' : 'var(--muted-2)', fontFamily: 'inherit'
      }}>
        {TAB_ICONS[t.id]}
        <span style={{ fontSize: 10.5, fontWeight: on ? 700 : 600, letterSpacing: '0.01em' }}>{t.label}</span>
      </button>);

  };

  return (
    <div style={{
      position: 'relative',
      background: 'var(--surface)',
      borderTop: '1px solid var(--hairline)',
      padding: '10px 26px 26px',
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
      alignItems: 'start', justifyItems: 'center'
    }}>
      <Tab t={tabs[0]} />
      <Tab t={tabs[1]} />

      {/* Center scan FAB — raised */}
      <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
        <button onClick={onScan} aria-label="Scan" style={{
          position: 'absolute', top: -26,
          width: 60, height: 60, borderRadius: 999,
          background: 'var(--primary)', color: 'var(--surface)',
          border: '4px solid var(--surface)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(27,67,50,0.32)'
        }}>
          {TAB_ICONS.scan}
        </button>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary)', marginTop: 39, letterSpacing: '0.01em' }}>Scan</span>
      </div>

      <Tab t={tabs[2]} />
      <Tab t={tabs[3]} />
    </div>);

}

// Wraps an optional floating CTA above the tab bar; pin to screen bottom.
function BottomDock({ active, nav, onScan, children }) {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20 }}>
      {children &&
      <div style={{
        padding: '16px 20px 14px',
        background: 'linear-gradient(to top, var(--surface) 72%, rgba(248,244,238,0))'
      }}>
          {children}
        </div>
      }
      <TabBar active={active} nav={nav} onScan={onScan} />
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCAN CHOICE — bottom sheet opened by the center tab action.
// Scan receipt is the primary focus; barcode + manual are secondary.
// ─────────────────────────────────────────────────────────────
function ScanChoice({ nav, back }) {
  const go = (id) => () => nav && nav(id);

  const SecondaryOption = ({ icon, title, sub, onClick }) =>
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 14, width: '100%',
    padding: '16px 16px', background: '#FFFEFB', textAlign: 'left',
    border: '1px solid var(--hairline)', borderRadius: 16,
    cursor: 'pointer', fontFamily: 'inherit'
  }}>
      <div style={{
      width: 44, height: 44, borderRadius: 12, background: 'var(--primary-50)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</div>
        <div className="t-small muted" style={{ marginTop: 2 }}>{sub}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 4l4 4-4 4" stroke="var(--muted)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>;


  return (
    <div className="screen" style={{ background: 'rgba(28,28,26,0.5)', justifyContent: 'flex-end' }}>
      <div onClick={back} style={{ flex: 1 }} />

      <div style={{
        background: 'var(--surface)', borderRadius: '28px 28px 0 0',
        padding: '12px 24px 36px', boxShadow: '0 -20px 40px rgba(0,0,0,0.15)'
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '0 auto 22px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 className="t-h2" style={{ margin: 0 }}>Add to your fridge</h2>
          <button onClick={back} style={{
            width: 34, height: 34, borderRadius: 999, background: '#FFFEFB',
            border: '1px solid var(--hairline)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="13" height="13" viewBox="0 0 13 13"><path d="M2 2l9 9M11 2l-9 9" stroke="var(--text)" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
        </div>

        {/* Primary: scan a receipt */}
        <button onClick={go('camera')} style={{
          display: 'flex', alignItems: 'center', gap: 16, width: '100%', textAlign: 'left',
          padding: '20px 20px', marginBottom: 12,
          background: 'linear-gradient(135deg, var(--primary) 0%, #1F4E39 100%)',
          color: 'var(--surface)', border: 'none', borderRadius: 20,
          cursor: 'pointer', fontFamily: 'inherit', position: 'relative'
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: 'rgba(248,244,238,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--surface)'
          }}>
            {TAB_ICONS.scan}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>Scan a receipt</span>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                background: 'var(--accent)', color: 'var(--text)', padding: '3px 7px', borderRadius: 999
              }}>Fastest</span>
            </div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>20–30 items in 10 seconds</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 18 18"><path d="M6 4l6 5-6 5" stroke="var(--surface)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SecondaryOption
            onClick={go('camera')}
            title="Scan a barcode"
            sub="One item at a time"
            icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <line x1="4" y1="5" x2="4" y2="17" stroke="#1B4332" strokeWidth="1.6" />
                <line x1="7" y1="5" x2="7" y2="17" stroke="#1B4332" strokeWidth="2.6" />
                <line x1="10" y1="5" x2="10" y2="17" stroke="#1B4332" strokeWidth="1.6" />
                <line x1="13" y1="5" x2="13" y2="17" stroke="#1B4332" strokeWidth="2.6" />
                <line x1="16" y1="5" x2="16" y2="17" stroke="#1B4332" strokeWidth="1.6" />
                <line x1="18" y1="5" x2="18" y2="17" stroke="#1B4332" strokeWidth="1.6" />
              </svg>
            } />

          <SecondaryOption
            onClick={go('home')}
            title="Add manually"
            sub="Search and tap to add"
            icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="10" cy="10" r="6" stroke="#1B4332" strokeWidth="1.6" />
                <path d="M14.5 14.5L18 18" stroke="#1B4332" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            } />

        </div>
      </div>
    </div>);

}


// Food card placeholder — minimal colored card with name + small icon mark
function FoodCard({ name, category, days, urgency = 'green', size = 'sm' }) {
  const palette = {
    dairy: { bg: '#F0DDA8', mark: '#1B4332' },
    meat: { bg: '#E8C3B0', mark: '#1B4332' },
    veg: { bg: '#C8D5C2', mark: '#1B4332' },
    fruit: { bg: '#E8B59E', mark: '#1B4332' },
    pantry: { bg: '#E5D9C4', mark: '#1B4332' },
    grain: { bg: '#E5D9C4', mark: '#1B4332' }
  }[category] || { bg: '#E8E1D3', mark: '#1B4332' };

  const dotClass = `dot dot-${urgency}`;
  const isLg = size === 'lg';

  return (
    <div style={{
      background: '#FFFEFB',
      borderRadius: 14,
      border: '1px solid var(--hairline)',
      padding: isLg ? 12 : 10,
      display: 'flex', flexDirection: 'column', gap: isLg ? 10 : 8
    }}>
      <div style={{
        aspectRatio: '1 / 1', borderRadius: 10,
        background: `linear-gradient(135deg, ${palette.bg} 0%, ${palette.bg}cc 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        <FoodGlyph name={name} color={palette.mark} />
        <div style={{ position: 'absolute', top: 6, right: 6 }}>
          <span className={dotClass} />
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: isLg ? 14 : 13, color: 'var(--text)', lineHeight: 1.2 }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{days}</div>
      </div>
    </div>);

}

// Tiny abstract food glyph based on name — keeps things minimal + recognisable
function FoodGlyph({ name, color }) {
  const n = name.toLowerCase();
  const props = { stroke: color, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (n.includes('egg')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><ellipse cx="18" cy="20" rx="10" ry="13" {...props} /></svg>);

  if (n.includes('yog') || n.includes('milk')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><rect x="9" y="8" width="18" height="22" rx="2" {...props} /><line x1="9" y1="14" x2="27" y2="14" {...props} /></svg>);

  if (n.includes('spin') || n.includes('lettuce') || n.includes('kale')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><path d="M6 22 Q10 8 18 8 Q26 8 30 22 Q26 28 18 28 Q10 28 6 22Z" {...props} /><line x1="18" y1="8" x2="18" y2="28" {...props} /></svg>);

  if (n.includes('tomato')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="20" r="10" {...props} /><path d="M14 10 Q18 8 22 10" {...props} /></svg>);

  if (n.includes('chick') || n.includes('beef') || n.includes('pork') || n.includes('meat')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><path d="M10 20 Q10 12 18 12 Q26 12 26 20 Q26 26 18 26 Q10 26 10 20Z" {...props} /><circle cx="18" cy="20" r="3" {...props} /></svg>);

  if (n.includes('pasta') || n.includes('rice') || n.includes('bread')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><path d="M8 22 L28 22 L26 12 L10 12 Z" {...props} /></svg>);

  if (n.includes('cheese')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><path d="M6 24 L18 10 L30 24 Z" {...props} /><circle cx="16" cy="20" r="1" {...props} /><circle cx="22" cy="22" r="1" {...props} /></svg>);

  if (n.includes('apple') || n.includes('orang') || n.includes('lemon')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="20" r="9" {...props} /><line x1="18" y1="11" x2="20" y2="8" {...props} /></svg>);

  if (n.includes('carrot')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><path d="M12 12 L24 12 L18 30 Z" {...props} /><line x1="14" y1="9" x2="16" y2="12" {...props} /><line x1="22" y1="9" x2="20" y2="12" {...props} /></svg>);

  if (n.includes('butter')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><rect x="8" y="14" width="20" height="12" rx="1" {...props} /><line x1="8" y1="18" x2="28" y2="18" {...props} /></svg>);

  if (n.includes('onion') || n.includes('garlic')) return (
    <svg width="36" height="36" viewBox="0 0 36 36"><path d="M18 8 Q26 12 24 22 Q22 28 18 28 Q14 28 12 22 Q10 12 18 8Z" {...props} /></svg>);

  // Generic
  return (
    <svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="20" r="10" {...props} /></svg>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Let's fill your fridge
// ─────────────────────────────────────────────────────────────
function FillFridge({ next }) {
  const Choice = ({ recommended, title, sub, icon, onClick }) =>
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '20px 22px',
    background: recommended ? 'var(--primary)' : '#FFFEFB',
    color: recommended ? 'var(--surface)' : 'var(--text)',
    border: `1.5px solid ${recommended ? 'var(--primary)' : 'var(--hairline)'}`,
    borderRadius: 18, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
    position: 'relative'
  }}>
      <div style={{
      width: 46, height: 46, borderRadius: 12,
      background: recommended ? 'rgba(248,244,238,0.15)' : 'var(--primary-50)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          {title}
          {recommended && <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
          background: 'var(--accent)', color: 'var(--text)', padding: '3px 7px', borderRadius: 999
        }}>Recommended</span>}
        </div>
        <div style={{ fontSize: 13, opacity: recommended ? 0.85 : 0.65, marginTop: 4 }}>{sub}</div>
      </div>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M6 4L12 9L6 14" stroke={recommended ? 'var(--surface)' : 'var(--muted)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>;


  return (
    <div className="screen">
      <Pad top={68}>
        <div style={{ marginBottom: 28 }}>
          <h1 className="t-display" style={{ margin: '0 0 12px' }}>
            Let's fill <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>your fridge.</span>
          </h1>
          <p className="t-body muted" style={{ margin: 0 }}>
            Quickest way is a receipt — Chomp reads it and adds everything for you.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
          <Choice
            recommended
            title="Scan a receipt"
            sub="20–30 items in 10 seconds"
            onClick={next}
            icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 3h14v16l-2-2-2 2-2-2-2 2-2-2-2 2-2-2V3z" stroke="#F8F4EE" strokeWidth="1.6" strokeLinejoin="round" />
                <line x1="7" y1="8" x2="15" y2="8" stroke="#F8F4EE" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="7" y1="12" x2="13" y2="12" stroke="#F8F4EE" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            } />
          
          <Choice
            title="Scan a barcode"
            sub="One item at a time. Free, unlimited."
            onClick={next}
            icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <line x1="4" y1="5" x2="4" y2="17" stroke="#1B4332" strokeWidth="1.6" />
                <line x1="7" y1="5" x2="7" y2="17" stroke="#1B4332" strokeWidth="2.6" />
                <line x1="10" y1="5" x2="10" y2="17" stroke="#1B4332" strokeWidth="1.6" />
                <line x1="13" y1="5" x2="13" y2="17" stroke="#1B4332" strokeWidth="2.6" />
                <line x1="16" y1="5" x2="16" y2="17" stroke="#1B4332" strokeWidth="1.6" />
                <line x1="18" y1="5" x2="18" y2="17" stroke="#1B4332" strokeWidth="1.6" />
              </svg>
            } />
          
          <Choice
            title="Add manually"
            sub="Search and tap. Free, unlimited."
            onClick={next}
            icon={
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="10" cy="10" r="6" stroke="#1B4332" strokeWidth="1.6" />
                <path d="M14.5 14.5L18 18" stroke="#1B4332" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            } />
          
        </div>

        <p className="t-small muted" style={{ textAlign: 'center', marginTop: 12 }}>
          Tap a card above, or hit Continue to use a receipt now.
        </p>
      </Pad>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Camera scan (with coach marks)
// ─────────────────────────────────────────────────────────────
function CameraScan({ next }) {
  return (
    <div className="screen" style={{ background: '#1C1C1A' }}>
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 56, left: 0, right: 0,
          padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 5
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 999, background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)'
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M11 3L3 11M3 3l8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          </div>
          <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, letterSpacing: '-0.005em' }}>Scan receipt</div>
          <div style={{
            padding: '7px 12px', borderRadius: 999, background: 'rgba(212,168,67,0.18)',
            color: 'var(--accent)', fontWeight: 700, fontSize: 12
          }}>3 credits</div>
        </div>

        {/* Viewfinder area: dim background, "receipt" outlined */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{
            width: 220, height: 320, background: '#F8F4EE',
            borderRadius: 6, position: 'relative',
            boxShadow: '0 0 0 9999px rgba(28,28,26,0.55)'
          }}>
            {/* Receipt content */}
            <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>WHOLESOME GROCER</div>
              <div style={{ fontSize: 9, color: '#6B7A6D' }}>28 May 2026 · 18:42</div>
              <div style={{ height: 1, background: '#1C1C1A', opacity: 0.2, margin: '8px 0' }} />
              {['Free range eggs', 'Greek yogurt 500g', 'Baby spinach', 'Cherry tomatoes', 'Sourdough loaf', 'Chicken breast', 'Cheddar 200g', 'Onions x3', 'Garlic bulb', 'Olive oil 500ml'].map((it, i) =>
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
                  <span>{it}</span><span>£{(2 + Math.random() * 5).toFixed(2)}</span>
                </div>
              )}
              <div style={{ height: 1, background: '#1C1C1A', opacity: 0.2, margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700 }}>
                <span>TOTAL</span><span>£42.18</span>
              </div>
            </div>

            {/* Corner brackets */}
            <CornerBrackets />
            {/* Coach mark callouts */}
            <div style={{
              position: 'absolute', left: -190, top: 90, width: 170,
              background: 'var(--accent)', color: 'var(--text)',
              padding: '10px 14px', borderRadius: 12, fontSize: 12, fontWeight: 600,
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
            }}>
              Line up the receipt
              <div style={{
                position: 'absolute', right: -6, top: 14, width: 12, height: 12,
                background: 'var(--accent)', transform: 'rotate(45deg)'
              }} />
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div style={{ padding: '20px 24px 40px', position: 'relative', zIndex: 5 }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', fontSize: 13, margin: '0 0 16px', maxWidth: 280, marginInline: 'auto' }}>
            Hold steady. We'll auto-capture when it's clear.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="6" width="14" height="10" rx="1" stroke="#fff" strokeWidth="1.6" /><circle cx="10" cy="11" r="3" stroke="#fff" strokeWidth="1.6" /></svg>
            </div>
            <button onClick={next} style={{
              width: 78, height: 78, borderRadius: 999, background: '#fff',
              border: '4px solid rgba(255,255,255,0.4)',
              boxShadow: '0 0 0 4px transparent',
              cursor: 'pointer'
            }} />
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 4l-3 3 3 3M14 16l3-3-3-3M3 7h14M3 13h14" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>);

}

function CornerBrackets() {
  const c = 'var(--accent)';
  const sw = 3;
  const l = 22;
  const Style = (pos) => ({ position: 'absolute', ...pos });
  return (
    <>
      <div style={{ ...Style({ top: -8, left: -8, width: l, height: sw, background: c }) }} />
      <div style={{ ...Style({ top: -8, left: -8, width: sw, height: l, background: c }) }} />
      <div style={{ ...Style({ top: -8, right: -8, width: l, height: sw, background: c }) }} />
      <div style={{ ...Style({ top: -8, right: -8, width: sw, height: l, background: c }) }} />
      <div style={{ ...Style({ bottom: -8, left: -8, width: l, height: sw, background: c }) }} />
      <div style={{ ...Style({ bottom: -8, left: -8, width: sw, height: l, background: c }) }} />
      <div style={{ ...Style({ bottom: -8, right: -8, width: l, height: sw, background: c }) }} />
      <div style={{ ...Style({ bottom: -8, right: -8, width: sw, height: l, background: c }) }} />
    </>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Processing
// ─────────────────────────────────────────────────────────────
function Processing({ next }) {
  return (
    <div className="screen">
      <Pad top={120}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
          <ProcessingPulse />
          <div style={{ textAlign: 'center', maxWidth: 280 }}>
            <h1 className="t-h1" style={{ margin: '0 0 12px' }}>Reading your receipt…</h1>
            <p className="t-body muted" style={{ margin: 0 }}>
              Sorting items by category and shelf life. You can close the app — we'll ping you when it's done.
            </p>
          </div>
          <div style={{ width: '100%', maxWidth: 280 }}>
            {[
            { label: 'Recognising items', done: true },
            { label: 'Matching to your fridge', done: true },
            { label: 'Estimating shelf life', done: false, active: true }].
            map((s, i) =>
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
                <StatusDot done={s.done} active={s.active} />
                <span className="t-small" style={{ color: s.done || s.active ? 'var(--text)' : 'var(--muted)', fontWeight: s.active ? 700 : 500 }}>
                  {s.label}
                </span>
              </div>
            )}
          </div>
        </div>
        <button className="btn-ghost" onClick={next}>Continue in background</button>
      </Pad>
    </div>);

}

function StatusDot({ done, active }) {
  if (done) return (
    <div style={{ width: 20, height: 20, borderRadius: 999, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 6L4.5 8.5L9 3" stroke="#F8F4EE" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>);

  if (active) return (
    <div style={{ width: 20, height: 20, borderRadius: 999, border: '2px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />);

  return <div style={{ width: 20, height: 20, borderRadius: 999, border: '2px solid var(--hairline-strong)' }} />;
}

function ProcessingPulse() {
  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <style>{`@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 0.5 } 50% { transform: scale(1.15); opacity: 0.25 } } @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }`}</style>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--accent-soft)',
        animation: 'pulse 1.8s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute', inset: 22, borderRadius: 999, background: 'var(--accent)',
        animation: 'pulse 1.8s ease-in-out infinite 0.4s'
      }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <svg width="50" height="50" viewBox="0 0 50 50" fill="none">
          <path d="M14 8h22v34l-3.5-3-3.5 3-3.5-3-3.5 3-3.5-3-3.5 3-3.5-3-3-2.5z" stroke="#1B4332" strokeWidth="2" strokeLinejoin="round" fill="#F8F4EE" />
          <line x1="18" y1="16" x2="32" y2="16" stroke="#1B4332" strokeWidth="2" strokeLinecap="round" />
          <line x1="18" y1="22" x2="28" y2="22" stroke="#1B4332" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Celebration
// ─────────────────────────────────────────────────────────────
function Celebrate({ next, nav }) {
  return (
    <div className="screen" style={{ background: 'var(--primary)', color: 'var(--surface)' }}>
      <Pad top={72}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
          <CelebrateGraphic />
          <div style={{ textAlign: 'center' }}>
            <div className="t-micro" style={{ color: 'var(--accent)', marginBottom: 14 }}>Your fridge is alive</div>
            <h1 className="t-display" style={{ margin: '0 0 16px', color: 'var(--surface)' }}>
              <span style={{ color: 'var(--accent)' }}>23</span> items added.
            </h1>
            <p className="t-body" style={{ margin: 0, opacity: 0.8, maxWidth: 300 }}>
              We sorted them into shelves and ranked them by what to eat first.
            </p>
          </div>

          {/* Needs-a-check banner */}
          <button onClick={next} style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
            background: 'rgba(248,244,238,0.12)', border: '1px solid rgba(248,244,238,0.22)',
            borderRadius: 16, padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--surface)'
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: 'var(--accent)', color: 'var(--text)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 19, flexShrink: 0
            }}>!</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>3 items need a quick check</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>We couldn't read these clearly.</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 18 18"><path d="M6 4l6 5-6 5" stroke="var(--surface)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-primary" onClick={next} style={{ background: 'var(--accent)', color: 'var(--text)' }}>
            Review 3 items
          </button>
          <button onClick={() => nav && nav('home')} style={{
            background: 'none', border: 'none', color: 'var(--surface)', opacity: 0.8,
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer', padding: 4
          }}>
            Skip — see my fridge
          </button>
        </div>
      </Pad>
    </div>);

}

function CelebrateGraphic() {
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="80" fill="#D4A843" opacity="0.15" />
      <circle cx="100" cy="100" r="56" fill="#D4A843" opacity="0.25" />
      <g transform="translate(60,40)">
        <rect x="0" y="0" width="80" height="120" rx="10" fill="#F8F4EE" stroke="#D4A843" strokeOpacity="0.6" />
        <line x1="0" y1="42" x2="80" y2="42" stroke="#D4A843" strokeOpacity="0.4" />
        <rect x="6" y="8" width="14" height="28" rx="2" fill="#4F8A5B" />
        <rect x="24" y="8" width="14" height="28" rx="2" fill="#D4A843" />
        <rect x="42" y="8" width="14" height="28" rx="2" fill="#C76845" />
        <rect x="60" y="8" width="14" height="28" rx="2" fill="#1B4332" />
        <rect x="6" y="48" width="20" height="26" rx="2" fill="#4F8A5B" opacity="0.7" />
        <rect x="30" y="48" width="20" height="26" rx="2" fill="#D4A843" opacity="0.7" />
        <rect x="54" y="48" width="20" height="26" rx="2" fill="#1B4332" opacity="0.7" />
        <rect x="6" y="80" width="32" height="32" rx="2" fill="#6B7A6D" opacity="0.4" />
        <rect x="42" y="80" width="32" height="32" rx="2" fill="#4F8A5B" opacity="0.5" />
      </g>
      {/* sparkles */}
      <g stroke="#D4A843" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M30 60 L30 70 M25 65 L35 65" />
        <path d="M170 50 L170 56 M167 53 L173 53" />
        <path d="M165 150 L165 158 M161 154 L169 154" />
        <path d="M40 160 L40 168 M36 164 L44 164" />
      </g>
    </svg>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Quick check — confirm items the scan couldn't read cleanly
// ─────────────────────────────────────────────────────────────
function QuickCheck({ next }) {
  const [phase, setPhase] = React.useState('review');
  const [items, setItems] = React.useState([
  { raw: 'GRN BNS 400G', name: 'Green beans', cat: 'veg', qty: '400 g', ok: false },
  { raw: 'ORG WHL MLK 2L', name: 'Whole milk', cat: 'dairy', qty: '2 L', ok: false },
  { raw: 'CHKN THGH ~0.6KG', name: 'Chicken thighs', cat: 'meat', qty: '~600 g', ok: false }]
  );

  const catBg = { veg: '#C8D5C2', dairy: '#F0DDA8', meat: '#E8C3B0', fruit: '#E8B59E', pantry: '#E5D9C4' };
  const catLabel = { veg: 'Vegetables', dairy: 'Dairy', meat: 'Meat', fruit: 'Fruit', pantry: 'Pantry' };

  const setName = (i, v) => setItems((s) => s.map((it, idx) => idx === i ? { ...it, name: v } : it));
  const confirm = (i) => setItems((s) => s.map((it, idx) => idx === i ? { ...it, ok: true } : it));
  const okCount = items.filter((i) => i.ok).length;
  const remaining = items.length - okCount;
  const allOk = remaining === 0;

  if (phase === 'done') {
    return (
      <div className="screen">
        <Pad top={88}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 28 }}>
            <div style={{
              width: 96, height: 96, borderRadius: 999, background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="44" height="44" viewBox="0 0 44 44"><path d="M12 23l7 7 14-16" stroke="var(--accent)" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <div className="t-micro" style={{ color: 'var(--accent)', marginBottom: 12 }}>All checked</div>
              <h1 className="t-display" style={{ margin: '0 0 14px' }}>
                You're <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>all set.</span>
              </h1>
              <p className="t-body muted" style={{ margin: 0, maxWidth: 300 }}>
                3 items confirmed and added. Your fridge now holds all 23.
              </p>
            </div>
          </div>
          <button className="btn-primary" onClick={next}>See my fridge</button>
        </Pad>
      </div>);

  }

  return (
    <div className="screen">
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 118 }}>
        <Pad top={68} bottom={8}>
          <div style={{ marginBottom: 18 }}>
            <div className="t-micro" style={{ color: 'var(--accent)', marginBottom: 10 }}>Quick check · 3 items</div>
            <h1 className="t-h1" style={{ margin: '0 0 8px' }}>A few items need a look</h1>
            <p className="t-body muted" style={{ margin: 0 }}>
              We couldn't read these clearly on your receipt. Confirm or fix them — the other 20 are already in.
            </p>
          </div>

          {/* progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'var(--hairline)' }}>
              <div style={{ width: `${okCount / items.length * 100}%`, height: '100%', borderRadius: 4, background: 'var(--primary)', transition: 'width 0.25s' }} />
            </div>
            <span className="t-small muted">{okCount}/{items.length} confirmed</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map((it, i) =>
            <div key={i} style={{
              background: '#FFFEFB', border: `1.5px solid ${it.ok ? 'var(--green)' : 'var(--hairline)'}`,
              borderRadius: 16, padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
              transition: 'border 0.2s'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: catBg[it.cat] || '#E8E1D3',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <FoodGlyph name={it.name} color="#1B4332" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 3 }}>Scanned as</div>
                    <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, color: 'var(--muted)' }}>"{it.raw}"</div>
                  </div>
                  {it.ok &&
                  <div style={{ width: 26, height: 26, borderRadius: 999, background: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7.5L6 10.5L11 4" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  }
                </div>

                <div>
                  <label className="t-micro" style={{ color: 'var(--muted)', display: 'block', marginBottom: 6 }}>Item name</label>
                  <input
                  value={it.name}
                  onChange={(e) => setName(i, e.target.value)}
                  style={{
                    width: '100%', height: 46, padding: '0 14px',
                    background: it.ok ? 'var(--surface-2)' : '#fff', color: 'var(--text)',
                    border: '1.5px solid var(--hairline-strong)', borderRadius: 12, outline: 'none',
                    fontFamily: 'inherit', fontWeight: 600, fontSize: 15
                  }} />

                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="chip">{catLabel[it.cat]}</span>
                    <span className="chip" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{it.qty}</span>
                  </div>
                  {it.ok ?
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>Confirmed</span> :

                  <button onClick={() => confirm(i)} style={{
                    padding: '9px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    background: 'var(--primary)', color: 'var(--surface)',
                    fontFamily: 'inherit', fontWeight: 700, fontSize: 13
                  }}>Looks right</button>
                  }
                </div>
              </div>
            )}
          </div>
        </Pad>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 20px 28px',
        background: 'linear-gradient(to top, var(--surface) 60%, rgba(248,244,238,0))'
      }}>
        <button className="btn-primary" onClick={() => allOk && setPhase('done')} disabled={!allOk} style={{
          opacity: allOk ? 1 : 0.4, cursor: allOk ? 'pointer' : 'not-allowed'
        }}>
          {allOk ? 'Add 3 items to fridge' : `Confirm ${remaining} more to continue`}
        </button>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Notification permission
// ─────────────────────────────────────────────────────────────
function Notif({ next }) {
  return (
    <div className="screen">
      <Pad top={68}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 32 }}>
          {/* Mini phone preview of notification */}
          <div style={{
            background: 'rgba(248,244,238,0.6)',
            borderRadius: 20,
            padding: 18,
            border: '1px solid var(--hairline)'
          }}>
            <div style={{
              background: '#FFFEFB', borderRadius: 14, padding: '14px 16px',
              border: '1px solid var(--hairline)',
              boxShadow: '0 4px 12px rgba(27,67,50,0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, background: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent)', fontFamily: 'Fraunces, serif', fontWeight: 600, fontSize: 16, fontStyle: 'italic'
                }}>c</div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>CHOMP</span>
                <span style={{ fontSize: 11, color: 'var(--muted-2)', marginLeft: 'auto' }}>1:42pm</span>
              </div>
              <div className="t-label" style={{ marginBottom: 2 }}>Tonight: 20-min pasta</div>
              <div className="t-small" style={{ color: 'var(--muted)' }}>
                Uses your spinach and eggs before they turn.
              </div>
            </div>
          </div>

          <div>
            <h1 className="t-display" style={{ margin: '0 0 12px' }}>
              One smart suggestion <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>a day.</span>
            </h1>
            <p className="t-body muted" style={{ margin: 0 }}>
              We'll only ping you when there's something genuinely good in your fridge tonight. Never generic.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn-primary" onClick={next}>Enable notifications</button>
          <button className="btn-text" onClick={next}>Maybe later</button>
        </div>
      </Pad>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Home (Virtual Fridge)
// ─────────────────────────────────────────────────────────────
function Home({ next, tier, nav, onScan }) {
  const isPremium = tier === 'premium';

  return (
    <div className="screen">
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 196 }}>
        {/* Header */}
        <div style={{ padding: '64px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="t-micro" style={{ color: 'var(--muted)' }}>Good evening</div>
            <h1 className="t-h1" style={{ margin: '4px 0 0' }}>Your fridge</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <IconBtn icon={<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M13 13l3 3" stroke="#1B4332" strokeWidth="1.6" strokeLinecap="round" /></svg>} />
            <IconBtn icon={<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="3" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M9 1v3M9 14v3M1 9h3M14 9h3M3.5 3.5l2 2M12.5 12.5l2 2M3.5 14.5l2-2M12.5 5.5l2-2" stroke="#1B4332" strokeWidth="1.6" strokeLinecap="round" /></svg>} />
          </div>
        </div>

        {/* Eat First shelf — what to use today */}
        <EatFirstShelf isPremium={isPremium} nav={nav} />

        {/* Stats strip — week summary (free at day 7) */}
        <div style={{ margin: '8px 24px 20px', padding: '14px 16px', background: 'var(--primary-50)', borderRadius: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 12 L6 7 L10 9 L14 3" stroke="#F8F4EE" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div className="t-label" style={{ color: 'var(--primary)' }}>Avoided wasting ~6 items this week</div>
            {isPremium && <div className="t-small muted" style={{ marginTop: 2 }}>About £9 saved · Tap for insights</div>}
          </div>
        </div>

        {/* Category sections */}
        <CategorySection
          name="Dairy"
          count={4}
          items={[
          { name: 'Greek yogurt', category: 'dairy', days: '2 days old', urgency: 'yellow' },
          { name: 'Cheddar 200g', category: 'dairy', days: '5 days old', urgency: 'green' },
          { name: 'Butter', category: 'dairy', days: '8 days old', urgency: 'green' },
          { name: 'Milk', category: 'dairy', days: '3 days old', urgency: 'yellow' }]
          } />
        
        <CategorySection
          name="Vegetables"
          count={5}
          items={[
          { name: 'Baby spinach', category: 'veg', days: 'Best today', urgency: 'red' },
          { name: 'Cherry tomatoes', category: 'veg', days: '2 days', urgency: 'yellow' },
          { name: 'Carrots', category: 'veg', days: '~7 days', urgency: 'green' },
          { name: 'Onions x3', category: 'veg', days: '~14 days', urgency: 'green' }]
          } />
        
        <CategorySection
          name="Meat"
          count={2}
          items={[
          { name: 'Chicken breast', category: 'meat', days: 'Best today', urgency: 'red' },
          { name: 'Bacon', category: 'meat', days: '3 days', urgency: 'yellow' }]
          } />
        
        <CategorySection
          name="Pantry"
          count={6}
          items={[
          { name: 'Sourdough', category: 'grain', days: '2 days old', urgency: 'yellow' },
          { name: 'Pasta', category: 'grain', days: '~weeks', urgency: 'green' },
          { name: 'Olive oil', category: 'pantry', days: '~weeks', urgency: 'green' },
          { name: 'Garlic', category: 'pantry', days: '~10 days', urgency: 'green' }]
          } />
        
      </div>

      {/* Floating CTA + bottom tabs */}
      <BottomDock active="fridge" nav={nav} onScan={onScan}>
        <button className="btn-primary" onClick={next}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: 8 }}>
            <path d="M3 9 L7 13 L15 4" stroke="#F8F4EE" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          What should I cook?
        </button>
      </BottomDock>
    </div>);

}

function IconBtn({ icon }) {
  return (
    <div style={{
      width: 38, height: 38, borderRadius: 999, background: '#FFFEFB',
      border: '1px solid var(--hairline)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>{icon}</div>);

}

function EatFirstShelf({ isPremium, nav }) {
  const items = [
  { name: 'Baby spinach', category: 'veg', days: 'Best today', urgency: 'red' },
  { name: 'Free range eggs', category: 'dairy', days: 'Best today', urgency: 'red' },
  { name: 'Greek yogurt', category: 'dairy', days: 'In 2 days', urgency: 'yellow' }];

  return (
    <div style={{ margin: '8px 24px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div className="t-micro" style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="dot dot-red" style={{ width: 7, height: 7 }} />
            Use today
          </div>
          <h2 className="t-h2" style={{ margin: '4px 0 0' }}>Eat first</h2>
        </div>
        <span className="t-small muted">{items.length} items</span>
      </div>
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #1F4E39 100%)',
        borderRadius: 18, padding: 14
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {items.map((it) =>
          <EatFirstCard key={it.name} {...it} />
          )}
        </div>
        <button onClick={() => nav && nav('recipes')} style={{
          width: '100%', marginTop: 12, padding: '12px 14px', borderRadius: 12,
          background: 'rgba(248,244,238,0.14)', border: '1px solid rgba(248,244,238,0.22)',
          color: 'var(--surface)', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          Cook with these first
          <svg width="15" height="15" viewBox="0 0 15 15"><path d="M5 3l5 4.5-5 4.5" stroke="var(--surface)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>);

}

function EatFirstCard({ name, category, days, urgency }) {
  const palette = {
    dairy: '#F0DDA8', veg: '#C8D5C2', meat: '#E8C3B0'
  }[category] || '#E8E1D3';
  return (
    <div style={{
      background: 'rgba(248,244,238,0.95)', borderRadius: 12, padding: 8,
      display: 'flex', flexDirection: 'column', gap: 6
    }}>
      <div style={{
        aspectRatio: '1 / 1', borderRadius: 8, background: palette,
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'
      }}>
        <FoodGlyph name={name} color="#1B4332" />
        <div style={{ position: 'absolute', top: 4, right: 4 }}>
          <span className={`dot dot-${urgency}`} />
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 11, lineHeight: 1.15 }}>{name}</div>
        <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 600, marginTop: 1 }}>{days}</div>
      </div>
    </div>);

}

function CategorySection({ name, count, items }) {
  return (
    <div style={{ marginBottom: 24, padding: '0 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="t-h3">{name} <span style={{ color: 'var(--muted-2)', fontWeight: 500 }}>· {count}</span></h2>
        <span className="t-small muted">See all</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {items.map((it) => <FoodCard key={it.name} {...it} />)}
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Recipe suggestions
// ─────────────────────────────────────────────────────────────
function Recipes({ next, tier, nav, onScan }) {
  const isPremium = tier === 'premium';

  return (
    <div className="screen">
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 196 }}>
        <div style={{ padding: '64px 24px 16px' }}>
          <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 6 }}>3 ideas from your fridge</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Tonight's options</h1>
        </div>

        {/* Filters — premium only */}
        {isPremium &&
        <div style={{ padding: '0 24px 16px', display: 'flex', gap: 8, overflowX: 'auto' }}>
            <Filter label="All" active />
            <Filter label="≤ 20 min" />
            <Filter label="Simple" />
            <Filter label="Uses most" />
          </div>
        }

        {/* Free credits banner */}
        {!isPremium &&
        <div style={{ margin: '0 24px 16px', padding: '12px 14px', background: 'var(--primary-50)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="t-small" style={{ fontWeight: 700, color: 'var(--primary)' }}>2 of 3 weekly recipes left</div>
              <div className="t-small muted" style={{ marginTop: 2 }}>Free plan</div>
            </div>
            <div className="chip" style={{ background: 'var(--accent)', color: 'var(--text)' }}>Upgrade</div>
          </div>
        }

        {/* Recipe cards */}
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <RecipeCard
            featured
            title="Spinach & feta pasta"
            time="20 min"
            uses={['Spinach', 'Pasta', 'Garlic', 'Olive oil', '+2']}
            saves="Saves spinach (best today)"
            color="#C8D5C2"
            onClick={next} />
          
          <RecipeCard
            title="Mediterranean chicken bowl"
            time="30 min"
            uses={['Chicken', 'Tomatoes', 'Onion', 'Yogurt']}
            saves="Uses chicken + yogurt"
            color="#E8C3B0" />
          
          <RecipeCard
            title="Cheesy egg toast"
            time="10 min"
            uses={['Eggs', 'Sourdough', 'Cheddar']}
            saves="Uses 3 items at risk"
            color="#F0DDA8" />
          
        </div>
      </div>

      <BottomDock active="recipes" nav={nav} onScan={onScan}>
        <button className="btn-primary" onClick={next}>Open Spinach & feta pasta</button>
      </BottomDock>
    </div>);

}

function Filter({ label, active }) {
  return (
    <div style={{
      padding: '8px 14px', borderRadius: 999, whiteSpace: 'nowrap',
      background: active ? 'var(--primary)' : '#FFFEFB',
      color: active ? 'var(--surface)' : 'var(--text)',
      border: `1px solid ${active ? 'var(--primary)' : 'var(--hairline)'}`,
      fontSize: 13, fontWeight: 600
    }}>{label}</div>);

}

function RecipeCard({ featured, title, time, uses, saves, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: '#FFFEFB', border: '1px solid var(--hairline)', borderRadius: 18,
      padding: 12, display: 'flex', gap: 12, textAlign: 'left',
      fontFamily: 'inherit', cursor: 'pointer', alignItems: 'stretch'
    }}>
      <div style={{
        width: 96, height: 96, borderRadius: 12, flexShrink: 0,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <RecipeGlyph color="#1B4332" />
        {featured &&
        <div style={{
          position: 'absolute', top: 6, left: 6,
          padding: '3px 7px', borderRadius: 999, background: 'var(--accent)',
          fontSize: 9, fontWeight: 700, color: 'var(--text)',
          letterSpacing: '0.05em', textTransform: 'uppercase'
        }}>Top pick</div>
        }
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div className="t-h3" style={{ marginBottom: 4 }}>{title}</div>
          <div className="t-small muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>⏱ {time}</span><span>·</span><span>{uses.length} ingredients</span>
          </div>
        </div>
        <div className="t-small" style={{ color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="dot dot-yellow" />{saves}
        </div>
      </div>
    </button>);

}

function RecipeGlyph({ color }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="24" cy="32" rx="18" ry="4" stroke={color} strokeOpacity="0.3" strokeWidth="1.5" />
      <ellipse cx="24" cy="28" rx="16" ry="8" stroke={color} strokeWidth="1.8" fill="none" />
      <path d="M12 28 Q16 22 24 22 Q32 22 36 28" stroke={color} strokeWidth="1.5" fill="none" />
      <circle cx="20" cy="26" r="1.5" fill={color} />
      <circle cx="28" cy="25" r="1.5" fill={color} />
    </svg>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Recipe detail
// ─────────────────────────────────────────────────────────────
function RecipeDetail({ next }) {
  return (
    <div className="screen">
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 100 }}>
        {/* Hero */}
        <div style={{
          height: 280,
          background: 'linear-gradient(135deg, #C8D5C2 0%, #A8BDA0 100%)',
          position: 'relative',
          display: 'flex', alignItems: 'flex-end', padding: '0 24px 20px'
        }}>
          <div style={{
            position: 'absolute', top: 60, left: 20,
            width: 38, height: 38, borderRadius: 999,
            background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M9 2L3 7L9 12" stroke="#1B4332" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85 }}>
            <RecipeGlyph color="#1B4332" />
          </div>
          <div style={{ color: 'var(--text)', position: 'relative', zIndex: 2 }}>
            <div className="chip" style={{ background: 'rgba(248,244,238,0.85)', color: 'var(--primary)', marginBottom: 8 }}>Saves spinach</div>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <h1 className="t-h1" style={{ margin: '0 0 8px' }}>Spinach & feta pasta</h1>
          <div className="t-small muted" style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <span>⏱ 20 minutes</span><span>·</span><span>2 servings</span><span>·</span><span>Simple</span>
          </div>

          <h3 className="t-micro" style={{ color: 'var(--muted)', marginBottom: 10 }}>From your fridge · 5 items</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
            {[
            { n: 'Baby spinach', u: 'best today', red: true },
            { n: 'Pasta', u: '200g' },
            { n: 'Garlic', u: '3 cloves' },
            { n: 'Olive oil', u: '2 tbsp' },
            { n: 'Cheddar', u: '50g' }].
            map((i) =>
            <div key={i.n} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 999,
              background: '#FFFEFB', border: '1px solid var(--hairline)'
            }}>
                <span className={`dot dot-${i.red ? 'red' : 'green'}`} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{i.n}</span>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>· {i.u}</span>
              </div>
            )}
          </div>

          <h3 className="t-micro" style={{ color: 'var(--muted)', marginBottom: 12 }}>How to cook</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
            'Boil pasta until al dente. Save a mug of pasta water.',
            'Heat olive oil. Sauté garlic until just golden.',
            'Toss in spinach until it wilts, about 2 minutes.',
            'Add pasta, splash of water, crumbled cheddar. Salt to taste.'].
            map((step, i) =>
            <div key={i} style={{ display: 'flex', gap: 12 }}>
                <div style={{
                width: 26, height: 26, borderRadius: 999, background: 'var(--primary)',
                color: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 13, flexShrink: 0, marginTop: 2
              }}>{i + 1}</div>
                <p className="t-body" style={{ margin: 0 }}>{step}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 20px 28px',
        background: 'linear-gradient(to top, var(--surface) 60%, rgba(248,244,238,0))'
      }}>
        <button className="btn-primary" onClick={next} style={{ background: 'var(--accent)', color: 'var(--text)' }}>
          I cooked this
        </button>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Cooked This confirmation
// ─────────────────────────────────────────────────────────────
function CookedThis({ next }) {
  const [items, setItems] = React.useState([
  { n: 'Baby spinach', u: '100g', used: true },
  { n: 'Pasta', u: '200g', used: true },
  { n: 'Garlic', u: '3 cloves', used: true },
  { n: 'Olive oil', u: '2 tbsp', used: true },
  { n: 'Cheddar', u: '50g', used: false }]
  );
  const toggle = (i) => setItems((s) => s.map((it, idx) => idx === i ? { ...it, used: !it.used } : it));
  const removed = items.filter((i) => i.used).length;

  return (
    <div className="screen">
      <Pad top={68}>
        <div style={{ marginBottom: 24 }}>
          <div className="t-micro" style={{ color: 'var(--accent)', marginBottom: 8 }}>Nice cooking</div>
          <h1 className="t-h1" style={{ margin: '0 0 8px' }}>What did you actually use?</h1>
          <p className="t-body muted" style={{ margin: 0 }}>
            We'll remove these from your fridge. Untick anything you didn't use.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          {items.map((it, i) =>
          <div key={i} onClick={() => toggle(i)} style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 16px',
            background: it.used ? 'var(--primary-50)' : '#FFFEFB',
            border: `1.5px solid ${it.used ? 'transparent' : 'var(--hairline)'}`,
            borderRadius: 14, cursor: 'pointer',
            opacity: it.used ? 1 : 0.6
          }}>
              <div style={{
              width: 24, height: 24, borderRadius: 7,
              background: it.used ? 'var(--primary)' : 'transparent',
              border: it.used ? 'none' : '1.5px solid var(--hairline-strong)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                {it.used && <svg width="13" height="13" viewBox="0 0 13 13"><path d="M3 7L5.5 9.5L10 4" stroke="#F8F4EE" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, textDecoration: it.used ? 'none' : 'line-through' }}>{it.n}</div>
                <div className="t-small muted">{it.u}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn-primary" onClick={next}>Remove {removed} items from fridge</button>
        </div>
      </Pad>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Insights (premium)
// ─────────────────────────────────────────────────────────────
function Insights({ next, nav, onScan }) {
  return (
    <div className="screen">
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 196 }}>
        <div style={{ padding: '64px 24px 8px' }}>
          <div className="t-micro" style={{ color: 'var(--accent)', marginBottom: 6 }}>★ Premium · Week of 24 May</div>
          <h1 className="t-h1" style={{ margin: 0 }}>Your week, well fed.</h1>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Big hero stat */}
          <div style={{
            background: 'var(--primary)', color: 'var(--surface)',
            borderRadius: 20, padding: 22
          }}>
            <div className="t-micro" style={{ color: 'var(--accent)', marginBottom: 10 }}>Items saved this week</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.04em' }}>8</div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>items · about £12</div>
            </div>
            <div style={{ height: 1, background: 'rgba(248,244,238,0.15)', margin: '18px 0' }} />
            <div className="t-small" style={{ opacity: 0.85 }}>
              That's 2 more than last week. You're getting the hang of this.
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Stat label="Recipes cooked" value="5" sub="+1 vs last wk" />
            <Stat label="Eat-first hits" value="92%" sub="of suggestions used" />
          </div>

          {/* Pattern note */}
          <div className="card" style={{ padding: 18 }}>
            <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 8 }}>Pattern noticed</div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 15, lineHeight: 1.4 }}>
              Slightly more sweets and pastries than usual this week. No judgement — just so you know.
            </p>
          </div>

          {/* Most cooked */}
          <div className="card" style={{ padding: 18 }}>
            <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 10 }}>Most cooked</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
              { n: 'Spinach & feta pasta', c: 2 },
              { n: 'Cheesy egg toast', c: 2 },
              { n: 'Mediterranean bowl', c: 1 }].
              map((r) =>
              <div key={r.n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: '#C8D5C2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <RecipeGlyph color="#1B4332" />
                    </div>
                    <span className="t-label">{r.n}</span>
                  </div>
                  <span className="t-small muted">{r.c}×</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <BottomDock active="insights" nav={nav} onScan={onScan}>
        <button className="btn-primary" onClick={next}>See premium</button>
      </BottomDock>
    </div>);

}

function Stat({ label, value, sub }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</div>
      <div className="t-small muted" style={{ marginTop: 2 }}>{sub}</div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SCREEN: Premium paywall sheet
// ─────────────────────────────────────────────────────────────
function Paywall({ next }) {
  return (
    <div className="screen" style={{ background: 'rgba(28,28,26,0.5)', justifyContent: 'flex-end' }}>
      {/* Backdrop preview of fridge — subtle */}
      <div style={{ flex: 1 }} />

      {/* Bottom sheet */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: '28px 28px 0 0',
        padding: '12px 24px 36px',
        boxShadow: '0 -20px 40px rgba(0,0,0,0.15)'
      }}>
        <div style={{ width: 40, height: 5, borderRadius: 999, background: 'var(--hairline-strong)', margin: '0 auto 24px' }} />

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 999,
            background: 'var(--accent-soft)', color: 'var(--primary)',
            fontWeight: 700, fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase',
            marginBottom: 14
          }}>★ Chomp Premium</div>
          <h1 className="t-display" style={{ margin: '0 0 10px', fontSize: 34 }}>
            Unlock the <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>good stuff.</span>
          </h1>
          <p className="t-body muted" style={{ margin: 0 }}>
            Unlimited scans, smarter recipes, daily suggestions.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {[
          'Eat-first shelf — know what to use today',
          'Unlimited recipe ideas, expiry-prioritised',
          'Daily "what to cook tonight" notification',
          'Weekly insights and household sharing'].
          map((t) =>
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
              width: 22, height: 22, borderRadius: 999, background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
                <svg width="11" height="11" viewBox="0 0 11 11"><path d="M2 6L4.5 8.5L9 3" stroke="#F8F4EE" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <span className="t-label">{t}</span>
            </div>
          )}
        </div>

        {/* Plans */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          <PlanCard period="Monthly" price="$4.99" sub="/month" />
          <PlanCard period="Yearly" price="$29.99" sub="/year" selected badge="Save 50%" />
        </div>

        <button className="btn-primary" onClick={next}>Start 7-day free trial</button>
        <button className="btn-text" onClick={next} style={{ width: '100%', marginTop: 8 }}>Not now</button>
      </div>
    </div>);

}

function PlanCard({ period, price, sub, selected, badge }) {
  return (
    <div style={{
      flex: 1, padding: '16px 14px',
      background: selected ? 'var(--primary)' : '#FFFEFB',
      color: selected ? 'var(--surface)' : 'var(--text)',
      border: `1.5px solid ${selected ? 'var(--primary)' : 'var(--hairline)'}`,
      borderRadius: 14, position: 'relative'
    }}>
      {badge &&
      <div style={{
        position: 'absolute', top: -8, right: 10,
        padding: '3px 8px', borderRadius: 999,
        background: 'var(--accent)', color: 'var(--text)',
        fontSize: 10, fontWeight: 700
      }}>{badge}</div>
      }
      <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>{period}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{price}</span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>{sub}</span>
      </div>
    </div>);

}

window.AppScreens = { FillFridge, CameraScan, Processing, Celebrate, QuickCheck, Notif, Home, Recipes, RecipeDetail, CookedThis, Insights, Paywall, ScanChoice };
window.ChompNav = { TabBar, BottomDock };