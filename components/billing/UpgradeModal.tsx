'use client';

export function UpgradeModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="rounded-lg bg-white p-6 max-w-md w-full">
        <h2 className="text-xl font-bold">Upgrade Your Plan</h2>
        <p className="mt-2 text-gray-600">You&apos;ve used all your AI minutes. Upgrade to continue marking.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded px-4 py-2 text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <a href="/pricing" className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800">
            View Plans
          </a>
        </div>
      </div>
    </div>
  );
}
