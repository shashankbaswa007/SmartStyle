"use client"

import { useRef } from 'react';

const FooterText = () => {
  const containerRef = useRef(null);

  return (
    <div
      ref={containerRef}
      className="mt-4 text-lg max-w-2xl mx-auto text-center text-white font-semibold tracking-wide"
    >
      Let our AI be your guide to a more confident and stylish you. Get started for free
    </div>
  );
};

export default FooterText;