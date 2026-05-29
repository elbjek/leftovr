// Chomp — Account screens: Profile, Settings, Household, Invite

const { BottomDock: AcctDock } = window.ChompNav;

const AcctPad = ({ children, top = 24, bottom = 32, style = {} }) =>
<div style={{
  flex: 1, display: 'flex', flexDirection: 'column',
  padding: `${top}px 24px ${bottom}px`, minHeight: 0, ...style
}}>{children}</div>;


// Small reusable header with back chevron + title
function AcctHeader({ title, onBack }) {
  return (
    <div style={{ padding: '56px 20px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
      <button onClick={onBack} style={{
        width: 38, height: 38, borderRadius: 999, background: '#FFFEFB',
        border: '1px solid var(--hairline)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M9 2L3 7L9 12" stroke="#1C1C1A" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <h1 className="t-h2" style={{ margin: '0 auto', paddingRight: 38 }}>{title}</h1>
    </div>);

}

// Avatar circle with initials
function Avatar({ name, size = 64, bg = 'var(--primary)', fg = 'var(--accent)' }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Fraunces, serif', fontStyle: 'italic',
      fontWeight: 500, fontSize: size * 0.42, letterSpacing: '-0.02em',
      flexShrink: 0
    }}>{initials}</div>);

}

// Generic row
function Row({ icon, label, value, onClick, danger, last }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', cursor: onClick ? 'pointer' : 'default',
      borderBottom: last ? 'none' : '1px solid var(--hairline)'
    }}>
      {icon &&
      <div style={{
        width: 32, height: 32, borderRadius: 9,
        background: danger ? 'rgba(199,104,69,0.1)' : 'var(--primary-50)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
      }}>{icon}</div>
      }
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight: 600, fontSize: 15,
          color: danger ? 'var(--red)' : 'var(--text)'
        }}>{label}</div>
      </div>
      {value && <div className="t-small muted">{value}</div>}
      {onClick &&
      <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M5 3L9 7L5 11" stroke="var(--muted-2)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      }
    </div>);

}

// Group wrapper
function Group({ label, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      {label && <div className="t-micro" style={{ color: 'var(--muted)', padding: '0 4px 8px' }}>{label}</div>}
      <div style={{
        background: '#FFFEFB',
        border: '1px solid var(--hairline)',
        borderRadius: 16,
        overflow: 'hidden'
      }}>{children}</div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// PROFILE
// ─────────────────────────────────────────────────────────────
function Profile({ next, tier, nav, onScan }) {
  const isPremium = tier === 'premium';
  return (
    <div className="screen">
      <AcctHeader title="Profile" onBack={() => {}} />
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 196 }}>
        <div style={{ padding: '8px 24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Avatar name="Maya Chen" size={86} />
          <div style={{ textAlign: 'center' }}>
            <h2 className="t-h2" style={{ margin: '0 0 4px' }}>Maya Chen</h2>
            <div className="t-small muted">maya@example.com</div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '7px 14px', borderRadius: 999,
            background: isPremium ? 'var(--accent-soft)' : 'var(--primary-50)',
            color: 'var(--primary)', fontWeight: 700, fontSize: 12,
            letterSpacing: '0.04em', textTransform: 'uppercase'
          }}>
            {isPremium ? '★ Premium' : 'Free plan'}
          </div>
        </div>

        {/* Stat strip */}
        <div style={{ padding: '0 24px 24px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            background: '#FFFEFB', border: '1px solid var(--hairline)',
            borderRadius: 16, overflow: 'hidden'
          }}>
            <ProfileStat value="34" label="Items saved" />
            <ProfileStat value="12" label="Recipes cooked" />
            <ProfileStat value="£48" label="Estimated saved" last />
          </div>
        </div>

        <div style={{ padding: '0 24px' }}>
          <Group label="Account">
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="5" r="3" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>}
              label="Edit profile"
              onClick={() => {}} />
            
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M2 5l6 4 6-4" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>}
              label="Email"
              value="maya@example.com"
              onClick={() => {}} />
            
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="6" width="10" height="7" rx="1.5" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M5 6V4a3 3 0 016 0v2" stroke="#1B4332" strokeWidth="1.6" fill="none" /></svg>}
              label="Password"
              value="Change"
              onClick={() => {}}
              last />
            
          </Group>

          <Group label="Your fridge">
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="#1B4332" strokeWidth="1.6" fill="none" /><line x1="3" y1="6" x2="13" y2="6" stroke="#1B4332" strokeWidth="1.6" /></svg>}
              label="Household"
              value="1 member"
              onClick={() => {}} />
            
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="#1B4332" strokeWidth="1.6" strokeLinecap="round" /></svg>}
              label="Dietary preferences"
              value="Fish & seafood"
              onClick={() => {}}
              last />
            
          </Group>

          {!isPremium &&
          <button onClick={next} style={{
            width: '100%', padding: 18,
            background: 'linear-gradient(135deg, var(--primary) 0%, #1F4E39 100%)',
            border: 'none', borderRadius: 16, cursor: 'pointer',
            fontFamily: 'inherit', textAlign: 'left',
            display: 'flex', alignItems: 'center', gap: 14,
            marginBottom: 24
          }}>
              <div style={{
              width: 40, height: 40, borderRadius: 10, background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text)', fontWeight: 700, fontSize: 18
            }}>★</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'var(--surface)', fontWeight: 700, fontSize: 15 }}>Upgrade to Premium</div>
                <div style={{ color: 'rgba(248,244,238,0.7)', fontSize: 13, marginTop: 2 }}>Unlimited scans, daily ideas</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 4L10 8L6 12" stroke="#F8F4EE" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          }
        </div>
      </div>

      <AcctDock active="settings" nav={nav} onScan={onScan}>
        <button className="btn-primary" onClick={next}>Open settings</button>
      </AcctDock>
    </div>);

}

function ProfileStat({ value, label, last }) {
  return (
    <div style={{
      padding: '14px 8px', textAlign: 'center',
      borderRight: last ? 'none' : '1px solid var(--hairline)'
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--primary)' }}>{value}</div>
      <div className="t-micro" style={{ color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────
function Settings({ next, nav, onScan }) {
  const [toggles, setToggles] = React.useState({
    daily: true, expiry: true, weekly: false, haptics: true
  });
  const t = (k) => setToggles((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="screen">
      <AcctHeader title="Settings" onBack={() => {}} />
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 196 }}>
        <div style={{ padding: '8px 24px 0' }}>
          <Group label="Notifications">
            <Toggle label="Daily 'what to cook'" sub="1:42pm · uses your fridge" value={toggles.daily} onChange={() => t('daily')} />
            <Toggle label="Eat-first reminders" sub="When items are best today" value={toggles.expiry} onChange={() => t('expiry')} />
            <Toggle label="Weekly recap" sub="Sundays at 9am" value={toggles.weekly} onChange={() => t('weekly')} last />
          </Group>

          <Group label="Preferences">
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 8h12M5 4l-3 4 3 4M11 4l3 4-3 4" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              label="Units"
              value="Metric"
              onClick={() => {}} />
            
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M8 4v4l3 2" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>}
              label="Default servings"
              value="2"
              onClick={() => {}} />
            
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="2" stroke="#1B4332" strokeWidth="1.6" fill="none" /><circle cx="6" cy="8" r="1.5" fill="#1B4332" /><circle cx="10" cy="8" r="1.5" fill="#1B4332" /></svg>}
              label="Dietary filters"
              value="1 filter"
              onClick={() => {}}
              last />
            
          </Group>

          <Group label="App">
            <Toggle label="Haptics" value={toggles.haptics} onChange={() => t('haptics')} />
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M6 8l1.5 1.5L10 6.5" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              label="Appearance"
              value="System"
              onClick={() => {}}
              last />
            
          </Group>

          <Group label="Support">
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M6 7a2 2 0 014 0c0 1.5-2 1.5-2 3" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" /><circle cx="8" cy="12" r="0.8" fill="#1B4332" /></svg>}
              label="Help & FAQs"
              onClick={() => {}} />
            
            <Row
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 13c0-3 2-5 5-5s5 2 5 5" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" /><path d="M4 5h8M6 3v4M10 3v4" stroke="#1B4332" strokeWidth="1.6" strokeLinecap="round" /></svg>}
              label="Send feedback"
              onClick={() => {}} />
            
            <Row label="Terms of Service" onClick={() => {}} icon={<DocIcon />} />
            <Row label="Privacy Policy" onClick={() => {}} icon={<DocIcon />} last />
          </Group>

          <Group>
            <Row
              danger
              icon={<svg width="16" height="16" viewBox="0 0 16 16"><path d="M11 4H5a1 1 0 00-1 1v8a1 1 0 001 1h6M9 8h6m0 0l-2-2m2 2l-2 2" stroke="#C76845" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
              label="Sign out"
              onClick={() => {}}
              last />
            
          </Group>

          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <div className="wordmark" style={{ fontSize: 18 }}>chomp<span style={{ color: 'var(--accent)' }}>.</span></div>
            <div className="t-small muted" style={{ marginTop: 4 }}>v1.0.2 · Made with care</div>
          </div>
        </div>
      </div>

      <AcctDock active="settings" nav={nav} onScan={onScan}>
        <button className="btn-primary" onClick={next}>Open household</button>
      </AcctDock>
    </div>);

}

function DocIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2h6l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinejoin="round" /><path d="M10 2v3h3" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinejoin="round" /></svg>;
}

function Toggle({ label, sub, value, onChange, last }) {
  return (
    <div onClick={onChange} style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 16px', cursor: 'pointer',
      borderBottom: last ? 'none' : '1px solid var(--hairline)'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
        {sub && <div className="t-small muted" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      <div style={{
        width: 44, height: 26, borderRadius: 999,
        background: value ? 'var(--primary)' : 'var(--hairline-strong)',
        padding: 2, transition: 'background 0.2s', flexShrink: 0
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 999, background: '#fff',
          transform: value ? 'translateX(18px)' : 'translateX(0)',
          transition: 'transform 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// HOUSEHOLD
// ─────────────────────────────────────────────────────────────
function Household({ next, tier, nav, onScan }) {
  const isPremium = tier === 'premium';

  return (
    <div className="screen">
      <AcctHeader title="Household" onBack={() => {}} />
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 196 }}>
        <div style={{ padding: '0 24px' }}>
          {/* Household card */}
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #1F4E39 100%)',
            borderRadius: 20, padding: '22px 20px',
            marginBottom: 24, color: 'var(--surface)'
          }}>
            <div className="t-micro" style={{ color: 'var(--accent)', marginBottom: 10 }}>Household</div>
            <div style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontWeight: 500, fontSize: 32, letterSpacing: '-0.02em', marginBottom: 4 }}>
              The Chen kitchen
            </div>
            <div className="t-small" style={{ opacity: 0.75 }}>
              {isPremium ? '2 of 3 members · Shared fridge' : '1 member · Solo'}
            </div>
            <div style={{ display: 'flex', marginTop: 18 }}>
              {[
              { name: 'Maya Chen', bg: 'var(--accent)', fg: 'var(--primary)' },
              isPremium && { name: 'Sam Park', bg: '#E8C3B0', fg: 'var(--primary)' }].
              filter(Boolean).map((p, i) =>
              <div key={i} style={{ marginLeft: i === 0 ? 0 : -10 }}>
                  <Avatar name={p.name} size={36} bg={p.bg} fg={p.fg} />
                </div>
              )}
              {isPremium &&
              <div style={{
                marginLeft: -10,
                width: 36, height: 36, borderRadius: 999,
                background: 'rgba(248,244,238,0.15)',
                border: '1.5px dashed rgba(248,244,238,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--surface)', fontSize: 18, fontWeight: 300
              }}>+</div>
              }
            </div>
          </div>

          {/* Members section */}
          <div className="t-micro" style={{ color: 'var(--muted)', padding: '0 4px 8px' }}>
            Members
          </div>
          <div style={{
            background: '#FFFEFB', border: '1px solid var(--hairline)',
            borderRadius: 16, overflow: 'hidden', marginBottom: 24
          }}>
            <Member name="Maya Chen" email="maya@example.com" role="Owner · You" added={18} bg="var(--primary)" fg="var(--accent)" />
            {isPremium &&
            <Member name="Sam Park" email="sam@example.com" role="Member · Joined 12 May" added={9} bg="#E8C3B0" fg="var(--primary)" last />
            }
            {!isPremium &&
            <div style={{ padding: '20px 16px', borderTop: '1px solid var(--hairline)', textAlign: 'center' }}>
                <div className="t-label" style={{ marginBottom: 6 }}>Cook together</div>
                <p className="t-small muted" style={{ margin: '0 0 14px', maxWidth: 240, marginInline: 'auto' }}>
                  Share your fridge with up to 3 people. Receipts merge automatically.
                </p>
                <div className="chip" style={{ background: 'var(--accent)', color: 'var(--text)' }}>★ Premium feature</div>
              </div>
            }
          </div>

          {/* Activity */}
          {isPremium &&
          <div>
              <div className="t-micro" style={{ color: 'var(--muted)', padding: '0 4px 8px' }}>This week</div>
              <div style={{
              background: '#FFFEFB', border: '1px solid var(--hairline)',
              borderRadius: 16, overflow: 'hidden'
            }}>
                <Activity who="Sam" what="scanned a receipt" detail="Sainsbury's · 14 items" when="2h ago" bg="#E8C3B0" />
                <Activity who="Maya" what="cooked Spinach pasta" detail="Removed 5 items" when="yesterday" bg="var(--primary)" fg="var(--accent)" />
                <Activity who="Sam" what="added 3 items manually" detail="Eggs, milk, sourdough" when="Mon" bg="#E8C3B0" last />
              </div>
            </div>
          }
        </div>
      </div>

      <AcctDock active="settings" nav={nav} onScan={onScan}>
        <button className="btn-primary" onClick={next}>
          <svg width="16" height="16" viewBox="0 0 16 16" style={{ marginRight: 8 }}>
            <path d="M8 3v10M3 8h10" stroke="#F8F4EE" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Invite to household
        </button>
      </AcctDock>
    </div>);

}

function Member({ name, email, role, added, bg, fg, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px',
      borderBottom: last ? 'none' : '1px solid var(--hairline)'
    }}>
      <Avatar name={name} size={42} bg={bg} fg={fg} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 15 }}>{name}</div>
        <div className="t-small muted" style={{ marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary)' }}>{added}</div>
        <div className="t-micro" style={{ color: 'var(--muted)' }}>items added</div>
      </div>
    </div>);

}

function Activity({ who, what, detail, when, bg, fg = 'var(--surface)', last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderBottom: last ? 'none' : '1px solid var(--hairline)'
    }}>
      <Avatar name={who} size={32} bg={bg} fg={fg} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, lineHeight: 1.3 }}>
          <span style={{ fontWeight: 700 }}>{who}</span>
          <span style={{ color: 'var(--muted)' }}> {what}</span>
        </div>
        <div className="t-small muted" style={{ marginTop: 2 }}>{detail}</div>
      </div>
      <span className="t-micro" style={{ color: 'var(--muted-2)' }}>{when}</span>
    </div>);

}

// ─────────────────────────────────────────────────────────────
// INVITE
// ─────────────────────────────────────────────────────────────
function Invite({ next }) {
  const [copied, setCopied] = React.useState(false);
  const code = "FRESH-7K2M";
  const link = "chomp.app/join/7K2M";

  const onCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="screen">
      <AcctHeader title="Invite to household" onBack={() => {}} />
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 110 }}>
        <div style={{ padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 className="t-display" style={{ margin: '0 0 10px', fontSize: 32 }}>
              Cook <span style={{ fontStyle: 'italic', color: 'var(--primary)' }}>together.</span>
            </h1>
            <p className="t-body muted" style={{ margin: 0 }}>
              They'll see the same fridge, scan into it, and cook from it.
            </p>
          </div>

          {/* QR card */}
          <div style={{
            background: '#FFFEFB', border: '1px solid var(--hairline)',
            borderRadius: 20, padding: 24, marginBottom: 16,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18
          }}>
            <FakeQR />
            <div style={{ textAlign: 'center' }}>
              <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 8 }}>Household code</div>
              <div style={{
                fontFamily: 'Fraunces, serif', fontStyle: 'italic',
                fontWeight: 500, fontSize: 32, letterSpacing: '0.02em', color: 'var(--primary)'
              }}>{code}</div>
            </div>
            <div className="t-small muted" style={{ textAlign: 'center', maxWidth: 240 }}>
              They scan with Chomp's camera, or enter the code on the join screen.
            </div>
          </div>

          {/* Shareable link */}
          <div style={{
            background: '#FFFEFB', border: '1px solid var(--hairline)',
            borderRadius: 14, padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, background: 'var(--primary-50)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16"><path d="M6 10l4-4M6.5 4l1-1a2.5 2.5 0 013.5 3.5l-1 1M9.5 12l-1 1a2.5 2.5 0 01-3.5-3.5l1-1" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 2 }}>Invite link</div>
              <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</div>
            </div>
            <button onClick={onCopy} style={{
              padding: '8px 14px', borderRadius: 999,
              background: copied ? 'var(--green)' : 'var(--primary)',
              color: 'var(--surface)', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
              transition: 'background 0.2s'
            }}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Share methods */}
          <div className="t-micro" style={{ color: 'var(--muted)', padding: '12px 4px 10px' }}>Share via</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
            <ShareBtn icon={<svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 11l5 5L19 5" stroke="#1B4332" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>} label="Messages" />
            <ShareBtn icon={<svg width="22" height="22" viewBox="0 0 22 22"><rect x="3" y="5" width="16" height="13" rx="2" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M3 7l8 5 8-5" stroke="#1B4332" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>} label="Email" />
            <ShareBtn icon={<svg width="22" height="22" viewBox="0 0 22 22"><circle cx="6" cy="11" r="2.5" stroke="#1B4332" strokeWidth="1.6" fill="none" /><circle cx="16" cy="6" r="2.5" stroke="#1B4332" strokeWidth="1.6" fill="none" /><circle cx="16" cy="16" r="2.5" stroke="#1B4332" strokeWidth="1.6" fill="none" /><path d="M8 10l6-3M8 12l6 3" stroke="#1B4332" strokeWidth="1.6" /></svg>} label="Share" />
            <ShareBtn icon={<svg width="22" height="22" viewBox="0 0 22 22"><rect x="6" y="3" width="10" height="16" rx="2" stroke="#1B4332" strokeWidth="1.6" fill="none" /><circle cx="11" cy="16" r="0.8" fill="#1B4332" /></svg>} label="AirDrop" />
          </div>

          {/* Note */}
          <div style={{
            background: 'var(--primary-50)',
            border: '1px solid var(--hairline)',
            borderRadius: 14, padding: '14px 16px',
            display: 'flex', gap: 12, alignItems: 'flex-start'
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 999, background: 'var(--primary)',
              color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontWeight: 700, fontSize: 13, marginTop: 1
            }}>i</div>
            <div>
              <div className="t-label" style={{ marginBottom: 4 }}>Invites expire in 7 days</div>
              <div className="t-small muted">Up to 3 members per household on Premium. You can revoke anytime.</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 20px 28px',
        background: 'linear-gradient(to top, var(--surface) 60%, rgba(248,244,238,0))'
      }}>
        <button className="btn-primary" onClick={next}>Done</button>
      </div>
    </div>);

}

function ShareBtn({ icon, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, background: '#FFFEFB',
        border: '1px solid var(--hairline)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
    </div>);

}

// A handcrafted QR-ish square (not a real QR — placeholder)
function FakeQR() {
  // Deterministic pseudo-random pattern
  const cells = [];
  const N = 17;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // skip finder zones, we draw those separately
      const inFinder = x < 4 && y < 4 || x > N - 5 && y < 4 || x < 4 && y > N - 5;
      if (inFinder) continue;
      // pseudo random based on coords
      const v = (x * 17 + y * 31 + x * y * 7) % 11;
      if (v < 5) cells.push({ x, y });
    }
  }
  const s = 8;
  const Finder = ({ cx, cy }) =>
  <g>
      <rect x={cx} y={cy} width={s * 4} height={s * 4} fill="#1B4332" />
      <rect x={cx + s * 0.5} y={cy + s * 0.5} width={s * 3} height={s * 3} fill="#F8F4EE" />
      <rect x={cx + s} y={cy + s} width={s * 2} height={s * 2} fill="#1B4332" />
    </g>;

  return (
    <div style={{
      background: '#F8F4EE', borderRadius: 12, padding: 14,
      border: '1px solid var(--hairline)'
    }}>
      <svg width={N * s} height={N * s} viewBox={`0 0 ${N * s} ${N * s}`}>
        <Finder cx={0} cy={0} />
        <Finder cx={(N - 4) * s} cy={0} />
        <Finder cx={0} cy={(N - 4) * s} />
        {cells.map(({ x, y }, i) =>
        <rect key={i} x={x * s} y={y * s} width={s} height={s} fill="#1B4332" rx="1" />
        )}
        {/* gold center accent */}
        <rect x={(N / 2 - 1.5) * s} y={(N / 2 - 1.5) * s} width={s * 3} height={s * 3} fill="#F8F4EE" />
        <rect x={(N / 2 - 1) * s} y={(N / 2 - 1) * s} width={s * 2} height={s * 2} fill="#D4A843" rx="2" />
      </svg>
    </div>);

}

window.AcctScreens = { Profile, Settings, Household, Invite };