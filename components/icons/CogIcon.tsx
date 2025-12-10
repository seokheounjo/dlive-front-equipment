import React from 'react';

export const CogIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-1.008 1.11-1.226.55-.218 1.19-.244 1.705-.149.515.096.966.386 1.258.82.292.435.433.96.401 1.486-.032.526-.252 1.025-.623 1.381a1.92 1.92 0 01-1.41.564c-.487.02-1.002-.12-1.385-.458a1.92 1.92 0 01-.564-1.41c-.026-.487.12-1.002.458-1.385zM12 6.375a5.625 5.625 0 100 11.25 5.625 5.625 0 000-11.25zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.94 4.94l1.06-1.06m12.12 1.06l-1.06 1.06M4.94 19.06l1.06 1.06m12.12-1.06l-1.06-1.06M12 2.25v1.5m0 16.5v1.5m-8.25-8.25H2.25m19.5 0h-1.5" />
  </svg>
);