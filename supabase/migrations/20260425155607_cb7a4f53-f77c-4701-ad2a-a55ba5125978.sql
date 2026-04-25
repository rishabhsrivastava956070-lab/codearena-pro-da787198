-- Plagiarism report status enum
DO $$ BEGIN
  CREATE TYPE public.plagiarism_status AS ENUM ('pending', 'dismissed', 'confirmed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.plagiarism_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL,
  matched_submission_id uuid NOT NULL,
  user_id uuid NOT NULL,
  matched_user_id uuid NOT NULL,
  problem_id uuid NOT NULL,
  contest_id uuid,
  similarity numeric(5,4) NOT NULL,
  language text NOT NULL,
  status public.plagiarism_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plag_problem ON public.plagiarism_reports(problem_id);
CREATE INDEX IF NOT EXISTS idx_plag_status ON public.plagiarism_reports(status);
CREATE INDEX IF NOT EXISTS idx_plag_user ON public.plagiarism_reports(user_id);

ALTER TABLE public.plagiarism_reports ENABLE ROW LEVEL SECURITY;

-- Only admins can read
CREATE POLICY plag_admin_select ON public.plagiarism_reports
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can update / delete
CREATE POLICY plag_admin_update ON public.plagiarism_reports
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY plag_admin_delete ON public.plagiarism_reports
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Inserts happen via service role from the edge function only; no insert policy for users.
