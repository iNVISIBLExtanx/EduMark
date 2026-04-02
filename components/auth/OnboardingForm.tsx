'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { onboardingSchema, type OnboardingInput } from '@/lib/validations/schemas';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  GraduationCap,
  Calculator,
  Atom,
  FlaskConical,
  Leaf,
  TrendingUp,
  Briefcase,
  Check,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SUBJECTS = [
  { id: 'combined-maths', name: 'Combined Maths', icon: Calculator, comingSoon: false },
  { id: 'physics', name: 'Physics', icon: Atom, comingSoon: true },
  { id: 'chemistry', name: 'Chemistry', icon: FlaskConical, comingSoon: true },
  { id: 'biology', name: 'Biology', icon: Leaf, comingSoon: true },
  { id: 'economics', name: 'Economics', icon: TrendingUp, comingSoon: true },
  { id: 'business-studies', name: 'Business Studies', icon: Briefcase, comingSoon: true },
] as const;

const LANGUAGES = [
  {
    value: 'sinhala' as const,
    label: 'සිංහල',
    flag: '🇱🇰',
    description: 'AI feedback in Sinhala script',
  },
  {
    value: 'tamil' as const,
    label: 'தமிழ்',
    flag: '🇱🇰',
    description: 'AI feedback in Tamil script',
  },
  {
    value: 'english' as const,
    label: 'English',
    flag: '🌐',
    description: 'AI feedback in English',
  },
] as const;

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      full_name: defaultName ?? '',
      marking_language: undefined,
      subject_ids: ['combined-maths'],
    },
  });

  const selectedLanguage = watch('marking_language');
  const selectedSubjects = watch('subject_ids');
  const fullName = watch('full_name');

  const toggleSubject = (id: string) => {
    const current = selectedSubjects ?? [];
    const next = current.includes(id)
      ? current.filter((s) => s !== id)
      : [...current, id];
    setValue('subject_ids', next, { shouldValidate: true });
  };

  const onSubmit = async (data: OnboardingInput) => {
    setSubmitting(true);
    try {
      await apiFetch('/api/tutor/profile', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      router.push('/dashboard');
    } catch {
      setSubmitting(false);
    }
  };

  const isFormValid =
    fullName?.trim() &&
    selectedLanguage &&
    selectedSubjects &&
    selectedSubjects.length > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-50 p-4">
      <Card className="w-full max-w-lg border-0 shadow-lg">
        <CardHeader className="space-y-4 text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-700 text-white">
              <GraduationCap className="size-6" />
            </div>
            <span className="text-xl font-bold text-indigo-700">EduMark AI</span>
          </div>

          {/* Progress indicator */}
          <p className="text-sm font-medium text-amber-600">Almost there!</p>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Set Up Your Account
            </h1>
            <p className="text-balance text-sm text-muted-foreground">
              Tell us about yourself so EduMark AI can personalise your marking
              experience.
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
            {/* Field 1: Full Name */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="full_name">Your full name</Label>
              <Input
                id="full_name"
                placeholder="e.g. Mr. K. Perera"
                {...register('full_name')}
                className="h-10"
              />
              {errors.full_name && (
                <p className="text-sm text-destructive">
                  {errors.full_name.message}
                </p>
              )}
            </div>

            {/* Field 2: Marking Language */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label>Which language do you teach in?</Label>
                <p className="text-xs text-muted-foreground">
                  AI feedback will be generated in this language for all your
                  batches. This can be changed later in Settings.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {LANGUAGES.map((lang) => {
                  const isSelected = selectedLanguage === lang.value;
                  return (
                    <button
                      key={lang.value}
                      type="button"
                      onClick={() =>
                        setValue('marking_language', lang.value, {
                          shouldValidate: true,
                        })
                      }
                      className={cn(
                        'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all',
                        isSelected
                          ? 'border-indigo-700 bg-indigo-50'
                          : 'border-border hover:border-indigo-300 hover:bg-stone-100'
                      )}
                    >
                      <span className="text-2xl">{lang.flag}</span>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {lang.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {lang.description}
                        </span>
                      </div>
                      {isSelected && (
                        <Check className="ml-auto size-5 text-indigo-700" />
                      )}
                    </button>
                  );
                })}
              </div>

              {errors.marking_language && (
                <p className="text-sm text-destructive">
                  Please select a language.
                </p>
              )}
            </div>

            {/* Field 3: Subjects */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label>Which subjects do you teach?</Label>
                <p className="text-xs text-muted-foreground">
                  Select all that apply. You can add more later.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {SUBJECTS.map((subject) => {
                  const Icon = subject.icon;
                  const isSelected = selectedSubjects?.includes(subject.id);
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={subject.comingSoon ? undefined : () => toggleSubject(subject.id)}
                      disabled={subject.comingSoon}
                      className={cn(
                        'relative flex items-center gap-2 rounded-lg border-2 p-3 text-left transition-all',
                        subject.comingSoon
                          ? 'border-border bg-muted/40 cursor-not-allowed opacity-60'
                          : isSelected
                            ? 'border-indigo-700 bg-indigo-50'
                            : 'border-border hover:border-indigo-300 hover:bg-stone-100'
                      )}
                    >
                      <Icon
                        className={cn(
                          'size-5',
                          subject.comingSoon ? 'text-muted-foreground' : isSelected ? 'text-indigo-700' : 'text-muted-foreground'
                        )}
                      />
                      <span
                        className={cn(
                          'text-sm font-medium',
                          subject.comingSoon ? 'text-muted-foreground' : isSelected ? 'text-indigo-700' : 'text-foreground'
                        )}
                      >
                        {subject.name}
                      </span>
                      {subject.comingSoon ? (
                        <span className="absolute right-2 top-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Soon
                        </span>
                      ) : isSelected ? (
                        <div className="absolute right-2 top-2 flex size-4 items-center justify-center rounded-full bg-indigo-700 text-white">
                          <Check className="size-3" />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {errors.subject_ids && (
                <p className="text-sm text-destructive">
                  Select at least one subject.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              disabled={!isFormValid || submitting}
              className="mt-2 h-12 w-full bg-indigo-700 text-base font-medium hover:bg-indigo-800"
            >
              {submitting ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  Complete Setup
                  <ArrowRight data-icon="inline-end" />
                </>
              )}
            </Button>

            {/* Footer Note */}
            <p className="text-center text-xs text-slate-500">
              By continuing you agree to our{' '}
              <a href="/terms" className="underline hover:text-slate-700">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" className="underline hover:text-slate-700">
                Privacy Policy
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
