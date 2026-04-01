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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const subjects = [
  "Combined Maths",
  "Physics",
  "Chemistry",
  "Biology",
  "Economics",
  "Business Studies",
];

const steps = [
  {
    icon: FileUp,
    title: "Upload Question Paper & Marking Scheme",
    description:
      "Upload the question paper PDF and your marking scheme. EduMark AI reads and understands the full marking criteria.",
  },
  {
    icon: Users,
    title: "Bulk Upload Student Papers",
    description:
      "Drag and drop up to 50 student answer sheets at once. Supports handwritten PDFs in any condition.",
  },
  {
    icon: FileCheck,
    title: "Review & Download Reports",
    description:
      "AI marks each paper, gives per-question feedback in your language, and generates a downloadable PDF report per student.",
  },
];

const features = [
  {
    icon: Languages,
    title: "AI Marks in Your Language",
    description: "Feedback in Sinhala, Tamil, or English",
  },
  {
    icon: Layers,
    title: "Batch Processing",
    description: "Mark up to 50 papers simultaneously with Claude Batch API",
  },
  {
    icon: PenLine,
    title: "Tutor Override",
    description: "Edit any AI mark or feedback before approving",
  },
  {
    icon: FileText,
    title: "PDF Reports",
    description: "Downloadable per-student marking reports",
  },
  {
    icon: Calculator,
    title: "Combined Maths Ready",
    description: "Handles Part A (10 questions) and Part B (Best-5-of-7) structure",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "All papers stored in private encrypted storage",
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
        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 sm:py-24 lg:py-32">
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 -z-10"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgb(55 48 163 / 0.08) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Mark A/L Papers in Minutes, Not Hours
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground sm:text-xl">
                Upload student answer sheets. Claude AI marks them against your
                marking scheme and returns detailed per-question feedback — in
                Sinhala, Tamil, or English.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
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
                  render={<Link href="#how-it-works" />}
                >
                  See How It Works
                  <ArrowRight className="ml-2 size-4" />
                </Button>
              </div>
            </div>

            {/* Hero Visual */}
            <div className="mx-auto mt-16 max-w-2xl">
              <div className="rounded-xl border border-primary/20 bg-card p-6 shadow-lg sm:p-8">
                <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
                  {/* PDF Upload */}
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex size-14 items-center justify-center rounded-lg bg-muted">
                      <FileUp className="size-7 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      Upload PDF
                    </span>
                  </div>

                  {/* Connector Line - Hidden on mobile */}
                  <div className="hidden h-px w-12 bg-border sm:block" />

                  {/* AI Processing */}
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex size-14 items-center justify-center rounded-lg bg-primary/10">
                      <div className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5">
                        <div className="size-2 animate-pulse rounded-full bg-primary-foreground" />
                        <span className="text-xs font-medium text-primary-foreground">
                          AI Marking...
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      Processing
                    </span>
                  </div>

                  {/* Connector Line - Hidden on mobile */}
                  <div className="hidden h-px w-12 bg-border sm:block" />

                  {/* Marked Complete */}
                  <div className="flex flex-col items-center gap-2 text-center">
                    <div className="flex size-14 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/30">
                      <div className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5">
                        <Check className="size-3 text-white" />
                        <span className="text-xs font-medium text-white">
                          Marked
                        </span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      Complete
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Subject Badges Strip */}
        <section className="border-y border-border/40 bg-muted/30 py-10 sm:py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <p className="mb-4 text-center text-sm font-medium text-muted-foreground">
              Supports all 6 A/L subjects
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {subjects.map((subject) => (
                <Badge key={subject} variant="outline" className="px-3 py-1.5 text-sm">
                  {subject}
                </Badge>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Sinhala • Tamil • English
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                From Papers to Reports in 3 Steps
              </h2>
            </div>
            <div className="relative mx-auto mt-12 max-w-4xl sm:mt-16">
              {/* Connector line - Desktop only */}
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
        <section id="features" className="bg-muted/30 py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything You Need to Mark Smarter
              </h2>
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

        {/* Pricing Section */}
        <section id="pricing" className="py-16 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Simple, Minute-Based Pricing
              </h2>
              <p className="mt-4 text-muted-foreground">
                1 AI Minute = 1 student paper marked. Top up anytime.
              </p>
            </div>

            {/* Pricing Cards - Horizontal scroll on mobile */}
            <div className="mt-12 sm:mt-16">
              <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5">
                {plans.map((plan) => (
                  <Card
                    key={plan.name}
                    className={`relative min-w-[220px] flex-shrink-0 sm:min-w-0 ${
                      plan.popular
                        ? "border-accent ring-2 ring-accent/20"
                        : "border-border/40"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-accent text-accent-foreground hover:bg-accent">
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center">
                      <CardTitle>{plan.name}</CardTitle>
                      <CardDescription>
                        {plan.minutes} min/mo
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
              Need more? Add 10 minutes for LKR 990 anytime.
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
                AI-powered marking for Sri Lankan educators
              </p>
            </div>
            <nav className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms
              </Link>
              <Link
                href="/contact"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Contact
              </Link>
            </nav>
          </div>
          <div className="mt-8 border-t border-border/40 pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Built for Sri Lanka&apos;s A/L tutors
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              © 2026 EduMark AI
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
