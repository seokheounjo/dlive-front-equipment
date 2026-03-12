import React from 'react';

/**
 * D'LIVE logo component using PNG image.
 * Uses /dlive_logo.png (teal colored logo).
 */
export const DliveLogo: React.FC<{ className?: string; height?: number }> = ({ className, height = 22 }) => {
  return (
    <img
      src="/dlive_logo.png"
      alt="D'LIVE"
      className={className}
      style={{
        height: `${height}px`,
        width: 'auto',
        objectFit: 'contain',
      }}
    />
  );
};
