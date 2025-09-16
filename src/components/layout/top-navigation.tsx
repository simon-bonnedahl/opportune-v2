'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ModeToggle } from './ThemeToggle/theme-toggle';
import { useUser } from '@clerk/nextjs';
import SearchInput from '../search-input';
import { navItems } from '@/constants/data';
import { UserNav } from './user-nav';



export default function TopNavigation() {
  const pathname = usePathname();
  const { user } = useUser();

  // Sliding indicator state and refs
  const navRef = useRef<HTMLDivElement | null>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicatorLeft, setIndicatorLeft] = useState<number>(0);
  const [indicatorWidth, setIndicatorWidth] = useState<number>(0);

  const activeKey = useMemo(() => {
    const found = navItems.find((item) => pathname === item.url);
    return found?.url ?? null;
  }, [pathname]);

  function updateIndicatorFor(key: string | null) {
    if (!key || !navRef.current) return;
    const target = linkRefs.current[key];
    if (!target) return;
    const containerRect = navRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    setIndicatorLeft(targetRect.left - containerRect.left);
    setIndicatorWidth(targetRect.width);
  }

  useEffect(() => {
    updateIndicatorFor(activeKey);
  }, [activeKey]);

  useEffect(() => {
    function onResize() {
      updateIndicatorFor(activeKey);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [activeKey]);

  return (
    <header className="flex h-16 items-center border-b px-6">
      {/* Logo and Navigation */}
      <div className="flex items-center gap-6">
        <Link href="/">
          <div className='h-16 w-16'>
            <Image src="/images/opportune-logo.svg" alt="Opportune" width={200} height={200} className='size-16 filter dark:invert' />
          </div>
        </Link>
        {/* Navigation Tabs */}
        <nav
          ref={navRef}
          className="relative flex items-center space-x-1 rounded-md"
        >
          {/* Sliding indicator */}
          <div
            aria-hidden
            className="absolute top-0 left-0 h-full rounded-md bg-primary shadow-sm transition-[transform,width] duration-300 ease-out"
            style={{
              transform: `translateX(${indicatorLeft}px)`,
              width: indicatorWidth,
              opacity: indicatorWidth > 0 ? 1 : 0,
            }}
          />
          {navItems.map((item) => {
            const isActive = pathname === item.url;
            return (
              <Link
                key={item.title}
                href={item.url}
                ref={(el) => {
                  linkRefs.current[item.url] = el;
                }}
                onClick={(e) => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  if (navRef.current) {
                    const containerRect = navRef.current.getBoundingClientRect();
                    const targetRect = el.getBoundingClientRect();
                    setIndicatorLeft(targetRect.left - containerRect.left);
                    setIndicatorWidth(targetRect.width);
                  }
                }}
                className={`relative z-10 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'text-primary-foreground'
                    : 'text-foreground/80 hover:text-foreground'
                }`}
              >
                {item.title}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right side - Search, Theme Toggle, User */}
      <div className="ml-auto flex items-center gap-4">
        <div className="hidden md:flex">
          <SearchInput />
        </div>
        <ModeToggle />
        {user && (
          <UserNav
          />
        )}
      </div>
    </header>
  );
} 