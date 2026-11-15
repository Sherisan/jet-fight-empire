import { useEffect } from 'react';
import { engines } from './engine/engine';
import { unlockAudio } from './engine/sound';
import { GAME } from './games';
import TopBar from './components/TopBar';
import GamePage from './components/GamePage';
import Toasts from './components/Toasts';

const engine = engines.jet;

export default function App() {
  // One clock drives the rounds, even while the tab is in the background.
  useEffect(() => {
    let raf;
    const loop = () => {
      engine.tick(performance.now());
      raf = requestAnimationFrame(loop);
    };
    loop();
    const bg = setInterval(() => { if (document.hidden) engine.tick(performance.now()); }, 500);
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => { cancelAnimationFrame(raf); clearInterval(bg); window.removeEventListener('pointerdown', unlock); };
  }, []);

  return (
    <div className="app" data-theme="jet">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>Skip to the game</a>
      <TopBar />
      <GamePage game={GAME} />
      <Toasts />
    </div>
  );
}
