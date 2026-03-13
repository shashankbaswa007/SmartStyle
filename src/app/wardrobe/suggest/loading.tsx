import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function WardrobeSuggestLoading() {
  return (
    <div className="relative min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-violet-500/10 via-transparent to-purple-500/10" />
      <div className="relative z-10 max-w-4xl mx-auto">
        <header className="text-center mb-10">
          <Skeleton className="h-16 w-56 mx-auto mb-4" />
          <Skeleton className="h-5 w-72 mx-auto" />
        </header>
        <div className="grid md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-56 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
