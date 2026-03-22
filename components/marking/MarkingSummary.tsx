'use client';

interface MarkingSummaryProps {
  totalAwarded: number;
  totalMax: number;
  overrideTotal?: number;
}

export function MarkingSummary({ totalAwarded, totalMax, overrideTotal }: MarkingSummaryProps) {
  const hasOverrides = overrideTotal !== undefined && overrideTotal !== totalAwarded;
  const displayTotal = hasOverrides ? overrideTotal : totalAwarded;
  const percentage = totalMax > 0 ? Math.round((displayTotal / totalMax) * 100) : 0;

  return (
    <div className="rounded-lg border p-4">
      <p className="text-lg font-bold">{displayTotal}/{totalMax}</p>
      <p className="text-sm text-gray-500">{percentage}%</p>
      {hasOverrides && (
        <p className="text-xs text-blue-600 mt-1">Includes tutor adjustments</p>
      )}
    </div>
  );
}
