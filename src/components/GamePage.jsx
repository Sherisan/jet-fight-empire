import { useEffect } from 'react';
import { engines } from '../engine/engine';
import { unlockAudio } from '../engine/sound';
import { useEngine } from '../hooks';
import Stage from './Stage';
import BetPanel from './BetPanel';
import History from './History';
import LiveBets from './LiveBets';

export default function GamePage({ game }) {
  const engine = engines[game.id];
  const s = useEngine(engine);

  useEffect(() => {
    engine.setAudible(true);
    return () => engine.setAudible(false);
  }, [engine]);

  // Space bar runs the main action of bet 1.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' || e.repeat) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'button', 'a'].includes(tag)) return;
      e.preventDefault();
      unlockAudio();
      const b = engine.getSnapshot().bets.A;
      if (b.status === 'live') engine.cashOut('A');
      else if (b.status === 'pending') engine.cancelBet('A');
      else engine.placeBet('A');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  return (
    <main className="game" id="main" tabIndex={-1}>
      <div className="game-head">
        <h1 className="game-title">{game.title}</h1>
        <p className="game-round">Round {s.roundId}</p>
      </div>
      <div className="history-wrap">
        <History engine={engine} />
      </div>
      <div className="game-grid">
        <div className="play-col">
          <Stage game={game} engine={engine} />
          <div className="bets">
            <BetPanel engine={engine} slot="A" index={1} />
            <BetPanel engine={engine} slot="B" index={2} />
          </div>
          <p className="kbd-hint">Press <kbd>Space</kbd> to bet, cancel or cash out with bet 1.</p>
        </div>
        <LiveBets engine={engine} />
      </div>
    </main>
  );
}
