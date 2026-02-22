import { Skeleton } from '@/components/ui/skeleton';

export default function AccountSettingsLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <Skeleton className="h-10 w-32 mb-6 rounded-md" />
        <Skeleton className="h-12 w-64 mb-2" />
        <Skeleton className="h-5 w-80 mb-8" />
        <div className="grid gap-6">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
