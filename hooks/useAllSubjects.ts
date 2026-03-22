import useSWR from 'swr';

interface Subject {
  id: string;
  name: string;
  code: string;
}

export function useAllSubjects() {
  const { data, error, isLoading } = useSWR<Subject[]>('/api/subjects');
  return { subjects: data ?? [], error, isLoading };
}
