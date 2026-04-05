import Link from "next/link";
import {
  GraduationCap,
  FileUp,
  Users,
  FileCheck,
  Languages,
  Layers,
  PenLine,
  FileText,
  Calculator,
  Shield,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import TestimonialsAndTrust from "@/components/marketing/TestimonialsAndTrust";
import LanguageShowcase from "@/components/marketing/LanguageShowcase";
import SubjectSpotlight from "@/components/marketing/SubjectSpotlight";

const steps = [
  {
    icon: FileUp,
    title: "Upload Question Paper & Marking Scheme",
    description:
      "Upload the question paper PDF and your marking scheme. The AI reads and understands the full marking criteria — including Part A and Part B structures.",
  },
  {
    icon: Users,
    title: "Bulk Upload Student Papers",
    description:
      "Drag and drop up to 50 student answer sheets at once. Supports handwritten PDFs and adjusts for varying OCR quality automatically.",
  },
  {
    icon: FileCheck,
    title: "Review & Download Reports",
    description:
      "The AI marks each paper, gives per-question feedback in your chosen language, and generates a downloadable PDF report per student.",
  },
];

const features = [
  {
    icon: Languages,
    title: "AI Marks in Your Language",
    description:
      "Students get feedback in the language they studied in — Sinhala, Tamil, or English. No manual translation needed.",
  },
  {
    icon: Layers,
    title: "Batch Processing",
    description:
      "Upload 50 papers at once. Come back in 20 minutes to 50 fully marked reports with per-question breakdowns.",
  },
  {
    icon: PenLine,
    title: "Tutor Override",
    description:
      "You stay in control. Review every mark, edit any feedback, then approve before releasing to students.",
  },
  {
    icon: FileText,
    title: "PDF Reports",
    description:
      "One PDF per student with question-by-question marks, detailed feedback, and OCR confidence scores.",
  },
  {
    icon: Calculator,
    title: "Combined Maths Ready",
    description:
      "Correctly handles Part A (all 10), Part B Best-5 selection, and Pure vs Applied paper differences automatically.",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description:
      "Student papers never leave secure private storage. Each tutor can only access their own files.",
  },
];

const plans = [
  {
    name: "Free",
    minutes: 10,
    price: 0,
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Starter",
    minutes: 50,
    price: 2490,
    cta: "Subscribe",
    popular: false,
  },
  {
    name: "Standard",
    minutes: 150,
    price: 5490,
    cta: "Subscribe",
    popular: true,
  },
  {
    name: "Pro",
    minutes: 350,
    price: 10990,
    cta: "Subscribe",
    popular: false,
  },
  {
    name: "Institute",
    minutes: 750,
    price: 21990,
    cta: "Subscribe",
    popular: false,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/60 transition-shadow [&:has(+*:not(:first-child))]:shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <GraduationCap className="size-7 text-primary" />
            <span className="text-lg font-semibold text-foreground">
              EduMark AI
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              href="#subjects"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Subjects
            </Link>
            <Link
              href="#features"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              How It Works
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link href="/login" />}>
              Sign In
            </Button>
            <Button size="sm" render={<Link href="/login" />}>
              Start Free
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section — split layout, single viewport */}
        <section className="relative overflow-hidden py-14 sm:py-20 lg:py-24">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgb(55 48 163 / 0.07) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

              {/* Left — copy + CTAs */}
              <div>
                <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                  The Only AI Marking Tool Built for Sri Lanka&apos;s A/L Curriculum
                </h1>
                <p className="mt-5 text-pretty text-lg text-muted-foreground">
                  Upload student answer sheets. Our advanced AI marks them
                  against your marking scheme and returns detailed per-question
                  feedback — in Sinhala, Tamil, or English.
                </p>

                {/* Language pills */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-3 py-1 font-sinhala text-sm font-medium text-foreground">
                    සිංහල
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-3 py-1 font-tamil text-sm font-medium text-foreground">
                    தமிழ்
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-sm font-medium text-foreground">
                    English
                  </span>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    className="h-12 px-8 text-base"
                    render={<Link href="/login" />}
                  >
                    Get Started Free
                  </Button>
                  <Button
                    variant="ghost"
                    size="lg"
                    className="h-12 px-8 text-base"
                    render={<Link href="#subjects" />}
                  >
                    See Subjects
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                </div>
              </div>

              {/* Right — mock marking result output card */}
              <div className="rounded-xl border border-primary/20 bg-card p-6 shadow-lg">
                {/* Card header */}
                <div className="mb-4 flex items-center justify-between gap-4 border-b border-border/60 pb-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      AI Marking Result
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">
                      Combined Maths · Part A · Question 5
                    </p>
                  </div>
                  <div className="flex items-baseline gap-1 shrink-0">
                    <span className="text-3xl font-bold text-green-600">22</span>
                    <span className="text-base text-muted-foreground">/ 25</span>
                  </div>
                </div>

                {/* Feedback text */}
                <p className="text-sm leading-relaxed text-foreground">
                  The student correctly identified the general solution and
                  applied the boundary condition accurately. The constant of
                  integration was omitted in step 4, leading to a minor
                  simplification error.
                </p>

                {/* Sub-questions row */}
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { label: "(a)(i)",  awarded: 8, max: 10 },
                    { label: "(a)(ii)", awarded: 7, max: 8  },
                    { label: "(b)",     awarded: 7, max: 7  },
                  ].map((q) => (
                    <div
                      key={q.label}
                      className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-center"
                    >
                      <p className="font-mono text-xs text-muted-foreground">
                        {q.label}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-foreground">
                        {q.awarded}/{q.max}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Badges */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge className="gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                    <Check className="size-3" />
                    OCR: High
                  </Badge>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    Feedback in Sinhala · Tamil · English
                  </Badge>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Language Showcase — dedicated section */}
        <LanguageShowcase />

        {/* Subject Spotlight — replaces the old badge strip */}
        <SubjectSpotlight />

        {/* How It Works */}
        <section id="how-it-works" className="bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                From Papers to Reports in 3 Steps
              </h2>
            </div>
            <div className="relative mx-auto mt-12 max-w-4xl sm:mt-16">
              {/* Connector line — Desktop only */}
              <div className="absolute left-1/2 top-14 hidden h-px w-[calc(100%-8rem)] -translate-x-1/2 border-t-2 border-dashed border-border lg:block" />

              <div className="grid gap-8 lg:grid-cols-3 lg:gap-12">
                {steps.map((step, index) => (
                  <div
                    key={step.title}
                    className="relative flex flex-col items-center text-center"
                  >
                    <div className="relative z-10 mb-4 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <step.icon className="size-7" />
                      <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                        {index + 1}
                      </span>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything You Need to Mark Smarter
              </h2>
              <p className="mt-4 text-muted-foreground">
                Designed around how Sri Lanka A/L tutors actually work.
              </p>
            </div>
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="border-border/40">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10">
                      <feature.icon className="size-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="-mt-2">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials and Trust Section */}
        <TestimonialsAndTrust />

        {/* Pricing Section */}
        <section id="pricing" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Simple, Minute-Based Pricing
              </h2>
              <p className="mt-4 text-muted-foreground">
                1 AI minute &asymp; 1 student paper, depending on paper length,
                answer script size, and marking scheme complexity. Top up anytime.
              </p>
            </div>

            {/* Pricing Cards — Horizontal scroll on mobile */}
            <div className="mt-12 sm:mt-16">
              <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
                {plans.map((plan) => (
                  <Card
                    key={plan.name}
                    className={`min-w-[220px] flex-shrink-0 sm:min-w-0 ${
                      plan.popular
                        ? "border-accent ring-2 ring-accent/20"
                        : "border-border/40"
                    }`}
                  >
                    <CardHeader className="text-center">
                      {plan.popular && (
                        <div className="mb-1 flex justify-center">
                          <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                            Most Popular
                          </Badge>
                        </div>
                      )}
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>
                        {plan.minutes} AI min/mo
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="mb-4">
                        <span className="text-3xl font-bold text-foreground">
                          LKR {plan.price.toLocaleString()}
                        </span>
                        {plan.price > 0 && (
                          <span className="text-sm text-muted-foreground">
                            /mo
                          </span>
                        )}
                      </div>
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        render={<Link href="/login" />}
                      >
                        {plan.cta}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              All features included on every plan.
            </p>
            <p className="mt-2 text-center text-sm text-accent">
              Need more? Add 10 AI minutes for LKR 990 anytime.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/30 py-10 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <Link href="/" className="flex items-center gap-2">
                <GraduationCap className="size-6 text-primary" />
                <span className="text-base font-semibold text-foreground">
                  EduMark AI
                </span>
              </Link>
              <p className="text-sm text-muted-foreground">
                AI-powered marking for Sri Lanka&apos;s A/L tutors
              </p>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              {/* Footer links hidden for now */}
            </nav>
          </div>
          <div className="mt-8 border-t border-border/40 pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Built for Sri Lanka&apos;s A/L tutors
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              &copy; 2026 EduMark AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
