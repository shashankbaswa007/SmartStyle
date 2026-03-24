import { BrandMark } from '@/components/branding/BrandMark';
import { ShimmerSkeleton } from '@/components/ShimmerSkeleton';

export default function StyleCheckLoading() {
  return (
    <div className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_14%_20%,rgba(20,184,166,0.16),transparent_30%),radial-gradient(circle_at_82%_80%,rgba(79,70,229,0.28),transparent_44%),linear-gradient(140deg,#060912_0%,#0b1225_100%)]" />
      <div className="relative z-10 mx-auto max-w-4xl">
        <header className="mb-14 text-center">
          <div className="mb-4 flex justify-center">
            <BrandMark variant="default" size={40} />
          </div>
          <ShimmerSkeleton className="mx-auto mb-4 h-16 w-72" />
          <ShimmerSkeleton className="mx-auto h-5 w-80" variant="text" />
        </header>
        <div className="space-y-8">
          <ShimmerSkeleton className="h-[400px] w-full rounded-2xl" />
          <div className="flex gap-4">
            <ShimmerSkeleton className="h-12 flex-1 rounded-lg" />
            <ShimmerSkeleton className="h-12 flex-1 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
