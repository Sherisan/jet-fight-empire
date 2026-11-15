import { useToasts } from '../hooks';

export default function Toasts() {
  const items = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="toast-game">{t.game}</span>
          <span className="toast-text">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
