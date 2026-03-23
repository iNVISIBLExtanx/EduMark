'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTutorProfile } from '@/hooks/useTutorProfile';
import { useTutorSubjects } from '@/hooks/useTutorSubjects';
import { useAllSubjects } from '@/hooks/useAllSubjects';
import { useSubscription } from '@/hooks/useSubscription';
import { apiFetch } from '@/lib/api-client';
import { updateProfileSchema, type UpdateProfileInput } from '@/lib/validations/schemas';
import { LanguageBadge } from '@/components/shared/LanguageBadge';
import { SubjectBadge } from '@/components/shared/SubjectBadge';
import { PlanBadge } from '@/components/billing/PlanBadge';
import { AiMinutesBar } from '@/components/billing/AiMinutesBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SettingsView() {
  const { tutor, isLoading: tutorLoading, error: tutorError, mutate: mutateTutor } = useTutorProfile();
  const { subjects, isLoading: subjectsLoading, mutate: mutateSubjects } = useTutorSubjects();
  const { subjects: allSubjects, isLoading: allSubjectsLoading } = useAllSubjects();
  const { subscription, isFree, isLoading: subscriptionLoading } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
  });

  const selectedSubjects = watch('subject_ids');

  function startEditing() {
    reset({
      full_name: tutor?.full_name ?? '',
      marking_language: (tutor?.marking_language ?? 'english') as UpdateProfileInput['marking_language'],
      subject_ids: subjects.map((s) => s.subject_id),
    });
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  const toggleSubject = (id: string) => {
    const current = selectedSubjects ?? [];
    const next = current.includes(id)
      ? current.filter((s) => s !== id)
      : [...current, id];
    setValue('subject_ids', next, { shouldValidate: true });
  };

  const onSubmit = async (data: UpdateProfileInput) => {
    setSaving(true);
    setSaveError(null);
    try {
      await apiFetch('/api/tutor/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      await mutateTutor();
      await mutateSubjects();
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (tutorLoading || subjectsLoading || subscriptionLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (tutorError) {
    return <div className="p-6 text-red-600">{tutorError.message}</div>;
  }

  async function handlePortalRedirect() {
    setPortalLoading(true);
    try {
      const { url } = await apiFetch<{ url: string }>('/api/stripe/portal', {
        method: 'POST',
      });
      window.location.href = url;
    } catch {
      setPortalLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Profile</CardTitle>
            {!editing && (
              <Button variant="outline" size="sm" onClick={startEditing}>
                Edit Profile
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                {allSubjectsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading subjects...</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {allSubjects.map((subject) => (
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

              {saveError && (
                <p className="text-sm text-red-600">{saveError}</p>
              )}

              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button type="button" variant="outline" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{tutor?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{tutor?.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Marking Language</p>
                <div className="mt-1">
                  <LanguageBadge language={tutor?.marking_language ?? 'english'} />
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subjects</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <SubjectBadge key={s.subject_id} subject={s.subjects.name} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Billing
            <PlanBadge plan={subscription?.plan ?? 'free'} />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AiMinutesBar />
          <div className="flex items-center gap-3">
            <Button
              disabled={portalLoading}
              onClick={handlePortalRedirect}
            >
              {portalLoading ? 'Redirecting...' : 'Manage Billing'}
            </Button>
            {isFree && (
              <Link href="/pricing">
                <Button variant="outline">Upgrade Plan</Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
