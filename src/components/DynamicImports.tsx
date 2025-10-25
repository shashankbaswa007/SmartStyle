
import dynamic from 'next/dynamic';

export const DynamicTextPressure = dynamic(() => import('@/components/TextPressure'), { ssr: false });
export const DynamicSplashCursor = dynamic(() => import('@/components/SplashCursor'), { ssr: false });
export const DynamicSilk = dynamic(() => import('@/components/Particles'), { ssr: false });
