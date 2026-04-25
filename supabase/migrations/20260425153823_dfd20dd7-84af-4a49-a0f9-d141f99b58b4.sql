-- 1) Enum
DO $$ BEGIN
  CREATE TYPE public.problem_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) Columns
ALTER TABLE public.problems
  ADD COLUMN IF NOT EXISTS status public.problem_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS review_notes text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- 3) Backfill: existing published problems are approved
UPDATE public.problems SET status = 'approved' WHERE is_published = true AND status = 'pending';

-- 4) Index
CREATE INDEX IF NOT EXISTS problems_status_idx ON public.problems(status);

-- 5) Replace SELECT policy: regular users only see approved AND published; admins see all
DROP POLICY IF EXISTS problems_select_published_or_admin ON public.problems;
CREATE POLICY problems_select_approved_or_admin ON public.problems
  FOR SELECT
  USING (
    (status = 'approved' AND is_published = true)
    OR public.has_role(auth.uid(), 'admin')
  );