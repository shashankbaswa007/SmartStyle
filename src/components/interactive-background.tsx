"use client";

import React, { useState, useEffect } from 'react';

export function InteractiveBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="pointer-events-none fixed inset-0 z-0" />
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 transition duration-300"
      style={{
        background: `
          radial-gradient(600px at ${mousePosition.x}px ${mousePosition.y}px, hsl(var(--primary)/0.4), transparent 80%),
          radial-gradient(1200px at ${mousePosition.x}px ${mousePosition.y}px, hsl(var(--accent)/0.2), transparent 80%)
        `,
      }}
    />
  );
}
