export interface SchemeQuestion {
  no: number;
  marks: number;
  model_answer?: string | null;
}

export interface StructureJson {
  questions: SchemeQuestion[];
}

export interface TextChunk {
  chunk_text: string;
  chunk_type: 'question_criterion' | 'model_answer' | 'mark_allocation';
  question_no: number;
}

export function chunkMarkingScheme(structure: StructureJson): TextChunk[] {
  const chunks: TextChunk[] = [];

  for (const q of structure.questions) {
    chunks.push({
      chunk_text: `Question ${q.no}: Total marks: ${q.marks}`,
      chunk_type: 'mark_allocation',
      question_no: q.no,
    });

    if (q.model_answer && q.model_answer.trim().length > 0) {
      chunks.push({
        chunk_text: `Question ${q.no} model answer: ${q.model_answer}`,
        chunk_type: 'model_answer',
        question_no: q.no,
      });
    }

    chunks.push({
      chunk_text: `Question ${q.no} (${q.marks} marks): Expected answer: ${q.model_answer ?? 'N/A'}`,
      chunk_type: 'question_criterion',
      question_no: q.no,
    });
  }

  return chunks;
}
