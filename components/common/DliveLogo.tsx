import React from 'react';

/**
 * A styled text component to represent the D'LIVE logo,
 * reflecting the branding provided in the image.
 * Uses a bold, sans-serif font for a modern look.
 */
export const DliveLogo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`font-extrabold tracking-tight ${className}`} style={{ fontFamily: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif` }}>
      D'LIVE
    </div>
  );
};
