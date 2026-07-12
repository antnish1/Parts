import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { queryClient } from './lib/queryClient';
import './index.css';
import './order-detail-compact.css';
import './mobile-parts-builder-fix.css';
import './responsive-table-cards.css';
import './desktop-foundation.css';
import './desktop-core-pages.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
