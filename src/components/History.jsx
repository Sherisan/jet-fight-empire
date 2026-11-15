import { useEngine, tier } from '../hooks';

export default function History({ engine, limit = 26, compact = false }) {
  const s = useEngine(engine);
  const items = s.history.slice(0, limit);
  return (
    <ol className={`history${compact ? ' compact' : ''}`} aria-label="Recent crash points, newest first">
      {items.map((m, i) => (
        <li key={i} className={`hchip ${tier(m)}${i === 0 && s.phase === 'crashed' && !compact ? ' fresh' : ''}`}>
          {m.toFixed(2)}×
        </li>
      ))}
    </ol>
  );
}
