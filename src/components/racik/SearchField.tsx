import { Search } from "lucide-react";

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-2xl border border-border bg-secondary px-4 focus-within:border-primary">
      <Search aria-hidden className="text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground" />
    </label>
  );
}