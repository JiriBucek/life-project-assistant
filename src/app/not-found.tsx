import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-serif text-2xl font-medium text-ink">
        This page wandered off the map.
      </p>
      <p className="mt-2 max-w-sm text-ink-soft">
        The project or page you’re looking for doesn’t exist — or may have been
        removed during a reflection.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-sage px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sage-deep"
      >
        ← Back to your life map
      </Link>
    </div>
  );
}
