import useSWR from 'swr';

interface TutorProfile {
  id: string;
  email: string;
  full_name: string;
  marking_language: string;
  plan: string;
}

export function useTutorProfile() {
  const { data, error, isLoading, mutate } = useSWR<TutorProfile>('/api/tutor/profile');
  return { tutor: data, error, isLoading, mutate };
}
