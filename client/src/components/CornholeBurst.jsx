export default function CornholeBurst({ active, color = '#FFD700' }) {
  if (!active) return null;
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      <h1
        key={active}
        className="cornhole-burst font-black tracking-wider"
        style={{ color }}
      >
        CORNHOLE!
      </h1>
    </div>
  );
}
