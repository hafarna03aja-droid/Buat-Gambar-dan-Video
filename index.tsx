
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';      // App.tsx ada di root folder
import './src/index.css';      // CSS ada di folder src

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
