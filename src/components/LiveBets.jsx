import { useState } from 'react';
import { useEngine, money } from '../hooks';

function Avatar({ name, hue, you }) {
  return (
    <span className={`avatar${you ? ' you' : ''}`} style={you ? undefined : { '--h': hue }} aria-hidden="true">
      {you ? 'You'.slice(0, 1) : name[0].toUpperCase()}
    </span>
  );
}

export default function LiveBets({ engine }) {
  const s = useEngine(engine);
  const [tab, setTab] = useState('all');

  const mine = ['A', 'B']
    .map((k, i) => ({ k, i, b: s.bets[k] }))
    .filter(({ b }) => b.status === 'live' || (b.status === 'pending' && s.phase === 'betting'));

  // my bets from this round that already finished (cashed out or lost) stay in the table
  const done = s.myLog.filter((e) => e.round === s.roundId);
  const myWins = done.filter((e) => e.win > 0);

  const staked = s.bots.reduce((a, b) => a + b.amount, 0)
    + mine.reduce((a, m) => a + m.b.stake, 0)
    + done.reduce((a, e) => a + e.stake, 0);
  const paid = s.bots.reduce((a, b) => a + (b.cashedAt ? b.amount * b.cashedAt : 0), 0)
    + myWins.reduce((a, e) => a + e.win, 0);
  const cashedCount = s.bots.filter((b) => b.cashedAt).length + myWins.length;

  return (
    <aside className="live" aria-label="Bets this round">
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>
          This round
        </button>
        <button role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
          My bets{s.myLog.length ? ` (${s.myLog.length})` : ''}
        </button>
      </div>

      {tab === 'all' && (
        <>
          <dl className="live-stats">
            <div><dt>Players</dt><dd>{s.bots.length + mine.length + done.length}</dd></div>
            <div><dt>Staked</dt><dd>{money(staked)}</dd></div>
            <div><dt>Cashed out</dt><dd>{cashedCount}</dd></div>
            <div><dt>Paid out</dt><dd>{money(paid)}</dd></div>
          </dl>
          <div className="table-head" aria-hidden="true">
            <span>Player</span><span>Bet</span><span>At</span><span>Win</span>
          </div>
          <ul className="rows">
            {mine.map(({ k, i, b }) => (
              <li key={'me' + k} className="row me">
                <span className="who"><Avatar you /> You <small>bet {i + 1}</small></span>
                <span>{money(b.stake)}</span>
                <span className="at">{b.status === 'pending' ? 'ready' : 'flying'}</span>
                <span className="win">—</span>
              </li>
            ))}
            {done.map((e) => (
              <li key={'done' + e.slot + e.time} className={`row me${e.win > 0 ? ' cashed' : ' lost'}`}>
                <span className="who"><Avatar you /> You <small>bet {e.slot === 'A' ? 1 : 2}</small></span>
                <span>{money(e.stake)}</span>
                <span className="at">{e.win > 0 ? `${e.at.toFixed(2)}×` : ''}</span>
                <span className="win">{e.win > 0 ? money(e.win) : ''}</span>
              </li>
            ))}
            {s.bots.map((bot) => (
              <li key={bot.id} className={`row${bot.cashedAt ? ' cashed' : ''}${s.phase === 'crashed' && !bot.cashedAt ? ' lost' : ''}`}>
                <span className="who"><Avatar name={bot.name} hue={bot.hue} />{bot.name}</span>
                <span>{money(bot.amount)}</span>
                <span className="at">{bot.cashedAt ? `${bot.cashedAt.toFixed(2)}×` : ''}</span>
                <span className="win">{bot.cashedAt ? money(bot.amount * bot.cashedAt) : ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === 'mine' && (
        s.myLog.length === 0 ? (
          <div className="empty">
            <p>Your finished bets in this game show up here.</p>
            <p>Place a bet, then cash out before the crash.</p>
          </div>
        ) : (
          <>
            <div className="table-head" aria-hidden="true">
              <span>Round</span><span>Bet</span><span>At</span><span>Result</span>
            </div>
            <ul className="rows">
              {s.myLog.map((e, i) => (
                <li key={i} className={`row ${e.crashed ? 'lost' : 'cashed'}`}>
                  <span className="who">#{e.round} <small>bet {e.slot === 'A' ? 1 : 2}</small></span>
                  <span>{money(e.stake)}</span>
                  <span className="at">{e.at.toFixed(2)}×</span>
                  <span className="win">{e.crashed ? `−${money(e.stake)}` : `+${money(e.win - e.stake)}`}</span>
                </li>
              ))}
            </ul>
          </>
        )
      )}
    </aside>
  );
}
