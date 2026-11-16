import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEngine, useMuted, useMusic, useVolume, useBalance, money } from '../hooks';
import { sound, unlockAudio } from '../engine/sound';
import { wallet } from '../engine/wallet';
import { timeFor } from '../engine/engine';

const RTP = '97%';

const TABS = [
  ['how', 'How to play'],
  ['rules', 'Rules'],
  ['fair', 'Fairness'],
  ['settings', 'Settings'],
];

const svg = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const MenuIcon = () => (<svg {...svg}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
const CloseIcon = () => (<svg {...svg}><path d="M6 6l12 12M18 6L6 18" /></svg>);
const CarrierIcon = () => (<svg {...svg}><path d="M2 15h20l-3 4H5z" /><path d="M14 15v-4h3v4" /><path d="M5 12h7" /></svg>);
const JetIcon = () => (<svg {...svg}><path d="M21 12l-7-2-4-6H8l2 6-5 1-2-2H2l1 3-1 3h1l2-2 5 1-2 6h2l4-6z" /></svg>);
const CashIcon = () => (<svg {...svg}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 10v4M18 10v4" /></svg>);
const AutoIcon = () => (<svg {...svg}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /></svg>);
const ShieldIcon = () => (<svg {...svg} width="28" height="28"><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>);

const steps = (betSeconds) => [
  [CarrierIcon, 'Bet while the jet waits on the carrier', `You have ${betSeconds} seconds to place up to two bets. A bet placed mid-flight joins the next round.`],
  [JetIcon, 'Launch into the sea battle', 'The jet takes off and the strike multiplier climbs from 1.00×.'],
  [JetIcon, 'Fly the jet yourself', 'Move your mouse, or drag your finger on a phone, and the jet follows. It doesn’t change when the round ends.'],
  [CashIcon, 'Cash out before you’re shot down', 'Win your bet × the multiplier. If a missile hits first, the bet is lost.'],
  [AutoIcon, 'Let it fly on its own', 'Auto bet repeats your bet every round. Auto cash-out takes the win at your target.'],
];

const PACE = [2, 5, 10, 100];

const BATTLE = [
  { name: 'Carrier deck', color: '#7fd3ff', text: 'Your fighter waits on the allied carrier during the countdown.' },
  { name: 'Dogfight', color: '#ff8a3d', text: 'Enemy fighters attack in formations. Your jet fires missiles and shoots them down.' },
  { name: 'Enemy fleet', color: '#ff5a5a', text: 'Battleships, cruisers and destroyers fire from the sea. Your strikes sink them.' },
  { name: 'Obstacles', color: '#ffd166', text: 'Climb over barrage balloons, fly through flak and dodge heat-seeking missiles with flares.' },
  { name: 'Into the night', color: '#9b8cff', text: 'The higher the multiplier, the deeper the battle goes into a stormy night. One missile hit and the jet goes down.' },
];

function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="menu-switch">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
    </label>
  );
}

const fmtSec = (s) => (s < 60 ? `${Math.round(s)}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`);

export default function Menu({ engine, open, onClose }) {
  const [tab, setTab] = useState('how');
  const s = useEngine(engine);
  const muted = useMuted();
  const musicOn = useMusic();
  const volume = useVolume();
  const balance = useBalance();
  const panelRef = useRef(null);
  const L = s.limits;
  const f = s.fairness;
  const MAX_MULT = L.maxMultiplier;

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    panelRef.current?.querySelector('button')?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="menu-backdrop" data-theme="jet" onClick={onClose}>
      <aside className="menu" role="dialog" aria-modal="true" aria-label="Game menu" ref={panelRef} onClick={(e) => e.stopPropagation()}>
        <header className="menu-head">
          <span className="menu-title">JET FIGHT EMPIRE</span>
          <button className="icon-btn" onClick={onClose} aria-label="Close menu"><CloseIcon /></button>
        </header>
        <nav className="menu-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>

        <div className="menu-body">
          {tab === 'how' && (
            <>
              <section className="menu-hero">
                <p className="hero-kicker">Crash game</p>
                <h2 className="hero-title">Launch. Strike.<br />Cash out.</h2>
                <p className="hero-sub">Bail out with your winnings before the flak brings you down.</p>
                <dl className="hero-stats">
                  <div><dt>RTP</dt><dd>{RTP}</dd></div>
                  <div><dt>Top win</dt><dd>{MAX_MULT.toLocaleString('en-US')}×</dd></div>
                  <div><dt>Bets</dt><dd>2 a round</dd></div>
                </dl>
              </section>

              <h3 className="menu-h">How a round works</h3>
              <ol className="timeline">
                {steps(L.betSeconds).map(([Icon, title, text], i) => (
                  <li key={title}>
                    <span className="tl-num" aria-hidden="true"><Icon /></span>
                    <div className="tl-body">
                      <span className="tl-step">Step {i + 1}</span>
                      <strong>{title}</strong>
                      <p>{text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <h3 className="menu-h">The battle</h3>
              <ol className="route">
                {BATTLE.map((z) => (
                  <li key={z.name} style={{ '--z': z.color }}>
                    <span className="route-node" aria-hidden="true" />
                    <div className="route-card">
                      <strong>{z.name}</strong>
                      <p>{z.text}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <h3 className="menu-h">How fast it climbs</h3>
              <dl className="rules">
                {PACE.map((m) => (
                  <div key={m}><dt>{m}× after</dt><dd>{fmtSec(timeFor(m))} of flight</dd></div>
                ))}
              </dl>

              <p className="menu-tip"><kbd>Space</kbd> bets, cancels or cashes out with bet 1.</p>
            </>
          )}

          {tab === 'rules' && (
            <>
              <dl className="rules">
                <div><dt>Return to player</dt><dd>{RTP}</dd></div>
                <div><dt>Highest multiplier</dt><dd>{money(MAX_MULT)}×</dd></div>
                <div><dt>Minimum bet</dt><dd>{money(L.minBet)}</dd></div>
                <div><dt>Maximum bet</dt><dd>{money(L.maxBet)}</dd></div>
                <div><dt>Maximum win per round</dt><dd>{money(L.maxWin)}</dd></div>
                <div><dt>Bets per round</dt><dd>{L.slots}</dd></div>
                <div><dt>Auto cash-out range</dt><dd>{L.minAutoCashOut.toFixed(2)}× – {money(MAX_MULT)}×</dd></div>
                <div><dt>Betting window</dt><dd>{L.betSeconds} seconds</dd></div>
              </dl>
              <ul className="menu-list">
                <li>The crash point is set before the round starts. Nothing you do changes it.</li>
                <li>A cash-out pays your bet × the multiplier at the moment you press it.</li>
                <li>An auto cash-out pays at exactly the multiplier you set, if the jet gets there.</li>
                <li>You can cancel a bet any time before launch and get it back in full.</li>
                <li>If the jet is shot down before you cash out, the bet is lost.</li>
                <li>About 3 in every 100 rounds end at 1.00×, the moment the jet launches.</li>
              </ul>
              <h3 className="menu-h">Your balance</h3>
              <ul className="menu-list">
                <li>Your balance is kept by the game server, not in this browser.</li>
                <li>Bets, wins and the crash point all come from the server.</li>
              </ul>
            </>
          )}

          {tab === 'fair' && (
            <>
              <div className="fair-hero"><ShieldIcon /><p>Every round has a {RTP} return to player. The chance of reaching a multiplier <em>x</em> is 0.97 ÷ <em>x</em>.</p></div>
              <h3 className="menu-h">Odds of reaching</h3>
              <dl className="rules">
                {[1.5, 2, 5, 10, 100].map((x) => (
                  <div key={x}><dt>{x.toFixed(2)}×</dt><dd>{(97 / x).toFixed(x >= 10 ? 2 : 1)}%</dd></div>
                ))}
              </dl>
              <h3 className="menu-h">This round</h3>
              <dl className="rules">
                <div><dt>Round</dt><dd>{s.roundId}</dd></div>
                <div><dt>Last crash</dt><dd>{s.history[0] != null ? `${s.history[0].toFixed(2)}×` : '—'}</dd></div>
                <div><dt>Round number (nonce)</dt><dd>{f.nonce ?? '—'}</dd></div>
              </dl>
              <h3 className="menu-h">Server seed hash</h3>
              <p className="menu-note fair-hash">{f.hash || 'Shows once connected to the game server.'}</p>
              {f.prevSeed && (
                <>
                  <h3 className="menu-h">Previous server seed</h3>
                  <p className="menu-note fair-hash">{f.prevSeed}</p>
                </>
              )}
              <p className="menu-note">The game server draws every crash point before betting opens and publishes the seed's hash. When the seed is replaced, the old seed is shown so you can check past rounds.</p>
            </>
          )}

          {tab === 'settings' && (
            <div className="settings">
              <Switch label="Sound" hint="Everything: effects and music" checked={!muted} onChange={() => { unlockAudio(); sound.toggle(); }} />
              <Switch label="Music" hint="The battle soundtrack" checked={musicOn} onChange={() => { unlockAudio(); sound.toggleMusic(); }} />
              <label className="menu-row menu-range">
                <span><strong>Volume</strong><small>{Math.round(volume * 100)}%</small></span>
                <input type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={(e) => { unlockAudio(); sound.setVolume(Number(e.target.value) / 100); }} />
              </label>
              <div className="menu-row">
                <span><strong>Balance</strong><small>{balance === null ? '—' : money(balance)}{wallet.currency() ? ` ${wallet.currency()}` : ''}</small></span>
              </div>
              <p className="menu-note">Animations calm down automatically if your device is set to reduce motion.</p>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
