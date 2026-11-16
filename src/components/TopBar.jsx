import { useCallback, useState } from 'react';
import { useBalance, useMuted, useMusic, useEngine, money } from '../hooks';
import History from './History';
import { engines } from '../engine/engine';
import Menu, { MenuIcon } from './Menu';
import { wallet } from '../engine/wallet';
import { sound, unlockAudio } from '../engine/sound';

function MusicIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V6l11-2v12" />
      <circle cx="6.5" cy="18" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="16" r="2.5" fill="currentColor" stroke="none" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

function SoundIcon({ muted }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" stroke="none" />
      {muted ? (
        <path d="M17 9l5 6M22 9l-5 6" />
      ) : (
        <>
          <path d="M16.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 6a8.5 8.5 0 0 1 0 12" />
        </>
      )}
    </svg>
  );
}

export default function TopBar() {
  const balance = useBalance();
  const muted = useMuted();
  const musicOn = useMusic();
  const [menu, setMenu] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  const s = useEngine(engines.jet);
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={() => { unlockAudio(); setMenu(true); }} aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menu}>
        <MenuIcon />
      </button>
      <div className="brand">
        <span className="brand-badge" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 12c0-.8-.7-1.2-1.6-1.2h-4.6L10.6 3H8.4l2.4 7.8H6.2L4.4 8.2H2.8l1.1 3.8-1.1 3.8h1.6l1.8-2.6h4.6L8.4 21h2.2l4.7-7.8h4.6c.9 0 1.6-.4 1.6-1.2z" /></svg>
        </span>
        <h1 className="nav-title">JET FIGHT<small>EMPIRE</small></h1>
      </div>
      <div className="nav-history">
        <div className="round-tag"><span>Round</span><strong>{s.roundId}</strong></div>
        <History engine={engines.jet} />
      </div>
      <div className="wallet">
        <div className="balance" aria-live="polite">
          <span className="coin" aria-hidden="true">$</span>
          <span className="bal-text">
            <span className="bal-label">Balance{wallet.currency() ? ` (${wallet.currency()})` : ''}</span>
            <span className="bal-amount">{balance === null ? '—' : money(balance)}</span>
          </span>
        </div>
        <button className="icon-btn" onClick={() => { unlockAudio(); sound.toggleMusic(); }} aria-pressed={musicOn} aria-label={musicOn ? 'Turn music off' : 'Turn music on'}>
          <MusicIcon off={!musicOn} />
        </button>
        <button className="icon-btn" onClick={() => { unlockAudio(); sound.toggle(); }} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
          <SoundIcon muted={muted} />
        </button>
      </div>
      <Menu engine={engines.jet} open={menu} onClose={close} />
    </header>
  );
}
