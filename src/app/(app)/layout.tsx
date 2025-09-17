import KBar from '@/components/kbar';
import TopNavigation from '@/components/layout/top-navigation';
import { navItems } from '@/constants/data';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Opportune',
  description: 'Opportune'
};

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  
  return (
    <KBar navItems={navItems}>
      <div className="flex min-h-screen flex-col">
        <TopNavigation />
        <main className="flex-1">
          {children}
        </main>
      </div>
    </KBar>
  );
}
