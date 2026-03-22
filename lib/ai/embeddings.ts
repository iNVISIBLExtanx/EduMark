import { openai } from './openai-client';
import { chunkMarkingScheme, type StructureJson } from './chunking';
import {
  insertEmbeddingChunks,
  deleteEmbeddingsByScheme,
  markEmbeddingsDone,
  matchMarkingCriteria,
  type EmbeddingChunkInput,
} from '@/lib/db/marking-schemes';

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  return response.data
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function generateAndStoreEmbeddings(
  schemeId: string,
  structureJson: StructureJson,
): Promise<{ chunksStored: number }> {
  const chunks = chunkMarkingScheme(structureJson);

  if (chunks.length === 0) {
    throw new Error('No chunks generated from structure_json');
  }

  const texts = chunks.map((c) => c.chunk_text);
  const embeddings = await generateEmbeddings(texts);

  await deleteEmbeddingsByScheme(schemeId);

  const dbChunks: EmbeddingChunkInput[] = chunks.map((chunk, i) => ({
    scheme_id: schemeId,
    chunk_text: chunk.chunk_text,
    chunk_type: chunk.chunk_type,
    question_no: chunk.question_no,
    embedding: embeddings[i],
  }));

  await insertEmbeddingChunks(dbChunks);
  await markEmbeddingsDone(schemeId);

  return { chunksStored: dbChunks.length };
}

export async function retrieveMarkingCriteria(
  schemeId: string,
  questionText: string,
  matchCount: number = 5,
) {
  const [queryEmbedding] = await generateEmbeddings([questionText]);
  return matchMarkingCriteria(schemeId, queryEmbedding, matchCount);
}
