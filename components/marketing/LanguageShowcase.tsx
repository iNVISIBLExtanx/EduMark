'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Language = 'sinhala' | 'tamil' | 'english';

const TABS: { key: Language; label: string; script: string }[] = [
  { key: 'sinhala', label: 'Sinhala', script: 'සිංහල' },
  { key: 'tamil',   label: 'Tamil',   script: 'தமிழ்' },
  { key: 'english', label: 'English', script: 'English' },
];

const FEEDBACK: Record<Language, {
  fontClass: string;
  feedback: string;
  subQuestions: { label: string; awarded: number; max: number; note: string }[];
}> = {
  sinhala: {
    fontClass: 'font-sinhala leading-loose',
    feedback:
      'ශිෂ්‍යයා අවකලනීය සමීකරණයේ සාමාන්‍ය විසඳුම නිවැරදිව හඳුනාගෙන, සීමා කොන්දේසිය නිරවද්‍යව යෙදා ඇත. 4 වන පියවරේදී ඒකාකල නියතය ඇතුළත් කර නොමැති නිසා, අවසාන සරල කිරීමේ සුළු දෝෂයක් ඇති වී ඇත.',
    subQuestions: [
      { label: '(a)(i)',  awarded: 8,  max: 10, note: 'නිවැරදි ශ්‍රිත රූපය' },
      { label: '(a)(ii)', awarded: 7,  max: 8,  note: 'නිශ්චිත ඒකාකාරිතාව' },
      { label: '(b)',     awarded: 7,  max: 7,  note: 'සීමා අගය නිවැරදිය' },
    ],
  },
  tamil: {
    fontClass: 'font-tamil leading-loose',
    feedback:
      'மாணவர் வகையீட்டு சமன்பாட்டின் பொது தீர்வை சரியாக அடையாளம் கண்டு, எல்லை நிபந்தனையை துல்லியமாக பயன்படுத்தியுள்ளார். படி 4-இல் தொகையீட்டு மாறிலி விடுபட்டுள்ளது; இறுதி எளிமைப்படுத்தலில் சிறிய பிழை காணப்படுகிறது.',
    subQuestions: [
      { label: '(a)(i)',  awarded: 8,  max: 10, note: 'சரியான சார்பு வடிவம்' },
      { label: '(a)(ii)', awarded: 7,  max: 8,  note: 'திட்டவட்டமான சமச்சீர்' },
      { label: '(b)',     awarded: 7,  max: 7,  note: 'எல்லை மதிப்பு சரியானது' },
    ],
  },
  english: {
    fontClass: 'font-sans',
    feedback:
      'The student correctly identified the general solution of the differential equation and applied the boundary condition accurately. The constant of integration was omitted in step 4, leading to a minor error in the final simplification.',
    subQuestions: [
      { label: '(a)(i)',  awarded: 8,  max: 10, note: 'Correct function form' },
      { label: '(a)(ii)', awarded: 7,  max: 8,  note: 'Definite symmetry check' },
      { label: '(b)',     awarded: 7,  max: 7,  note: 'Boundary value correct' },
    ],
  },
};

export default function LanguageShowcase() {
  const [active, setActive] = useState<Language>('sinhala');
  const content = FEEDBACK[active];
  const total = content.subQuestions.reduce((s, q) => s + q.awarded, 0);
  const max   = content.subQuestions.reduce((s, q) => s + q.max, 0);

  return (
    <section className="py-16 sm:py-24 bg-muted/30 border-y border-border/40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Mark in the Language You Teach
          </h2>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            When you teach in Sinhala, your students get feedback in Sinhala.
            Not a translation — written by AI in your language from the start.
          </p>
        </div>

        {/* Tab Bar */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center rounded-xl border border-border/60 bg-card p-1 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  active === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className={tab.key !== 'english' ? (tab.key === 'sinhala' ? 'font-sinhala' : 'font-tamil') : ''}>
                  {tab.script}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Card */}
        <div className="mx-auto mt-8 max-w-2xl">
          <Card className="border-l-4 border-l-primary shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-base text-foreground sm:text-lg">
                  Combined Maths — Question 3 (Part A)
                </CardTitle>
                <div className="flex items-baseline gap-1 shrink-0">
                  <span className="text-3xl font-bold text-green-600">{total}</span>
                  <span className="text-lg text-muted-foreground">/ {max}</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Feedback text */}
              <p className={`text-sm leading-relaxed text-foreground ${content.fontClass}`}>
                {content.feedback}
              </p>

              {/* Sub-questions breakdown */}
              <div className="overflow-hidden rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Part</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Marks</th>
                      <th className="hidden px-3 py-2 text-left font-medium text-muted-foreground sm:table-cell">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {content.subQuestions.map((q, i) => (
                      <tr key={q.label} className={i < content.subQuestions.length - 1 ? 'border-b border-border/40' : ''}>
                        <td className="px-3 py-2 font-mono text-foreground">{q.label}</td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">
                          {q.awarded} / {q.max}
                        </td>
                        <td className={`hidden px-3 py-2 text-muted-foreground sm:table-cell ${content.fontClass}`}>
                          {q.note}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                  <Check className="mr-1 size-3" />
                  OCR: High Confidence
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  AI-marked
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
