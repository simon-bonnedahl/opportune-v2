'use client';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useTheme } from 'next-themes';
import React from 'react';



import { ReactNode } from 'react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/nextjs'
import { PostHogProvider } from './posthog-provider'
import { ConvexReactClient } from 'convex/react';

if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
  throw new Error('Missing NEXT_PUBLIC_CONVEX_URL in your .env file')
}

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL)

function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}

export default function Providers({
  children
}: {
  children: React.ReactNode;
}) {
  // we need the resolvedTheme value to set the baseTheme for clerk based on the dark or light theme
  const { resolvedTheme } = useTheme();

  return (
      <ClerkProvider
        appearance={{
          baseTheme: resolvedTheme === 'dark' ? dark : undefined
        }}
      >
        <PostHogProvider>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </PostHogProvider>
      </ClerkProvider>
  );
}
