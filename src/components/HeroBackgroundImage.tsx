import Image from 'next/image';

export default function HeroBackgroundImage() {
  return (
    <Image
      src="/images/hero-934069.jpg"
      alt="Fashion flat lay background"
      fill
      sizes="100vw"
      priority
      quality={90}
      style={{ objectFit: 'cover' }}
      className="z-0"
    />
  );
}
