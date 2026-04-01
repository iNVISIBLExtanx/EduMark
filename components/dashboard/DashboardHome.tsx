'use client';

import Link from 'next/link';
import {
  Zap,
  Layers,
  FileCheck,
  FileUp,
  Plus,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DashboardHomeProps {
  tutorName: string;
  subscription: {
    plan: 'free' | 'starter' | 'standard' | 'pro' | 'institute';
    ai_minutes_used: number;
    ai_minutes_limit: number;
    subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing';
    billing_period_end: string | null;
  };
  recentBatches: Array<{
    id: string;
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    total_papers: number;
    marked_papers: number;
    created_at: string;
    subject_name: string | null;
  }>;
  isLoading: boolean;
  onUpgradeClick?: () => void;
  onCreateBatch?: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getPlanBadgeStyle(plan: DashboardHomeProps['subscription']['plan']) {
  switch (plan) {
    case 'free':
      return 'bg-slate-100 text-slate-700';
    case 'starter':
      return 'bg-blue-100 text-blue-700';
    case 'standard':
      return 'bg-indigo-100 text-indigo-700';
    case 'pro':
      return 'bg-purple-100 text-purple-700';
    case 'institute':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function getStatusBadge(status: 'pending' | 'processing' | 'completed' | 'failed') {
  switch (status) {
    case 'pending':
      return (
        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
          Pending
        </Badge>
      );
    case 'processing':
      return (
        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
          <Loader2 data-icon="inline-start" className="animate-spin" />
          Processing
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="secondary" className="bg-green-100 text-green-700">
          Completed
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="secondary" className="bg-red-100 text-red-700">
          Failed
        </Badge>
      );
    default:
      return null;
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DashboardHome({
  tutorName,
  subscription,
  recentBatches,
  isLoading,
  onUpgradeClick,
  onCreateBatch,
}: DashboardHomeProps) {
  const aiMinutesRemaining = subscription.ai_minutes_limit - subscription.ai_minutes_used;
  const minutesPercentage = (aiMinutesRemaining / subscription.ai_minutes_limit) * 100;
  const totalPapersMarked = recentBatches.reduce((sum, b) => sum + b.marked_papers, 0);
  const batchCount = recentBatches.length;

  const getProgressColor = () => {
    if (minutesPercentage > 50) return 'bg-green-500';
    if (minutesPercentage > 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const showUpgradeNudge = subscription.plan === 'free' && aiMinutesRemaining < 5;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 bg-slate-50 min-h-screen">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50 min-h-screen">
      {/* Past Due Banner */}
      {subscription.subscription_status === 'past_due' && (
        <div className="flex items-center justify-between gap-4 rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-600" />
            <p className="text-red-800 font-medium">
              Payment failed — update your billing to continue marking papers.
            </p>
          </div>
          <Button variant="destructive" render={<Link href="/settings" />}>
            Update Billing
          </Button>
        </div>
      )}

      {/* Greeting Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900">
            {getGreeting()}, {tutorName}
          </h1>
          <Badge
            variant="secondary"
            className={getPlanBadgeStyle(subscription.plan)}
          >
            {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
          </Badge>
        </div>
        <p className="text-slate-600">Here&apos;s your marking overview</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* AI Minutes Remaining */}
        <Card className="bg-white border-slate-100">
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Zap className="text-indigo-600" />
              <span className="text-sm font-medium">AI Minutes Remaining</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{aiMinutesRemaining}</p>
            <div className="flex flex-col gap-1">
              <Progress
                value={minutesPercentage}
                className="h-2"
                style={
                  {
                    '--progress-background': getProgressColor(),
                  } as React.CSSProperties
                }
              />
              <p className="text-xs text-slate-500">
                of {subscription.ai_minutes_limit} this month
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Batches This Month */}
        <Card className="bg-white border-slate-100">
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2 text-slate-600">
              <Layers className="text-indigo-600" />
              <span className="text-sm font-medium">Batches This Month</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{batchCount}</p>
          </CardContent>
        </Card>

        {/* Papers Marked */}
        <Card className="bg-white border-slate-100">
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2 text-slate-600">
              <FileCheck className="text-indigo-600" />
              <span className="text-sm font-medium">Papers Marked</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{totalPapersMarked}</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Row */}
      <div className="flex flex-wrap gap-3">
        <Button className="bg-indigo-700 hover:bg-indigo-800" render={<Link href="/papers" />}>
          <FileUp data-icon="inline-start" />
          Upload Question Paper
        </Button>
        <Button variant="outline" onClick={onCreateBatch} render={onCreateBatch ? undefined : <Link href="/batches" />}>
          <Plus data-icon="inline-start" />
          Create New Batch
        </Button>
        <Button variant="ghost" render={<Link href="/batches" />}>
          <Layers data-icon="inline-start" />
          View All Batches
        </Button>
      </div>

      {/* Recent Batches Table */}
      <Card className="bg-white border-slate-100">
        <CardHeader>
          <CardTitle>Recent Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {recentBatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="rounded-full bg-slate-100 p-4">
                <Layers className="text-slate-400 size-8" />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-900">No batches yet</p>
                <p className="text-sm text-slate-500">
                  Create your first batch to start marking
                </p>
              </div>
              <Button
                className="bg-indigo-700 hover:bg-indigo-800"
                onClick={onCreateBatch}
                render={onCreateBatch ? undefined : <Link href="/batches" />}
              >
                Create Batch
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Papers</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell className="text-slate-600">
                      {batch.subject_name ?? '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell className="text-slate-600">
                      {batch.marked_papers}/{batch.total_papers}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {formatDate(batch.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/batches/${batch.id}`} />}
                      >
                        View
                        <ArrowRight data-icon="inline-end" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Nudge */}
      {showUpgradeNudge && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-amber-900">Running low on AI Minutes</p>
              <p className="text-sm text-amber-700">
                You have {aiMinutesRemaining} minute{aiMinutesRemaining !== 1 ? 's' : ''} left on
                the Free plan. Upgrade to mark more papers.
              </p>
            </div>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
              onClick={onUpgradeClick}
            >
              Upgrade Now
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
