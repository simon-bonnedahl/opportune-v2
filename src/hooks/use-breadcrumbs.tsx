'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

// This allows to add custom title as well
const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: 'Dashboard', link: '/dashboard' }],
  '/dashboard/overview': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Översikt', link: '/dashboard/overview' }
  ],
  '/dashboard/orders': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Ordrar', link: '/dashboard/orders' }
  ],
  '/dashboard/matches': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Matchningar', link: '/dashboard/matches' }
  ],
  '/dashboard/targets': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Mål', link: '/dashboard/targets' }
  ],
  '/dashboard/employee': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Medarbetare', link: '/dashboard/employee' }
  ],
  '/dashboard/product': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Produkter', link: '/dashboard/product' }
  ],
  '/dashboard/profile': [
    { title: 'Dashboard', link: '/dashboard' },
    { title: 'Profil', link: '/dashboard/profile' }
  ]
  // Add more custom mappings as needed
};

export function useBreadcrumbs() {
  const pathname = usePathname();

  const breadcrumbs = useMemo(() => {
    // Check if we have a custom mapping for this exact path
    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    // If no exact match, fall back to generating breadcrumbs from the path
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        title: segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname]);

  return breadcrumbs;
}
