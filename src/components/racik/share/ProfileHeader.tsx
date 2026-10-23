import { Link } from "@tanstack/react-router";

/**
 * A cook's public face: handle, optional display name, photo, and how many
 * recipes she has published. Nothing else about her is ever shown.
 */
export function ProfileHeader({
  handle,
  publicName,
  photo,
  count,
  linked = true,
}: {
  handle: string;
  publicName: string | null;
  photo: string | null;
  count: number;
  linked?: boolean;
}) {
  const initial = (publicName || handle).replace(/^@/, "").slice(0, 1).toUpperCase();
  const body = (
    <div className="flex items-center gap-4">
      <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-2xl font-extrabold text-primary-deep">
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initial}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-head font-extrabold">@{handle}</span>
        {publicName ? (
          <span className="block truncate text-14 text-ink-2">{publicName}</span>
        ) : null}
        <span className="block text-caption text-ink-3">
          {count > 0 ? `${count} resep diterbitkan` : "Belum ada resep yang diterbitkan"}
        </span>
      </span>
    </div>
  );
  return (
    <header className="px-5 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-6">
      <p className="eyebrow mb-4">RACIK</p>
      {linked ? (
        <Link to="/u/$handle" params={{ handle }} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
    </header>
  );
}
