'use client';

import { createBrowserClient } from '@/lib/supabase/client';

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6">
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
