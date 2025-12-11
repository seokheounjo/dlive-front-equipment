
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// API 디버거 초기화 (콘솔 명령어 등록)
import './services/apiDebugger';

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
