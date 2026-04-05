'use client';

import { createBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function LoginForm() {
  const handleGoogleLogin = async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-6">
      <Link href="/" className="absolute top-6 left-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <h1 className="text-3xl font-bold">EduMark AI</h1>
      <p className="text-gray-600">Sign in to start marking papers</p>
      <button
        onClick={handleGoogleLogin}
        className="rounded-lg bg-black px-6 py-3 text-white hover:bg-gray-800"
      >
        Sign in with Google
      </button>
    </main>
  );
}
