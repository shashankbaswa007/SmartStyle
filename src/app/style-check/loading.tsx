import { Skeleton } from '@/components/ui/skeleton';

export default function StyleCheckLoading() {
  return (
    <main className="relative min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-purple-500/10 via-transparent to-indigo-500/10" />
      <div className="relative z-10 max-w-4xl mx-auto">
        <header className="text-center mb-16">
          <Skeleton className="h-20 w-80 mx-auto mb-4" />
          <Skeleton className="h-6 w-96 mx-auto" />
        </header>
        <div className="space-y-8">
          <Skeleton className="h-[400px] w-full rounded-xl" />
          <div className="flex gap-4">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="h-12 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </main>
  );
}
