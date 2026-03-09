export default function AuthLoading() {
  return (
    <main className="relative min-h-screen flex items-center justify-center">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-violet-500/10 via-transparent to-purple-500/10" />
      <div className="w-full max-w-md mx-auto px-4">
        <div className="animate-pulse space-y-6 text-center">
          <div className="h-10 w-48 mx-auto rounded-lg bg-muted" />
          <div className="h-5 w-64 mx-auto rounded bg-muted" />
          <div className="h-12 w-full rounded-xl bg-muted" />
        </div>
      </div>
    </main>
  );
}
