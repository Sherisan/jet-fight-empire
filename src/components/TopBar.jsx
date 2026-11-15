import { useBalance, useMuted, money } from '../hooks';
import { wallet, START_BALANCE } from '../engine/wallet';
import { sound, unlockAudio } from '../engine/sound';

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
  return (
    <header className="topbar">
      <span className="mark">LAST SECOND</span>
      <nav className="gamenav" aria-label="Game">
        <span className="on" data-theme="jet" aria-current="page"><i className="dot" aria-hidden="true" />Jet Fight</span>
      </nav>
      <div className="wallet">
        <div className="balance" aria-live="polite">
          <span className="bal-label">Demo balance</span>
          <span className="bal-amount">{money(balance)}</span>
        </div>
        {balance < 10 && (
          <button className="refill" onClick={() => { unlockAudio(); wallet.reset(); }}>
            Refill to {money(START_BALANCE)}
          </button>
        )}
        <button className="icon-btn" onClick={() => { unlockAudio(); sound.toggle(); }} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Turn sound off'}>
          <SoundIcon muted={muted} />
        </button>
      </div>
    </header>
  );
}
