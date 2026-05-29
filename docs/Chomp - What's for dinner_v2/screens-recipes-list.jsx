// Chomp — Recipes list (browse + saved + cooked history)

const { BottomDock: NavDock } = window.ChompNav;

function RecipesList({ next, tier, nav, onScan }) {
  const [tab, setTab] = React.useState('all');

  return (
    <div className="screen">
      {/* Top */}
      <div style={{ padding: '64px 24px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div className="t-micro" style={{ color: 'var(--muted)' }}>32 recipes</div>
            <h1 className="t-h1" style={{ margin: '4px 0 0' }}>Recipes</h1>
          </div>
          <div style={{
            width: 38, height: 38, borderRadius: 999, background: '#FFFEFB',
            border: '1px solid var(--hairline)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 4h12M4 8h8M6 12h4" stroke="#1B4332" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </div>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: '#FFFEFB',
          border: '1px solid var(--hairline)', borderRadius: 12,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" stroke="#6B7A6D" strokeWidth="1.6" fill="none"/><path d="M11 11l3 3" stroke="#6B7A6D" strokeWidth="1.6" strokeLinecap="round"/></svg>
          <span style={{ color: 'var(--muted)', fontSize: 14, flex: 1 }}>Search recipes or ingredients…</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '3px 7px', background: 'var(--primary-50)', borderRadius: 6,
            fontSize: 11, fontWeight: 700, color: 'var(--primary)',
          }}>⌘ K</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '4px 24px 12px', display: 'flex', gap: 6, borderBottom: '1px solid var(--hairline)' }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'saved', label: 'Saved · 8' },
          { id: 'cooked', label: 'Cooked · 12' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 4px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
            color: tab === t.id ? 'var(--primary)' : 'var(--muted)',
            borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
            marginBottom: -1, marginRight: 18,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 196 }}>
        {/* Chips row */}
        <div style={{ padding: '16px 24px 12px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          <FilterChip label="From your fridge" active count="3" />
          <FilterChip label="≤ 20 min" />
          <FilterChip label="Simple" />
          <FilterChip label="Veggie" />
          <FilterChip label="Comfort" />
        </div>

        {/* Featured cooked-again */}
        <div style={{ padding: '4px 24px 20px' }}>
          <div className="t-micro" style={{ color: 'var(--muted)', marginBottom: 10 }}>Cook again</div>
          <div style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, #1F4E39 100%)',
            color: 'var(--surface)', borderRadius: 18, padding: 16,
            display: 'flex', gap: 14, alignItems: 'stretch',
          }}>
            <div style={{
              width: 96, height: 96, borderRadius: 12, flexShrink: 0,
              background: 'linear-gradient(135deg, #C8D5C2, #A8BDA0)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
            }}>
              <RecipeGlyph color="#1B4332" />
              <div style={{
                position: 'absolute', top: 6, right: 6,
                width: 22, height: 22, borderRadius: 999, background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text)', fontSize: 10, fontWeight: 700,
              }}>3×</div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div className="t-micro" style={{ color: 'var(--accent)', marginBottom: 4 }}>Your favourite</div>
                <div style={{ fontWeight: 700, fontSize: 17, lineHeight: 1.2 }}>Spinach & feta pasta</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, opacity: 0.85 }}>
                <span>⏱ 20 min</span><span>·</span><span>You have 5/5 items</span>
              </div>
            </div>
          </div>
        </div>

        {/* From your fridge */}
        <Section label="From your fridge tonight">
          <RecipeRow color="#C8D5C2" name="Spinach & feta pasta"     time="20 min" haveAll badges={['Saves spinach']} />
          <RecipeRow color="#E8C3B0" name="Mediterranean chicken bowl" time="30 min" haveAll badges={['Uses chicken']} />
          <RecipeRow color="#F0DDA8" name="Cheesy egg toast"          time="10 min" haveAll badges={['3 items at risk']} />
        </Section>

        {/* Saved */}
        <Section label="Saved" cta="See all 8">
          <RecipeRow color="#E8B59E" name="Tomato & basil galette" time="45 min" missing="2 items" />
          <RecipeRow color="#C8D5C2" name="Green shakshuka"        time="25 min" missing="1 item" />
          <RecipeRow color="#E5D9C4" name="Lemon roast chicken"     time="1 hr" missing="3 items" />
        </Section>

        {/* Discover */}
        <Section label="Discover">
          <RecipeRow color="#F0DDA8" name="One-pan butter dal"      time="30 min" tag="Comfort" />
          <RecipeRow color="#E8C3B0" name="Sticky soy salmon"        time="15 min" tag="Quick" />
          <RecipeRow color="#C8D5C2" name="Charred broccoli pasta"   time="25 min" tag="Veggie" />
          <RecipeRow color="#E8B59E" name="Tray-bake gnocchi"        time="35 min" tag="Cozy" />
        </Section>
      </div>

      <NavDock active="recipes" nav={nav} onScan={onScan}>
        <button className="btn-primary" onClick={next}>What should I cook?</button>
      </NavDock>
    </div>
  );
}

function FilterChip({ label, active, count }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '8px 14px', borderRadius: 999, whiteSpace: 'nowrap',
      background: active ? 'var(--primary)' : '#FFFEFB',
      color: active ? 'var(--surface)' : 'var(--text)',
      border: `1px solid ${active ? 'var(--primary)' : 'var(--hairline)'}`,
      fontSize: 13, fontWeight: 600, flexShrink: 0,
    }}>
      {label}
      {count && (
        <span style={{
          padding: '1px 6px', borderRadius: 999,
          background: active ? 'var(--accent)' : 'var(--primary-50)',
          color: active ? 'var(--text)' : 'var(--primary)',
          fontSize: 11, fontWeight: 700,
        }}>{count}</span>
      )}
    </div>
  );
}

function Section({ label, cta, children }) {
  return (
    <div style={{ padding: '0 24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="t-h3">{label}</h2>
        {cta && <span className="t-small muted" style={{ fontWeight: 600 }}>{cta}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {children}
      </div>
    </div>
  );
}

function RecipeRow({ color, name, time, haveAll, missing, tag, badges }) {
  return (
    <div style={{
      background: '#FFFEFB', border: '1px solid var(--hairline)', borderRadius: 14,
      padding: 10, display: 'flex', gap: 12, alignItems: 'center',
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 10, flexShrink: 0,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
          <ellipse cx="24" cy="28" rx="16" ry="8" stroke="#1B4332" strokeWidth="1.8" fill="none"/>
          <path d="M12 28 Q16 22 24 22 Q32 22 36 28" stroke="#1B4332" strokeWidth="1.5" fill="none"/>
          <circle cx="20" cy="26" r="1.5" fill="#1B4332"/>
          <circle cx="28" cy="25" r="1.5" fill="#1B4332"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 4 }}>{name}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="t-small muted">⏱ {time}</span>
          {haveAll && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
              <span className="dot dot-green" style={{ width: 6, height: 6 }} />Have it all
            </span>
          )}
          {missing && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>· Need {missing}</span>}
          {tag && (
            <span style={{
              padding: '2px 7px', borderRadius: 999, background: 'var(--primary-50)',
              fontSize: 11, fontWeight: 700, color: 'var(--primary)',
            }}>{tag}</span>
          )}
          {badges && badges.map(b => (
            <span key={b} style={{
              padding: '2px 7px', borderRadius: 999, background: 'rgba(212,168,67,0.18)',
              fontSize: 11, fontWeight: 700, color: 'var(--primary)',
            }}>{b}</span>
          ))}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M5 3L9 7L5 11" stroke="var(--muted-2)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// Local copy of RecipeGlyph (used inline above)
function RecipeGlyph({ color }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <ellipse cx="24" cy="32" rx="18" ry="4" stroke={color} strokeOpacity="0.3" strokeWidth="1.5"/>
      <ellipse cx="24" cy="28" rx="16" ry="8" stroke={color} strokeWidth="1.8" fill="none"/>
      <path d="M12 28 Q16 22 24 22 Q32 22 36 28" stroke={color} strokeWidth="1.5" fill="none"/>
      <circle cx="20" cy="26" r="1.5" fill={color}/>
      <circle cx="28" cy="25" r="1.5" fill={color}/>
    </svg>
  );
}

window.RecipesListScreen = { RecipesList };
