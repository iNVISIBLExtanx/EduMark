const PLAN_STYLES: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  starter: 'bg-blue-100 text-blue-700',
  standard: 'bg-indigo-100 text-indigo-700',
  pro: 'bg-purple-100 text-purple-700',
  institute: 'bg-amber-100 text-amber-700',
};

export function PlanBadge({ plan }: { plan: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium capitalize ${PLAN_STYLES[plan] ?? PLAN_STYLES.free}`}
    >
      {plan}
    </span>
  );
}
