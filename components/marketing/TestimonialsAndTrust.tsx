import Link from "next/link";
import { Shield, Zap, Globe, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  { value: "6", label: "A/L Subjects Supported", color: "text-indigo-400" },
  { value: "3", label: "Languages: Sinhala, Tamil, English", color: "text-amber-400" },
  { value: "50", label: "Papers Per Batch", color: "text-indigo-400" },
];

const trustSignals = [
  {
    icon: Shield,
    title: "Private & Secure",
    description: "All PDFs stored in encrypted private buckets",
  },
  {
    icon: Zap,
    title: "Claude AI",
    description: "Powered by Anthropic's latest model",
  },
  {
    icon: Globe,
    title: "Sri Lanka's A/L Curriculum",
    description: "Built specifically for local exam formats",
  },
  {
    icon: RefreshCw,
    title: "Tutor Control",
    description: "Review and override any AI mark before publishing",
  },
];

export default function TestimonialsAndTrust() {
  return (
    <section className="bg-slate-900 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Stats Banner */}
        <div className="mb-16 sm:mb-20">
          <div className="flex flex-col items-center justify-center gap-8 sm:flex-row sm:gap-0">
            {stats.map((stat, index) => (
              <div key={stat.label} className="flex items-center">
                <div className="text-center px-6 sm:px-12">
                  <div className={`text-5xl font-bold ${stat.color} sm:text-6xl`}>
                    {stat.value}
                  </div>
                  <div className="mt-2 text-sm text-slate-300 sm:text-base">
                    {stat.label}
                  </div>
                </div>
                {index < stats.length - 1 && (
                  <div className="hidden h-16 w-px bg-slate-700 sm:block" />
                )}
              </div>
            ))}
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

        {/* Sample Feedback Preview Card */}
        <div className="mb-16 sm:mb-20">
          <div className="mx-auto max-w-2xl">
            <Card className="border-l-4 border-l-indigo-500 border-slate-700 bg-slate-800/80">
              <CardHeader>
                <CardTitle className="text-base text-white sm:text-lg">
                  Sample AI Feedback — Combined Maths Question 3 (Part A)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Marks Row */}
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-green-400 sm:text-4xl">
                    22
                  </span>
                  <span className="text-xl text-slate-400 sm:text-2xl">
                    / 25
                  </span>
                </div>

                {/* Feedback Text */}
                <p className="text-sm leading-relaxed text-slate-300">
                  The student correctly identified the general solution of the
                  differential equation and applied the boundary condition
                  accurately. Minor error in the final simplification step —
                  missing the constant of integration in step 4.
                </p>

                {/* OCR Confidence Badge */}
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30">
                    <Check className="mr-1 size-3" />
                    OCR: High
                  </Badge>
                </div>

                {/* Note */}
                <p className="text-xs text-slate-500">
                  Feedback generated in Sinhala, Tamil, or English based on your
                  settings
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Banner */}
        <div className="rounded-2xl bg-indigo-950/80 px-6 py-10 text-center sm:px-12 sm:py-14">
          <h2 className="text-balance text-2xl font-bold text-white sm:text-3xl">
            Start Marking Smarter Today
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
            Already have an account?{" "}
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
