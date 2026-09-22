export function PortionStepper({
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const btn =
    "flex h-11 w-11 items-center justify-center text-head text-ink disabled:text-rule";
  return (
    <div className="flex items-center gap-1 border border-rule rounded-sm bg-card">
      <button
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Kurangi porsi"
      >
        −
      </button>
      <div className="w-16 text-center">
        <span className="text-head font-semibold tabular-nums">{value}</span>
        <span className="text-label text-ink-3"> porsi</span>
      </div>
      <button
        className={btn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Tambah porsi"
      >
        +
      </button>
    </div>
  );
}
