import Link from 'next/link';
import { Shield, Zap, Globe, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const trustSignals = [
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'All PDFs stored in encrypted private buckets — accessible only by you',
  },
  {
    icon: Zap,
    title: 'State-of-the-Art AI',
    description: 'Powered by the most advanced AI marking engine available',
  },
  {
    icon: Globe,
    title: "Sri Lanka's A/L Curriculum",
    description: 'Built specifically for local exam formats — not a generic tool adapted for Sri Lanka',
  },
  {
    icon: RefreshCw,
    title: 'Tutor Control',
    description: 'Review and override any AI mark before publishing to students',
  },
];

export default function TestimonialsAndTrust() {
  return (
    <section className="bg-slate-900 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

        {/* Language Scripts — visual proof of multilingual support */}
        <div className="mb-16 sm:mb-20">
          <p className="mb-8 text-center text-sm font-medium uppercase tracking-widest text-slate-400">
            Feedback in your language
          </p>
          <div className="flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-0">
            {/* Sinhala */}
            <div className="flex items-center">
              <div className="text-center px-8 sm:px-14">
                <div className="font-sinhala text-4xl font-bold text-indigo-400 sm:text-5xl">
                  සිංහල
                </div>
                <div className="mt-2 text-sm text-slate-300">Sinhala</div>
              </div>
              <div className="hidden h-16 w-px bg-slate-700 sm:block" />
            </div>

            {/* Tamil */}
            <div className="flex items-center">
              <div className="text-center px-8 sm:px-14">
                <div className="font-tamil text-4xl font-bold text-amber-400 sm:text-5xl">
                  தமிழ்
                </div>
                <div className="mt-2 text-sm text-slate-300">Tamil</div>
              </div>
              <div className="hidden h-16 w-px bg-slate-700 sm:block" />
            </div>

            {/* English */}
            <div className="text-center px-8 sm:px-14">
              <div className="text-4xl font-bold text-indigo-400 sm:text-5xl">
                English
              </div>
              <div className="mt-2 text-sm text-slate-300">English</div>
            </div>
          </div>
        </div>

        {/* Trust Signals Row */}
        <div className="mb-16 sm:mb-20">
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {trustSignals.map((signal) => (
              <div
                key={signal.title}
                className="flex min-w-[200px] flex-shrink-0 flex-col items-center gap-3 rounded-lg bg-slate-800/50 p-5 text-center sm:min-w-0"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-indigo-500/20">
                  <signal.icon className="size-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {signal.title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    {signal.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Banner */}
        <div className="rounded-2xl bg-indigo-950/80 px-6 py-10 text-center sm:px-12 sm:py-14">
          <h2 className="text-balance text-2xl font-bold text-white sm:text-3xl">
            Start Marking Your Combined Maths Batch Today
          </h2>
          <p className="mx-auto mt-3 max-w-md text-slate-300">
            Free plan includes 10 AI minutes — no credit card required.
          </p>
          <div className="mt-8">
            <Button
              size="lg"
              className="h-12 bg-amber-500 px-8 text-base font-semibold text-slate-900 hover:bg-amber-400"
              render={<Link href="/login" />}
            >
              Create Free Account
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="text-amber-400 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
