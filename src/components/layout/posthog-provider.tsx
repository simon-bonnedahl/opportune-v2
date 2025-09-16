'use client';

import { useEffect } from 'react';
import posthog from 'posthog-js';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      // Add a small delay to ensure the app is fully loaded
      const timer = setTimeout(async () => {
        try {
          // Check if PostHog is already initialized
          if (posthog.__loaded) {
            return;
          }

          // Test if analytics are blocked (ad blocker detection)
          const testRequest = fetch('/ingest/decide', { 
            method: 'POST',
            body: JSON.stringify({ token: 'test' }),
            headers: { 'Content-Type': 'application/json' }
          }).catch(() => null);

          const result = await Promise.race([
            testRequest,
            new Promise(resolve => setTimeout(() => resolve(null), 2000))
          ]);

          if (!result) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('PostHog blocked by ad blocker or network issues - analytics disabled');
            }
            return;
          }

          posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
            api_host: '/ingest', // Use the proxy to bypass ad blockers
            ui_host: 'https://eu.posthog.com',
            person_profiles: 'identified_only',
            capture_pageview: false,
            capture_exceptions: false,
            debug: process.env.NODE_ENV === 'development',
            autocapture: false,
            disable_session_recording: true,
            loaded: function() {
              if (process.env.NODE_ENV === 'development') {
                console.log('PostHog loaded successfully');
              }
            },
            on_request_error: (error) => {
              // Silently handle request errors (ad blocker, network issues)
              if (process.env.NODE_ENV === 'development') {
                console.warn('PostHog request error (likely ad blocker):', error);
              }
            }
          });
        } catch (error) {
          // Completely silent failure - don't log anything to avoid console spam
          if (process.env.NODE_ENV === 'development') {
            console.warn('PostHog initialization failed (likely ad blocker):', error instanceof Error ? error.message : String(error));
          }
        }
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  return <>{children}</>;
} 