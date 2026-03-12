
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
console.log('[Build] 20260225-0510');

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
