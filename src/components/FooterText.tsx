"use client"

import { useRef } from 'react';
import ShinyText from './ShinyText';

const FooterText = () => {
  const containerRef = useRef(null);

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative' }}
      className="mt-4 text-lg max-w-2xl mx-auto"
    >
      <ShinyText 
  text="Let our AI be your guide to a more confident and stylish you. Get started for free" 
  disabled={false} 
  speed={5} 
  className='custom-class' 
/>
    </div>
  );
};

export default FooterText;