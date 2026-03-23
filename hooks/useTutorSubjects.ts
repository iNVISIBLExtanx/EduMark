import useSWR from 'swr';

interface TutorSubject {
  subject_id: string;
  subjects: { id: string; name: string; code: string };
}

export function useTutorSubjects() {
  const { data, error, isLoading, mutate } = useSWR<TutorSubject[]>('/api/tutor/subjects');
  return { subjects: data ?? [], error, isLoading, mutate };
}
