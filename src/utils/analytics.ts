// Final Rybbit Analytics implementation for Site ID 8
// Using the working app.rybbit.io endpoint
// NOTE: If you get CORS errors on honeydewcook.com, create a new site in Rybbit dashboard
// and replace '8' below with your new site ID

export const initAnalytics = () => {
  try {
    console.log("🔄 Initializing Rybbit Analytics...");
    
    // Check if script is already loaded
    if (document.querySelector('script[src="https://app.rybbit.io/api/script.js"]')) {
      console.log("✅ Rybbit script already loaded");
      return;
    }
    
    // Create and inject the Rybbit script
    const script = document.createElement('script');
    script.src = 'https://app.rybbit.io/api/script.js';
    script.setAttribute('data-site-id', '8'); // Site ID 8 - UPDATE IF CREATING NEW SITE
    script.defer = true;
    
    script.onload = () => {
      console.log("✅ Rybbit Analytics loaded successfully");
      
      // Test that the global function is available
      setTimeout(() => {
        if (typeof (window as any).rybbit === 'function') {
          console.log("✅ Rybbit function available - analytics ready!");
          
          // Send initial test to verify it's working
          try {
            (window as any).rybbit('pageview');
            console.log("📄 Initial pageview tracked");
          } catch (error) {
            console.warn("⚠️ Initial pageview failed:", error);
          }
        } else {
          console.warn("⚠️ Rybbit function not available yet");
        }
      }, 1000);
    };
    
    script.onerror = () => {
      console.error("❌ Failed to load Rybbit Analytics script");
    };
    
    document.head.appendChild(script);
    
  } catch (error) {
    console.error("Failed to initialize Rybbit Analytics:", error);
  }
};

// Track custom events
export const trackEvent = (name: string, properties?: Record<string, any>) => {
  try {
    if (typeof (window as any).rybbit === 'function') {
      (window as any).rybbit('event', name, properties);
      console.log(`📊 Tracked event: ${name}`, properties);
    } else {
      console.warn(`⚠️ Cannot track event "${name}" - Rybbit not loaded yet`);
    }
  } catch (error) {
    console.error(`❌ Failed to track event "${name}":`, error);
  }
};

// Track pageviews
export const trackPageview = (path?: string) => {
  try {
    if (typeof (window as any).rybbit === 'function') {
      const pagePath = path || window.location.pathname;
      (window as any).rybbit('pageview', pagePath);
      console.log(`📄 Tracked pageview: ${pagePath}`);
    } else {
      console.warn(`⚠️ Cannot track pageview - Rybbit not loaded yet`);
    }
  } catch (error) {
    console.error("❌ Failed to track pageview:", error);
  }
};

export default {}; 