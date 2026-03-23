'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import useSWR from 'swr';
import { onboardingSchema, type OnboardingInput } from '@/lib/validations/schemas';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Subject {
  id: string;
  name: string;
  code: string;
}

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { data: subjects, isLoading: subjectsLoading } = useSWR<Subject[]>('/api/subjects');

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
      marking_language: 'english',
      subject_ids: [],
    },
  });

  const selectedSubjects = watch('subject_ids');

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

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
          <p className="text-sm text-muted-foreground">
            Set up your tutor profile to start marking papers.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input id="full_name" {...register('full_name')} />
              {errors.full_name && (
                <p className="text-sm text-red-600">{errors.full_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="marking_language">Marking Language</Label>
              <select
                id="marking_language"
                {...register('marking_language')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="sinhala">සිංහල (Sinhala)</option>
                <option value="tamil">தமிழ் (Tamil)</option>
                <option value="english">English</option>
              </select>
              <p className="text-xs text-muted-foreground">
                AI feedback will be generated in this language for all your papers.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Subjects You Teach</Label>
              {subjectsLoading ? (
                <p className="text-sm text-muted-foreground">Loading subjects...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {subjects?.map((subject) => (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => toggleSubject(subject.id)}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                        selectedSubjects?.includes(subject.id)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input hover:bg-accent'
                      }`}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>
              )}
              {errors.subject_ids && (
                <p className="text-sm text-red-600">Select at least one subject.</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Setting up...' : 'Get Started'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
