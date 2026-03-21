import useSWR from 'swr';

interface TutorSubject {
  subject_id: string;
  subjects: { id: string; name: string; code: string };
}

export function useTutorSubjects() {
  const { data, error, isLoading } = useSWR<TutorSubject[]>('/api/tutor/subjects');
  return { subjects: data ?? [], error, isLoading };
}
