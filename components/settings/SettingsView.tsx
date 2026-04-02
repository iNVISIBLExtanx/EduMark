'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTutorProfile } from '@/hooks/useTutorProfile';
import { useTutorSubjects } from '@/hooks/useTutorSubjects';
import { useAllSubjects } from '@/hooks/useAllSubjects';
import { useSubscription } from '@/hooks/useSubscription';
import { apiFetch } from '@/lib/api-client';
import { updateProfileSchema, type UpdateProfileInput } from '@/lib/validations/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Progress,
  ProgressTrack,
  ProgressIndicator,
} from '@/components/ui/progress';
import {
  User,
  Mail,
  Languages,
  BookOpen,
  CreditCard,
  Zap,
  Pencil,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

const ALL_SUBJECTS = [
  'Combined Maths',
  'Physics',
  'Chemistry',
  'Biology',
  'Economics',
  'Business Studies',
];

const PLAN_BADGE_STYLES: Record<string, string> = {
  free: 'bg-slate-100 text-slate-700 border-slate-200',
  starter: 'bg-blue-100 text-blue-700 border-blue-200',
  standard: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  pro: 'bg-purple-100 text-purple-700 border-purple-200',
  institute: 'bg-amber-100 text-amber-700 border-amber-200',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface SettingsViewProps {
  profile?: {
    full_name: string;
    email: string;
    marking_language: 'sinhala' | 'tamil' | 'english';
    subjects: string[];
  };
  subscription?: {
    plan: string;
    ai_minutes_used: number;
    ai_minutes_limit: number;
    subscription_status: string;
    billing_period_end: string | null;
    stripe_customer_id: string | null;
  };
  onSaveProfile?: (data: { full_name: string; marking_language: string; subjects: string[] }) => Promise<void>;
  onManageBilling?: () => void;
  isSaving?: boolean;
}

export function SettingsView({
  profile: propProfile,
  subscription: propSubscription,
  onSaveProfile,
  onManageBilling,
  isSaving: propIsSaving,
}: SettingsViewProps) {
  const { tutor, isLoading: tutorLoading, error: tutorError, mutate: mutateTutor } = useTutorProfile();
  const { subjects: tutorSubjects, isLoading: subjectsLoading, mutate: mutateSubjects } = useTutorSubjects();
  const { subjects: allSubjectsData, isLoading: allSubjectsLoading } = useAllSubjects();
  const { subscription: hookSubscription, isPastDue, isFree, isLoading: subscriptionLoading } = useSubscription();

  const [portalLoading, setPortalLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Use props if provided, otherwise use hooks
  const profile = propProfile ?? (tutor ? {
    full_name: tutor.full_name ?? '',
    email: tutor.email ?? '',
    marking_language: (tutor.marking_language ?? 'english') as 'sinhala' | 'tamil' | 'english',
    subjects: tutorSubjects?.map((s) => s.subjects?.name).filter(Boolean) as string[] ?? [],
  } : null);

  const subscription = propSubscription ?? (hookSubscription ? {
    plan: hookSubscription.plan ?? 'free',
    ai_minutes_used: hookSubscription.ai_minutes_used ?? 0,
    ai_minutes_limit: hookSubscription.ai_minutes_limit ?? 0,
    subscription_status: hookSubscription.subscription_status ?? 'active',
    billing_period_end: hookSubscription.billing_period_end ?? null,
    stripe_customer_id: null,
  } : null);

  const isSaving = propIsSaving ?? saving;
  const isLoading = tutorLoading || subjectsLoading || subscriptionLoading;
  const isPastDueStatus = propSubscription ? propSubscription.subscription_status === 'past_due' : isPastDue;
  const isFreeUser = propSubscription ? propSubscription.plan === 'free' : isFree;

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
  });

  const selectedSubjectIds = watch('subject_ids') ?? [];

  function startEditing() {
    if (!profile) return;
    
    // Map subject names to IDs if we have allSubjectsData
    const subjectIds = allSubjectsData
      ? profile.subjects
          .map((name) => allSubjectsData.find((s) => s.name === name)?.id)
          .filter(Boolean) as string[]
      : [];
    
    reset({
      full_name: profile.full_name,
      marking_language: profile.marking_language,
      subject_ids: subjectIds,
    });
    setSaveError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
  }

  const toggleSubject = (id: string, checked: boolean) => {
    const current = selectedSubjectIds;
    const next = checked
      ? [...current, id]
      : current.filter((s) => s !== id);
    setValue('subject_ids', next, { shouldValidate: true });
  };

  const onSubmit = async (data: UpdateProfileInput) => {
    setSaving(true);
    setSaveError(null);
    try {
      if (onSaveProfile) {
        const subjectNames = allSubjectsData
          ? data.subject_ids
              .map((id) => allSubjectsData.find((s) => s.id === id)?.name)
              .filter(Boolean) as string[]
          : [];
        await onSaveProfile({
          full_name: data.full_name,
          marking_language: data.marking_language,
          subjects: subjectNames,
        });
      } else {
        await apiFetch('/api/tutor/profile', {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
        await mutateTutor();
        await mutateSubjects();
      }
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  async function handleManageBilling() {
    if (onManageBilling) {
      onManageBilling();
      return;
    }
    
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

  if (isLoading && !propProfile) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (tutorError && !propProfile) {
    return <div className="p-6 text-red-600">{tutorError.message}</div>;
  }

  if (!profile || !subscription) {
    return <div className="p-6 text-slate-500">Unable to load settings.</div>;
  }

  const usagePercent = subscription.ai_minutes_limit > 0
    ? (subscription.ai_minutes_used / subscription.ai_minutes_limit) * 100
    : 0;
  const minutesRemaining = Math.max(0, subscription.ai_minutes_limit - subscription.ai_minutes_used);

  const progressColorClass =
    usagePercent > 90 ? 'bg-red-500' :
    usagePercent > 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Settings</h1>

      {/* Two-column layout on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN - Profile Card */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <User className="text-indigo-700" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                {/* Avatar in edit mode */}
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex size-16 items-center justify-center rounded-full bg-indigo-700 text-white text-xl font-semibold">
                    {getInitials(profile.full_name)}
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Editing profile</p>
                  </div>
                </div>

                {/* Full Name */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="full_name" className="text-slate-700">Full Name</Label>
                  <Input
                    id="full_name"
                    {...register('full_name')}
                    placeholder="Enter your full name"
                    aria-invalid={!!errors.full_name}
                  />
                  {errors.full_name && (
                    <p className="text-sm text-red-600">{errors.full_name.message}</p>
                  )}
                </div>

                {/* Marking Language */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="marking_language" className="text-slate-700">Marking Language</Label>
                  <Controller
                    name="marking_language"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="sinhala">සිංහල (Sinhala)</SelectItem>
                            <SelectItem value="tamil">தமிழ் (Tamil)</SelectItem>
                            <SelectItem value="english">English</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-slate-500">
                    This affects how AI generates feedback for all your batches.
                  </p>
                </div>

                {/* Subjects Multi-checkbox */}
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-700">Subjects You Teach</Label>
                  {allSubjectsLoading ? (
                    <p className="text-sm text-slate-500">Loading subjects...</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(allSubjectsData ?? ALL_SUBJECTS.map((name, i) => ({ id: String(i), name }))).map((subject) => (
                        <label
                          key={subject.id}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedSubjectIds.includes(subject.id)}
                            onCheckedChange={(checked) => toggleSubject(subject.id, !!checked)}
                          />
                          <span className="text-sm text-slate-700">{subject.name}</span>
                        </label>
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

                <div className="flex gap-3 mt-2">
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="bg-indigo-700 hover:bg-indigo-800"
                  >
                    {isSaving && <Loader2 className="animate-spin" data-icon="inline-start" />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEditing} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Avatar with initials */}
                <div className="flex items-center gap-4">
                  <div className="flex size-16 items-center justify-center rounded-full bg-indigo-700 text-white text-xl font-semibold">
                    {getInitials(profile.full_name)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{profile.full_name}</p>
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Mail className="size-3.5" />
                      {profile.email}
                    </p>
                  </div>
                </div>

                {/* Marking Language */}
                <div className="flex items-center gap-2 text-sm">
                  <Languages className="size-4 text-slate-400" />
                  <span className="text-slate-600">Marking Language:</span>
                  <Badge variant="secondary" className="capitalize">
                    {profile.marking_language === 'sinhala' ? 'සිංහල' :
                     profile.marking_language === 'tamil' ? 'தமிழ்' : 'English'}
                  </Badge>
                </div>

                {/* Edit Profile Button */}
                <Button variant="outline" size="sm" onClick={startEditing} className="w-fit">
                  <Pencil data-icon="inline-start" />
                  Edit Profile
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT COLUMN - Billing Card */}
        <Card className="bg-white border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <CreditCard className="text-indigo-700" />
              Subscription & Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* Current Plan Badge */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Current Plan:</span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border ${PLAN_BADGE_STYLES[subscription.plan] ?? PLAN_BADGE_STYLES.free}`}
              >
                {subscription.plan}
              </span>
            </div>

            {/* AI Minutes Bar */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Zap className="size-4 text-amber-500" />
                  AI Minutes
                </span>
                <span className="text-slate-700 font-medium">
                  {minutesRemaining} / {subscription.ai_minutes_limit} remaining
                </span>
              </div>
              <Progress value={usagePercent}>
                <ProgressTrack className="h-2 bg-slate-100">
                  <ProgressIndicator className={progressColorClass} />
                </ProgressTrack>
              </Progress>
            </div>

            {/* Renewal Date */}
            {subscription.billing_period_end && (
              <p className="text-sm text-slate-500">
                Renewal date: {formatDate(subscription.billing_period_end)}
              </p>
            )}

            {/* Past Due Warning */}
            {isPastDueStatus && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800">Payment failed</p>
                  <p className="text-xs text-red-600">
                    Click Manage Billing to update your payment method.
                  </p>
                </div>
              </div>
            )}

            {/* Free Plan Upgrade Nudge */}
            {isFreeUser && !isPastDueStatus && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <Zap className="size-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-amber-800">
                    Upgrade to mark more papers each month.
                  </p>
                  <Link href="/pricing">
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white w-fit">
                      View Plans
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Manage Billing Button */}
            <Button
              variant="outline"
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="w-fit border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {portalLoading && <Loader2 className="animate-spin" data-icon="inline-start" />}
              {portalLoading ? 'Redirecting...' : 'Manage Billing'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* BOTTOM SECTION - Registered Subjects */}
      <Card className="mt-6 bg-white border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-slate-900">
            <BookOpen className="text-indigo-700" />
            Your Subjects
          </CardTitle>
          <CardDescription>
            Subjects you&apos;re registered to teach and mark
          </CardDescription>
        </CardHeader>
        <CardContent>
          {profile.subjects.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {profile.subjects.map((subject) => (
                <Badge
                  key={subject}
                  variant="outline"
                  className="border-indigo-200 text-indigo-700 bg-indigo-50/50"
                >
                  {subject}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No subjects selected. Edit your profile to add subjects.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
