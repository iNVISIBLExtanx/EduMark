-- Create 3 private storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('marking-schemes', 'marking-schemes', false),
  ('submissions', 'submissions', false),
  ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- marking-schemes bucket policies
CREATE POLICY "ms_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marking-schemes' AND (storage.foldername(name))[1] = (select auth.uid()::text));

CREATE POLICY "ms_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marking-schemes' AND (storage.foldername(name))[1] = (select auth.uid()::text));

CREATE POLICY "ms_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marking-schemes' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- submissions bucket policies
CREATE POLICY "sub_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'submissions' AND (storage.foldername(name))[1] = (select auth.uid()::text));

CREATE POLICY "sub_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'submissions' AND (storage.foldername(name))[1] = (select auth.uid()::text));

CREATE POLICY "sub_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'submissions' AND (storage.foldername(name))[1] = (select auth.uid()::text));

-- reports bucket policies
CREATE POLICY "rep_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = (select auth.uid()::text));

CREATE POLICY "rep_select_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = (select auth.uid()::text));

CREATE POLICY "rep_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = (select auth.uid()::text));
