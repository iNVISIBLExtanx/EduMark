# EduMark AI
### AI Marking Tool Built for Sri Lanka's A/L Curriculum

[![Live Demo](https://img.shields.io/badge/Live%20Demo-edu--mark--zeta.vercel.app-brightgreen?style=for-the-badge)](https://edu-mark-zeta.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

---

## The Problem

A/L teachers in Sri Lanka return 80–120 written papers per week across multiple subjects. At 10 minutes per paper, that is **14+ hours of marking time** — time that should go toward teaching, not grading.

Manual marking is also inconsistent: two teachers marking the same answer will often score it differently. Students receive feedback days after submission, long after the lesson is relevant.

Existing AI marking tools are built for Western curricula and return feedback in English only — useless for a teacher who teaches in Sinhala or Tamil.

---

## What EduMark Does

EduMark is an AI-powered marking platform built specifically for Sri Lanka’s A/L curriculum. Teachers upload student answer sheets, define a marking scheme, and receive per-question feedback — in Sinhala, Tamil, or English — within seconds.

**Key differentiators:**
- **Sri Lanka A/L curriculum** — Combined Maths, Physics, Chemistry, Biology, and more
- **OCR** — Reads handwritten answer sheets directly from photo uploads
- **Trilingual feedback** — Feedback written in the language you teach, not translated
- **Per-question breakdown** — Structured marks for each sub-part (a)(i), (a)(ii), (b)...
- **Marking scheme grounded** — AI evaluates against your rubric, not generic criteria

**Before EduMark:**
- Teacher marks manually → 10–15 minutes per paper → feedback days later
- Inconsistent marking across different teachers
- No class-wide data on where students are struggling

**After EduMark:**
- Student submits → AI marks against rubric → feedback in < 30 seconds
- Consistent, rubric-grounded scores every time
- Teachers see class-level analytics to target weak areas

---

## Who It’s For

| Role | How They Use It |
|------|-----------------|
| **A/L Tutoring Academy Owner** | Reduce teacher hours on admin marking |
| **A/L Classroom Teacher** | Get instant diagnostic data per student |
| **Student** | Receive immediate, specific feedback in their language |
| **Institution** | Standardise marking quality across multiple tutors |

---

## Architecture

```
Student Answer Sheet (photo/PDF)
            |
            v
     OCR Layer — Handwriting extraction
            |
            v
  Next.js Frontend (TypeScript)
            |
            v
  API Routes ———————— Marking Scheme Store (Supabase)
            |
            v
  Claude API
  (Rubric-grounded evaluation + trilingual feedback)
            |
            v
  Structured Score + Per-question Feedback
            |
            v
  Supabase DB (Student history + class analytics)
```

**Stack:** Next.js 14 · TypeScript · Supabase · Claude API · Tailwind CSS · Vercel

---

## Live Metrics

- **Deployments:** 28+ production deployments
- **Commits:** 84 across development history
- **Live at:** [edu-mark-zeta.vercel.app](https://edu-mark-zeta.vercel.app)

---

## Built By

Manodhya Opallage — [GitHub](https://github.com/iNVISIBLExtanx) · [LinkedIn](https://linkedin.com/in/manodhya-opallage)

M.Sc. Data Science (Trent University, Canada) · IEEE Published · Founder, Clazy.online

> Built from direct experience running a tutoring academy — the marking problem is real, and this is the system built to solve it for Sri Lankan teachers specifically.

---

**Interested in implementing EduMark for your institution?** Contact: manodhya@clazy.online
