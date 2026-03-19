'use client';

export function MarkingSummary({ totalAwarded, totalMax }: { totalAwarded: number; totalMax: number }) {
  const percentage = totalMax > 0 ? Math.round((totalAwarded / totalMax) * 100) : 0;
  return (
    <div className="rounded-lg border p-4">
      <p className="text-lg font-bold">{totalAwarded}/{totalMax}</p>
      <p className="text-sm text-gray-500">{percentage}%</p>
    </div>
  );
}
