import { useEffect, useRef, useState } from 'react';
import { useEngine, useBalance, money } from '../hooks';
import { unlockAudio } from '../engine/sound';

const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CHIPS = [10, 50, 100, 250];

function LiveWin({ engine, slot }) {
  const ref = useRef(null);
  useEffect(() => {
    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const v = engine.view(performance.now());
      const m = Math.floor(v.mult * 100) / 100;
      if (ref.current) ref.current.textContent = money(engine.liveStake(slot) * m);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [engine, slot]);
  return <strong ref={ref} className="btn-amount">0.00</strong>;
}

function Toggle({ id, checked, onChange, label, disabled }) {
  return (
    <label className="toggle" htmlFor={id}>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}

export default function BetPanel({ engine, slot, index }) {
  const s = useEngine(engine);
  const b = s.bets[slot];
  const balance = useBalance();
  const [draft, setDraft] = useState(b.amount.toFixed(2));
  const [autoDraft, setAutoDraft] = useState(b.autoCashAt.toFixed(2));
  const [editing, setEditing] = useState(false);
  const [editingAuto, setEditingAuto] = useState(false);
  const locked = b.status !== 'idle' || b.busy;
  const short = balance !== null && b.amount > balance;
  const uid = `${engine.id}-${slot}`;

  useEffect(() => { if (!editing) setDraft(b.amount.toFixed(2)); }, [b.amount, editing]);
  useEffect(() => { if (!editingAuto) setAutoDraft(b.autoCashAt.toFixed(2)); }, [b.autoCashAt, editingAuto]);

  const setAmount = (n) => {
    if (!Number.isFinite(n)) n = b.amount;
    engine.configure(slot, { amount: clamp(r2(n), s.limits.minBet, s.limits.maxBet) });
  };
  const commitDraft = () => {
    setEditing(false);
    setAmount(parseFloat(draft.replace(',', '.')));
  };
  const commitAuto = () => {
    setEditingAuto(false);
    let n = parseFloat(autoDraft.replace(',', '.'));
    if (!Number.isFinite(n)) n = b.autoCashAt;
    engine.configure(slot, { autoCashAt: clamp(r2(n), s.limits.minAutoCashOut, s.limits.maxMultiplier) });
  };

  const act = () => {
    unlockAudio();
    if (b.status === 'live' && s.phase === 'running') engine.cashOut(slot);
    else if (b.status === 'pending') engine.cancelBet(slot);
    else if (b.status === 'idle') engine.placeBet(slot);
  };

  let button;
  if (b.status === 'live' && s.phase === 'running') {
    button = (
      <button className="btn btn-main btn-cash" onClick={act} data-slot={slot}>
        <span className="btn-verb">Cash out</span>
        <LiveWin engine={engine} slot={slot} />
      </button>
    );
  } else if (b.status === 'pending') {
    button = (
      <button className="btn btn-main btn-cancel" onClick={act} data-slot={slot}>
        <span className="btn-verb">Cancel bet</span>
        <small>{s.phase === 'betting' && !b.queued ? `${money(b.stake)} in this round` : 'Waiting for the next round'}</small>
      </button>
    );
  } else {
    button = (
      <button className="btn btn-main btn-bet" onClick={act} data-slot={slot} disabled={short || b.busy || s.conn !== 'online'}>
        <span className="btn-verb">Bet {money(b.amount)}</span>
        <small>{s.conn !== 'online' ? 'Connecting…' : short ? 'Not enough balance' : s.phase === 'betting' ? 'Joins this round' : 'Joins the next round'}</small>
      </button>
    );
  }

  return (
    <section className={`bet-panel status-${b.status}`} aria-label={`Bet ${index}`}>
      <div className="bet-row">
        <div className="amount">
          <label className="sr-only" htmlFor={`${uid}-amt`}>Bet amount</label>
          <div className="stepper">
            <button className="step" aria-label="Decrease bet" disabled={locked} onClick={() => setAmount(b.amount / 2)}>½</button>
            <input
              id={`${uid}-amt`}
              inputMode="decimal"
              value={draft}
              disabled={locked}
              onFocus={() => setEditing(true)}
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
              onBlur={commitDraft}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <button className="step" aria-label="Double bet" disabled={locked} onClick={() => setAmount(b.amount * 2)}>2×</button>
          </div>
          <div className="chips">
            {CHIPS.map((c) => (
              <button key={c} className={`chip${b.amount === c ? ' on' : ''}`} disabled={locked} onClick={() => setAmount(c)}>{c}</button>
            ))}
          </div>
        </div>
        {button}
      </div>
      <div className="auto-row">
        <Toggle id={`${uid}-ab`} checked={b.autoBet} label="Auto bet" onChange={(v) => engine.configure(slot, { autoBet: v })} />
        <div className="auto-cash">
          <Toggle id={`${uid}-ac`} checked={b.autoCash} label="Cash out at" onChange={(v) => engine.configure(slot, { autoCash: v })} />
          <div className={`auto-input${b.autoCash ? '' : ' off'}`}>
            <input
              aria-label="Auto cash-out multiplier"
              inputMode="decimal"
              value={autoDraft}
              onFocus={() => setEditingAuto(true)}
              onChange={(e) => setAutoDraft(e.target.value.replace(/[^0-9.,]/g, ''))}
              onBlur={commitAuto}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
            <span>×</span>
          </div>
        </div>
      </div>
      {b.last && (
        <p className={`last-result ${b.last.type}`}>
          {b.last.type === 'win' && <>Won <strong>{money(b.last.amount)}</strong> at {b.last.at.toFixed(2)}×</>}
          {b.last.type === 'loss' && <>Lost {money(b.last.amount)} at {b.last.at.toFixed(2)}×</>}
        </p>
      )}
    </section>
  );
}
