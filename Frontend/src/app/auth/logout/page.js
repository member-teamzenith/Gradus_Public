"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/Firebase';

export default function LogoutPage() {
  const router = useRouter();

  console.log('[LogoutPage] Component mounted, starting logout process...');

  useEffect(() => {
    const performLogout = async () => {
      try {
        console.log('[LogoutPage] Starting automatic logout process...');
        
        // Sign out from Firebase
        await auth.signOut();
        console.log('[LogoutPage] Firebase logout successful');
        
        // Redirect to login page
        router.push('/homepage');
        
      } catch (error) {
        console.error('[LogoutPage] Logout error:', error);
        // Even if there's an error, redirect to login
        router.push('/homepage');
      }
    };

    // Trigger logout immediately when component mounts
    performLogout();
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400 mx-auto mb-4"></div>
        <h2 className="text-white text-xl font-semibold mb-2">Logging out...</h2>
        <p className="text-gray-400">Please wait while we sign you out.</p>
      </div>
    </div>
  );
}
