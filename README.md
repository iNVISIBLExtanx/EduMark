# EduMark
### AI-Powered Essay Marking Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-edu--mark--pied.vercel.app-brightgreen?style=for-the-badge)](https://edu-mark-pied.vercel.app)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)

---

## The Problem

A tutoring academy running 20 students per class across 4 subjects returns **80-120 written papers per week**. At 10 minutes per paper, that's **14+ hours of marking time** — time the teacher should be teaching, not grading.

Manual marking is also inconsistent. Two teachers marking the same essay will often give different scores. Students get feedback days after submission, when it's no longer useful.

---

## What EduMark Does

EduMark is an AI-powered marking platform that grades written essay responses against a teacher-defined rubric and returns structured feedback within seconds.

**Before EduMark:**
- Teacher receives paper → marks manually → returns days later
- 10-15 minutes per paper
- Inconsistent feedback quality across markers
- No data on class-wide performance gaps

**After EduMark:**
- Student submits → AI marks against rubric → feedback returned instantly
- < 30 seconds per paper
- Consistent, rubric-grounded feedback every time
- Teachers see class-level analytics to target weak areas

---

## Who It's For

| Role | How they use it |
|------|----------------|
| **Tutoring Academy Owner** | Reduce teacher hours spent on admin marking |
| **Classroom Teacher** | Get instant diagnostic data on student performance |
| **Student** | Receive immediate, specific feedback without waiting |
| **Institution** | Standardise marking quality across multiple tutors |

---

## Architecture

```
Student Submission
       |
       v
  Next.js Frontend (TypeScript)
       |
       v
  API Routes———————— Rubric Store (Supabase)
       |
       v
  Claude API (Rubric-grounded evaluation)
       |
       v
  Structured Feedback + Score
       |
       v
  Supabase DB (Student history + analytics)
```

**Stack:** Next.js 14 · TypeScript · Supabase · Claude API · Tailwind CSS · Vercel

---

## Live Metrics

- **Deployments:** 28+ production deployments
- **Commits:** 83 across development history
- **Live at:** [edu-mark-pied.vercel.app](https://edu-mark-pied.vercel.app)

---

## Built By

Manodhya Opallage — [GitHub](https://github.com/iNVISIBLExtanx) · [LinkedIn](https://linkedin.com/in/manodhya-opallage)

M.Sc. Data Science (Trent University, Canada) · IEEE Published · Founder, Clazy.online

> This system was built from first-hand experience running a tutoring academy. The marking problem is real — this is the solution we actually use.

---

**Interested in implementing EduMark for your institution?** Contact: manodhya@clazy.online
