import { BrandMark } from '@/components/branding/BrandMark';
import { ShimmerSkeleton } from '@/components/ShimmerSkeleton';
import { Card, CardContent } from '@/components/ui/card';

export default function WardrobeLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_18%,rgba(20,184,166,0.15),transparent_30%),radial-gradient(circle_at_84%_82%,rgba(124,58,237,0.25),transparent_40%),linear-gradient(145deg,#060912_0%,#0f172a_100%)]" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-10 text-center">
          <div className="mb-3 flex justify-center">
            <BrandMark variant="small" size={34} detail="minimal" />
          </div>
          <ShimmerSkeleton className="mx-auto mb-4 h-16 w-64" />
          <ShimmerSkeleton className="mx-auto h-6 w-80" variant="text" />
        </header>
        <div className="flex gap-3 mb-6">
          <ShimmerSkeleton className="h-10 w-32 rounded-lg" />
          <ShimmerSkeleton className="h-10 flex-1 rounded-lg" />
          <ShimmerSkeleton className="h-10 w-24 rounded-lg" />
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="overflow-hidden">
              <ShimmerSkeleton className="h-48 w-full" />
              <CardContent className="p-4">
                <ShimmerSkeleton className="mb-2 h-5 w-2/3" variant="text" />
                <ShimmerSkeleton className="mb-2 h-4 w-full" variant="text" />
                <ShimmerSkeleton className="h-4 w-1/2" variant="text" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
