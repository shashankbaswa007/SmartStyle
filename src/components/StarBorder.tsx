import React from 'react';

type StarBorderProps<T extends React.ElementType> = React.ComponentPropsWithoutRef<T> & {
  as?: T;
  className?: string;
  children?: React.ReactNode;
  color?: string;
  speed?: React.CSSProperties['animationDuration'];
  thickness?: number;
};

const StarBorder = <T extends React.ElementType = 'button'>({
  as,
  className = '',
  color = 'white',
  speed = '6s',
  thickness = 1,
  children,
  ...rest
}: StarBorderProps<T>) => {
  const Component = as || 'button';

  return (
    <Component
      className={`relative inline-block overflow-hidden rounded-2xl ${className}`}
      {...(rest as any)}
      style={{
        padding: `${thickness}px`,
        ...(rest as any).style
      }}
    >
      {/* Animated border effects */}
      <div
        className="absolute w-[300%] h-[50%] opacity-80 bottom-[-11px] right-[-250%] rounded-full animate-star-movement-bottom z-0 blur-md"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      <div
        className="absolute w-[300%] h-[50%] opacity-80 top-[-10px] left-[-250%] rounded-full animate-star-movement-top z-0 blur-md"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed
        }}
      ></div>
      
      {/* Inner content container with glassmorphism */}
      <div className="relative z-10 bg-gradient-to-br from-gray-900/95 via-black/95 to-gray-900/95 backdrop-blur-xl border border-gray-700/50 text-white text-center text-sm font-medium py-3 px-6 rounded-2xl transition-all duration-300 hover:border-gray-600/70 hover:bg-gradient-to-br hover:from-gray-800/95 hover:via-black/95 hover:to-gray-800/95">
        {children}
      </div>
    </Component>
  );
};

export default StarBorder;

// tailwind.config.js
// module.exports = {
//   theme: {
//     extend: {
//       animation: {
//         'star-movement-bottom': 'star-movement-bottom linear infinite alternate',
//         'star-movement-top': 'star-movement-top linear infinite alternate',
//       },
//       keyframes: {
//         'star-movement-bottom': {
//           '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
//           '100%': { transform: 'translate(-100%, 0%)', opacity: '0' },
//         },
//         'star-movement-top': {
//           '0%': { transform: 'translate(0%, 0%)', opacity: '1' },
//           '100%': { transform: 'translate(100%, 0%)', opacity: '0' },
//         },
//       },
//     },
//   }
// }
