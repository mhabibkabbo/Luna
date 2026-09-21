import React from 'react';
import ReactDOM from 'react-dom/client';
import 'ol/ol.css';
import './index.css';
import App from './App.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
