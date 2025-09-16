import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SignUp as ClerkSignUpForm } from '@clerk/nextjs';
import { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Authentication',
  description: 'Authentication forms built using the components.'
};

export default function SignUpViewPage() {
  return (
    <div className='relative h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0'>
      {/* Mobile background image */}
      <div 
        className='absolute inset-0 bg-cover bg-center bg-no-repeat lg:hidden'
        style={{ backgroundImage: "url('/images/opportune-bg.svg')" }}
      />
      <div className='absolute inset-0 bg-black/20 lg:hidden' />
      <Link
        href='/examples/authentication'
        className={cn(
          buttonVariants({ variant: 'ghost' }),
          'absolute top-4 right-4 hidden md:top-8 md:right-8'
        )}
      >
        Sign Up
      </Link>
      <div className='bg-muted relative hidden h-full flex-col  text-white lg:flex dark:border-r'>
        <div 
          className='absolute inset-0 bg-cover bg-center bg-no-repeat' 
          style={{
            backgroundImage: "url('/images/opportune-bg.svg')"
          }}
        />
        <div className='absolute inset-0 bg-black/20' />
        <div className='relative z-20 flex items-center text-lg font-medium'>
          <Image src='/images/opportune-logo.svg' alt='Opportune Logo' width={160} height={160} className='size-40 filter invert'/>
          
        </div>
      
      </div>
      <div className='relative z-10 flex h-full items-center justify-center p-4 lg:p-8'>
        <div className='flex w-full max-w-md flex-col items-center justify-center space-y-6'>
         
          <ClerkSignUpForm
            initialValues={{
              emailAddress: 'your_mail+clerk_test@example.com'
            }}
          />
         
        </div>
      </div>
    </div>
  );
}
