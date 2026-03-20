import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './mark-paper';

describe('buildSystemPrompt', () => {
  const scheme = 'Q1: 10 marks. Model answer: ...';

  it('includes subject name', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain('Physics');
  });

  it('includes marking scheme text', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain(scheme);
  });

  it('includes Sinhala instructions for sinhala medium', () => {
    const prompt = buildSystemPrompt('Physics', 'sinhala', scheme);
    expect(prompt).toContain('සිංහල');
  });

  it('includes Tamil instructions for tamil medium', () => {
    const prompt = buildSystemPrompt('Physics', 'tamil', scheme);
    expect(prompt).toContain('தமிழ்');
  });

  it('includes JSON output format', () => {
    const prompt = buildSystemPrompt('Physics', 'english', scheme);
    expect(prompt).toContain('"questions"');
    expect(prompt).toContain('"awarded_marks"');
    expect(prompt).toContain('"ocr_confidence"');
  });

  it('falls back to english for unknown medium', () => {
    const prompt = buildSystemPrompt('Physics', 'unknown', scheme);
    expect(prompt).toContain('Generate ALL feedback in English');
  });
});
