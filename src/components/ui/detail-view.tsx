'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { IconArrowLeft, IconEdit, IconTrash } from '@tabler/icons-react';
import Link from 'next/link';
import { ReactNode } from 'react';

interface DetailViewProps {
  title: string;
  description?: string;
  backUrl: string;
  editUrl?: string;
  onDelete?: () => void;
  isLoading?: boolean;
  children: ReactNode;
}

export function DetailView({
  title,
  description,
  backUrl,
  editUrl,
  onDelete,
  isLoading,
  children
}: DetailViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="h-6 w-6 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex space-x-2">
            <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-9 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-96 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href={backUrl}>
            <Button variant="outline" size="sm">
              <IconArrowLeft className="h-4 w-4 mr-2" />
              Tillbaka
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && (
              <p className="text-muted-foreground">{description}</p>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2">
          {editUrl && (
            <Link href={editUrl}>
              <Button variant="outline" size="sm">
                <IconEdit className="h-4 w-4 mr-2" />
                Redigera
              </Button>
            </Link>
          )}
          {onDelete && (
            <Button variant="destructive" size="sm" onClick={onDelete}>
              <IconTrash className="h-4 w-4 mr-2" />
              Ta bort
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Content */}
      <div className="grid gap-6">
        {children}
      </div>
    </div>
  );
}

interface DetailSectionProps {
  title: string;
  children: ReactNode;
}

export function DetailSection({ title, children }: DetailSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

interface DetailFieldProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function DetailField({ label, value, className }: DetailFieldProps) {
  return (
    <div className={`grid grid-cols-3 gap-4 py-2 ${className}`}>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm col-span-2">{value || '-'}</dd>
    </div>
  );
} 