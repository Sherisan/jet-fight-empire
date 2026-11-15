# Jet Fight Empire

A crash game built with React and HTML canvas. Launch from your aircraft carrier into a sea battle. Your jet shoots down enemy fighters and sinks battleships while anti-aircraft fire fills the sky. Cash out before a missile brings you down into the sea.
The multiplier climbs the whole round. Cash out before the crash to win your bet × the multiplier.
Everything runs on demo credits that are saved in your browser.

## Play without installing anything

Open `jet-fight-empire.html` in any browser. It's the whole game in one file.

## Run the React project

You need Node.js 18 or newer.

```bash
npm install
npm run dev      # opens a local dev server, usually http://localhost:5173
npm run build    # production build in dist/
```

## Files

| File | What it does |
| --- | --- |
| `src/App.jsx` | Starts the round clock and lays out the page |
| `src/games.js` | Game title and on-screen labels ("Launch in", "Shot down", ...) |
| `src/engine/engine.js` | Round logic: countdown, running and crashed phases, crash points, two bet slots, auto cash-out, auto bet, simulated players |
| `src/engine/wallet.js` | Demo balance (starts at 1,000, saved in localStorage) |
| `src/engine/sound.js` | Sound effects made with Web Audio, no audio files needed |
| `src/engine/toasts.js` | Pop-up messages ("Cashed out 64.20 at 6.42×") |
| `src/scenes/jet.js` | The animation: carrier launch, ocean, battleships, enemy jets, missiles, explosions, sinking ships, kill counter, crash into the sea |
| `src/scenes/util.js` | Small drawing and particle helpers |
| `src/components/` | Top bar, stage with the big multiplier, bet panels, crash history chips, players list, toasts |
| `src/styles.css` | All styling. Colours are CSS variables under `[data-theme='jet']` |

## Things you can change easily

- **Game speed:** `K` in `src/engine/engine.js`. The multiplier is e^(K × seconds), so 0.085 reaches 2× after about 8 seconds.
- **Countdown and crash-screen length:** `BET_MS` and `CRASH_MS` in the same file.
- **Payout curve:** `genCrashPoint()`. It's currently a 3% house edge: P(crash ≥ x) = 0.97 / x.
- **How often enemies appear and you attack:** `nextEnemy` and `nextAttack` in `src/scenes/jet.js`.
- **Starting balance:** `START_BALANCE` in `src/engine/wallet.js`.
- **Colours:** the `[data-theme='jet']` block in `src/styles.css`.

## Fonts

The page loads Bungee (title and multiplier) and Chakra Petch (everything else) from Google Fonts. Without an internet connection it falls back to system fonts.

Note: crash points come from `Math.random()` in the browser, which is fine for a demo. A real-money version would need a server-side, provably fair generator and the licences that go with it.
