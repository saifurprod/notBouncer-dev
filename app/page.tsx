import Link from "next/link";

export default function HomePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams.error;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="max-w-xl w-full">
        <div className="mb-12">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-stone-500 mb-3">
            v0.1 · personal demo
          </p>
          <h1 className="font-display text-7xl leading-[0.95] tracking-tight">
            NoteBouncer
          </h1>
          <p className="mt-6 text-lg text-stone-700 leading-relaxed max-w-md">
            Automatically removes AI notetaker bots —{" "}
            <em className="font-display">Otter</em>,{" "}
            <em className="font-display">Fireflies</em>,{" "}
            <em className="font-display">Fathom</em>, and friends — from your
            Zoom meetings the moment they join.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            Install failed:{" "}
            <code className="font-mono">{error}</code>
          </div>
        )}

        <Link
          href="/install"
          className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-6 py-3 text-sm font-medium text-stone-50 transition hover:bg-stone-700"
        >
          Install on Zoom
          <span aria-hidden>→</span>
        </Link>

        <div className="mt-16 pt-8 border-t border-stone-200 text-sm text-stone-600 space-y-2">
          <p>
            <span className="font-mono text-xs text-stone-400 uppercase tracking-wider mr-2">
              note
            </span>
            This is a development build for personal use only.
          </p>
          <p>
            <span className="font-mono text-xs text-stone-400 uppercase tracking-wider mr-2">
              note
            </span>
            Tokens are encrypted with a single AES key. Not production-grade.
          </p>
        </div>
      </div>
    </main>
  );
}
