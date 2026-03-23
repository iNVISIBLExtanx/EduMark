-- Fix mutable search_path security warnings (flagged by Supabase security advisor)

CREATE OR REPLACE FUNCTION public.increment_ai_minutes_used(p_tutor_id uuid, p_amount int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.tutors
  SET ai_minutes_used = LEAST(ai_minutes_used + p_amount, ai_minutes_limit)
  WHERE id = p_tutor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_topup_minutes(p_tutor_id uuid, p_amount int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.tutors
  SET ai_minutes_limit = ai_minutes_limit + p_amount
  WHERE id = p_tutor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_marking_criteria(
  p_scheme_id uuid, p_query_embedding extensions.vector(1536), p_match_count int
)
RETURNS TABLE (id uuid, chunk_text text, chunk_type text, question_no int, similarity float)
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT mse.id, mse.chunk_text, mse.chunk_type, mse.question_no,
    1 - (mse.embedding OPERATOR(extensions.<=>) p_query_embedding) AS similarity
  FROM public.ms_embeddings mse
  WHERE mse.scheme_id = p_scheme_id
  ORDER BY mse.embedding OPERATOR(extensions.<=>) p_query_embedding
  LIMIT p_match_count;
END;
$$;
