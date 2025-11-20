import './polyfills' // Must be first - polyfills for ChatKit
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const rootElement = document.getElementById("root")!;

// Global error handlers to diagnose unexpected page reloads
if (typeof window !== 'undefined') {
  // Log unhandled errors
  window.addEventListener('error', (event) => {
    console.error('[Global Error Handler] Unhandled error:', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
      stack: event.error?.stack,
      timestamp: new Date().toISOString(),
    });
  });

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global Error Handler] Unhandled promise rejection:', {
      reason: event.reason,
      promise: event.promise,
      stack: event.reason?.stack,
      timestamp: new Date().toISOString(),
    });
  });

  // Log before page unloads (to detect reloads)
  window.addEventListener('beforeunload', () => {
    console.warn('[Page Reload] Page is about to unload/reload at:', new Date().toISOString());
    console.trace('[Page Reload] Stack trace:');
  });
}

// Use hydration if the page was pre-rendered, otherwise use normal rendering
try {
  if (rootElement.hasChildNodes()) {
    console.log('[Hydration] Detected pre-rendered content, using hydrateRoot');
    hydrateRoot(rootElement, <App />);
  } else {
    console.log('[Hydration] No pre-rendered content, using createRoot');
    createRoot(rootElement).render(<App />);
  }
} catch (error) {
  console.error('[Hydration Error] Failed to hydrate/render:', error);
  // Fallback: clear and re-render
  rootElement.innerHTML = '';
  createRoot(rootElement).render(<App />);
}
