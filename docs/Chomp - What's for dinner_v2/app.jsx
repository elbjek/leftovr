// Chomp — main app. Wires screens to a state machine and exposes Tweaks.

const { useState } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "tier": "free"
}/*EDITMODE-END*/;

const SCREENS = [
  { id: 'language',   label: 'Choose language',          group: 'Onboarding' },
  { id: 'hook1',      label: 'Hook 1 · Throw away',      group: 'Onboarding' },
  { id: 'hook2',      label: 'Hook 2 · Memory problem',  group: 'Onboarding' },
  { id: 'hook3',      label: 'Hook 3 · Scan flow',       group: 'Onboarding' },
  { id: 'hook4',      label: 'Hook 4 · Never wonder',    group: 'Onboarding' },
  { id: 'hook5',      label: 'Hook 5 · CTA',             group: 'Onboarding' },
  { id: 'signup',     label: 'Sign up',                  group: 'Account' },
  { id: 'name',       label: 'Your name',                group: 'Account' },
  { id: 'pq1',        label: 'Q1 · Cooking for',         group: 'Personalize' },
  { id: 'pq2',        label: 'Q2 · How you shop',        group: 'Personalize' },
  { id: 'pq3',        label: 'Q3 · What matters',        group: 'Personalize' },
  { id: 'pq4',        label: 'Q4 · Avoidances',          group: 'Personalize' },
  { id: 'fill',       label: "Let's fill your fridge",   group: 'First scan' },
  { id: 'camera',     label: 'Camera + coach marks',     group: 'First scan' },
  { id: 'processing', label: 'Processing',               group: 'First scan' },
  { id: 'celebrate',  label: 'Fridge is alive',          group: 'First scan' },
  { id: 'check',      label: 'Quick check',              group: 'First scan' },
  { id: 'notif',      label: 'Notification permission',  group: 'First scan' },
  { id: 'home',       label: 'Home · Virtual fridge',    group: 'App' },
  { id: 'scanchoice', label: 'Scan',                     group: 'App' },
  { id: 'recipeslist',label: 'Recipes list',             group: 'App' },
  { id: 'recipes',    label: "Tonight's options",        group: 'App' },
  { id: 'detail',     label: 'Recipe detail',            group: 'App' },
  { id: 'cooked',     label: 'I cooked this',            group: 'App' },
  { id: 'insights',   label: 'Insights (premium)',       group: 'App' },
  { id: 'paywall',    label: 'Premium paywall',          group: 'App' },
  { id: 'profile',    label: 'Profile',                  group: 'Account' },
  { id: 'settings',   label: 'Settings',                 group: 'Account' },
  { id: 'household',  label: 'Household',                group: 'Account' },
  { id: 'invite',     label: 'Invite to household',      group: 'Account' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [idx, setIdx] = useState(0);
  const [authMethod, setAuthMethod] = useState('email');

  const next = () => setIdx(i => Math.min(i + 1, SCREENS.length - 1));
  const prev = () => setIdx(i => Math.max(i - 1, 0));
  const goTo = (i) => setIdx(i);
  const goId = (id) => { const i = SCREENS.findIndex(s => s.id === id); if (i >= 0) setIdx(i); };

  const [scanReturn, setScanReturn] = useState('home');
  const openScan = (from) => () => { setScanReturn(from); goId('scanchoice'); };

  const screen = SCREENS[idx];
  const { LanguagePick, Hook1, Hook2, Hook3, Hook4, Hook5, Signup, NameScreen, PQ1, PQ2, PQ3, PQ4 } = window.OnboardingScreens;
  const { FillFridge, CameraScan, Processing, Celebrate, QuickCheck, Notif, Home, Recipes, RecipeDetail, CookedThis, Insights, Paywall, ScanChoice } = window.AppScreens;
  const { Profile, Settings, Household, Invite } = window.AcctScreens;
  const { RecipesList } = window.RecipesListScreen;

  const screenMap = {
    language:   <LanguagePick next={next} />,
    hook1:      <Hook1 next={next} />,
    hook2:      <Hook2 next={next} />,
    hook3:      <Hook3 next={next} />,
    hook4:      <Hook4 next={next} />,
    hook5:      <Hook5 next={next} />,
    signup:     <Signup next={next} onAuth={setAuthMethod} />,
    name:       <NameScreen next={next} method={authMethod} />,
    pq1:        <PQ1 next={next} />,
    pq2:        <PQ2 next={next} />,
    pq3:        <PQ3 next={next} />,
    pq4:        <PQ4 next={next} />,
    fill:       <FillFridge next={next} />,
    camera:     <CameraScan next={next} />,
    processing: <Processing next={next} />,
    celebrate:  <Celebrate next={next} nav={goId} />,
    check:      <QuickCheck next={next} />,
    notif:      <Notif next={next} />,
    home:       <Home next={next} tier={t.tier} nav={goId} onScan={openScan('home')} />,
    recipeslist:<RecipesList next={next} tier={t.tier} nav={goId} onScan={openScan('recipeslist')} />,
    recipes:    <Recipes next={next} tier={t.tier} nav={goId} onScan={openScan('recipes')} />,
    detail:     <RecipeDetail next={next} />,
    cooked:     <CookedThis next={next} />,
    insights:   <Insights next={next} nav={goId} onScan={openScan('insights')} />,
    paywall:    <Paywall next={next} />,
    scanchoice: <ScanChoice nav={goId} back={() => goId(scanReturn)} />,
    profile:    <Profile next={next} tier={t.tier} nav={goId} onScan={openScan('profile')} />,
    settings:   <Settings next={next} nav={goId} onScan={openScan('settings')} />,
    household:  <Household next={next} tier={t.tier} nav={goId} onScan={openScan('household')} />,
    invite:     <Invite next={() => setIdx(0)} />,
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 24,
    }}>
      {/* Top brand strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: 'var(--muted)' }}>
        <span className="wordmark" style={{ fontSize: 22 }}>chomp<span style={{ color: 'var(--accent)' }}>.</span></span>
        <div style={{ width: 1, height: 14, background: 'var(--hairline-strong)' }} />
        <span className="t-small" style={{ fontWeight: 600 }}>What's for dinner?</span>
        <div style={{ width: 1, height: 14, background: 'var(--hairline-strong)' }} />
        <span className="t-small">Prototype · {idx + 1} of {SCREENS.length}</span>
      </div>

      {/* Phone */}
      <div style={{ position: 'relative' }}>
        <IOSDevice>
          {screenMap[screen.id]}
        </IOSDevice>

        {/* Sidekick: back + screen label */}
        <div style={{
          position: 'absolute', left: -180, top: '50%', transform: 'translateY(-50%)',
          width: 160, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <button onClick={prev} disabled={idx === 0} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', background: '#FFFEFB',
            border: '1px solid var(--hairline)', borderRadius: 12,
            cursor: idx === 0 ? 'not-allowed' : 'pointer',
            opacity: idx === 0 ? 0.4 : 1,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--text)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12"><path d="M8 2L3 6L8 10" stroke="#1C1C1A" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Previous
          </button>
          <div style={{ padding: '0 4px' }}>
            <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 4 }}>{screen.group}</div>
            <div className="t-label">{screen.label}</div>
          </div>
        </div>

        {/* Sidekick right: screen jumper */}
        <div style={{
          position: 'absolute', right: -200, top: 0, bottom: 0,
          width: 180, padding: '8px 0',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 2,
        }}>
          {SCREENS.map((s, i) => {
            const isCurrent = i === idx;
            const isNewGroup = i === 0 || SCREENS[i - 1].group !== s.group;
            return (
              <React.Fragment key={s.id}>
                {isNewGroup && (
                  <div className="t-micro" style={{ color: 'var(--muted)', padding: '12px 10px 4px' }}>
                    {s.group}
                  </div>
                )}
                <button onClick={() => goTo(i)} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px',
                  background: isCurrent ? 'var(--primary)' : 'transparent',
                  color: isCurrent ? 'var(--surface)' : 'var(--text)',
                  border: 'none', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 500, textAlign: 'left',
                  width: '100%',
                }}>
                  <span style={{
                    width: 18, fontSize: 10, fontWeight: 700,
                    color: isCurrent ? 'var(--accent)' : 'var(--muted-2)',
                  }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ flex: 1 }}>{s.label.replace(/^[^·]+ · /, '')}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection label="Plan" />
        <TweakRadio
          label="Tier"
          value={t.tier}
          options={['free', 'premium']}
          onChange={(v) => setTweak('tier', v)}
        />
        <div style={{ padding: '0 12px 4px', fontSize: 11, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
          Toggle to see the Eat-first shelf, recipe filters, and weekly insights unlock.
        </div>
      </TweaksPanel>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
