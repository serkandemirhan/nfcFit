
import React from 'react';
import ReactDOM from 'react-dom/client';
const LegacyApp = React.lazy(() => import('./App'));
import TenantConsoleApp from './TenantConsole';
import TagLanding from './TagLanding';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {window.location.pathname.startsWith('/tag/') ? <TagLanding /> : import.meta.env.DEV && window.location.pathname.startsWith('/legacy') ? <React.Suspense fallback={<p>Yükleniyor…</p>}><LegacyApp /></React.Suspense> : <TenantConsoleApp />}
  </React.StrictMode>
);
