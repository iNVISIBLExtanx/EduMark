const LANG_STYLES: Record<string, string> = {
  sinhala: 'bg-purple-100 text-purple-700',
  tamil: 'bg-orange-100 text-orange-700',
  english: 'bg-blue-100 text-blue-700',
};

export function LanguageBadge({ language }: { language: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${LANG_STYLES[language] ?? LANG_STYLES.english}`}>
      {language}
    </span>
  );
}
