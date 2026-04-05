import { Check, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COMING_SOON = [
  {
    name: 'Physics',
    structure: '4 compulsory structured questions (Part A) + 4 compulsory structured questions (Part B)',
  },
  {
    name: 'Chemistry',
    structure: '4 compulsory structured questions + Best 3 of 5 essay questions',
  },
  {
    name: 'Biology',
    structure: '4 compulsory essays (Part A) + Best 2 of 3 long essays (Part B)',
  },
  {
    name: 'Economics',
    structure: '4 compulsory structured questions + Best 3 of 5 essays',
  },
  {
    name: 'Business Studies',
    structure: '4 compulsory structured questions + Best 3 of 5 essays',
  },
];

export default function SubjectSpotlight() {
  return (
    <section className="py-16 sm:py-24" id="subjects">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Subjects We Mark
          </h2>
          <p className="mt-4 text-muted-foreground">
            Built to understand the exact structure of each Sri Lanka A/L exam paper —
            not a generic marking tool adapted for local exams.
          </p>
        </div>

        {/* Combined Maths — Featured Card */}
        <div className="mx-auto mt-12 max-w-4xl sm:mt-16">
          <Card className="border-2 border-primary/30 bg-card shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-green-100 text-green-700 border-green-200 gap-1 px-3 py-1 text-sm hover:bg-green-100">
                  <Check className="size-3.5" />
                  Available Now
                </Badge>
                <CardTitle className="text-xl sm:text-2xl text-foreground">
                  Combined Maths
                </CardTitle>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Pure Mathematics (Paper I) and Applied Mathematics (Paper II) — both handled separately.
              </p>
            </CardHeader>

            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                {/* Part A */}
                <div className="rounded-xl border border-border/60 bg-muted/40 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      A
                    </div>
                    <span className="font-semibold text-foreground">Part A</span>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-green-600 shrink-0" />
                      10 questions — all compulsory
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-green-600 shrink-0" />
                      25 marks per question
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-green-600 shrink-0" />
                      250 marks total
                    </li>
                  </ul>
                </div>

                {/* Part B */}
                <div className="rounded-xl border border-border/60 bg-muted/40 p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                      B
                    </div>
                    <span className="font-semibold text-foreground">Part B</span>
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-green-600 shrink-0" />
                      7 questions — answer Best 5
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-green-600 shrink-0" />
                      150 marks per question
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-3.5 text-green-600 shrink-0" />
                      Best 5 auto-selected by AI
                    </li>
                  </ul>
                </div>
              </div>

              {/* Key differentiator note */}
              <div className="mt-5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Total: 1000 marks.</span>{' '}
                  EduMark automatically selects the Best-5 Part B answers, computes totals correctly,
                  and keeps Pure (Paper I) and Applied (Paper II) marking separate.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon Subjects */}
        <div className="mx-auto mt-8 max-w-4xl">
          <p className="mb-5 text-center text-sm font-medium text-muted-foreground">
            More subjects launching soon
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMING_SOON.map((subject) => (
              <Card
                key={subject.name}
                className="border-border/40 opacity-75 transition-opacity hover:opacity-90"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base text-foreground">
                      {subject.name}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="shrink-0 gap-1 text-xs text-muted-foreground"
                    >
                      <Clock className="size-3" />
                      Coming Soon
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {subject.structure}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
