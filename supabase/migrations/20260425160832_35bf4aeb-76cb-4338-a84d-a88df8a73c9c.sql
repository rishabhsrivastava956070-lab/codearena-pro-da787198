-- Add 'queued' status to submissions if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'queued' AND enumtypid = 'public.submission_status'::regtype) THEN
    ALTER TYPE public.submission_status ADD VALUE 'queued' BEFORE 'pending';
  END IF;
END$$;

-- Job status enum
DO $$ BEGIN
  CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'done', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.submission_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  submission_id uuid,
  problem_id uuid NOT NULL,
  contest_id uuid,
  language text NOT NULL,
  code text NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS submission_jobs_pickup_idx
  ON public.submission_jobs (status, next_run_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS submission_jobs_user_recent_idx
  ON public.submission_jobs (user_id, created_at DESC);

CREATE TRIGGER submission_jobs_touch
BEFORE UPDATE ON public.submission_jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.submission_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_select_own_or_admin"
ON public.submission_jobs FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- No INSERT/UPDATE/DELETE policies: only service role (worker + execute-code) writes.

-- Atomic claim function (SELECT ... FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_submission_jobs(_limit integer, _lock_seconds integer DEFAULT 60)
RETURNS SETOF public.submission_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.submission_jobs
    WHERE status = 'queued'
      AND next_run_at <= now()
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY next_run_at ASC
    LIMIT _limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.submission_jobs j
  SET status = 'running',
      attempts = j.attempts + 1,
      locked_until = now() + make_interval(secs => _lock_seconds),
      updated_at = now()
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.*;
END;
$$;

-- Rate-limit helper
CREATE OR REPLACE FUNCTION public.count_recent_submission_jobs(_user_id uuid, _within_seconds integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.submission_jobs
  WHERE user_id = _user_id
    AND created_at > now() - make_interval(secs => _within_seconds);
$$;

-- Realtime so frontend can watch its submission row flip from queued -> done
ALTER TABLE public.submissions REPLICA IDENTITY FULL;
DO $$ BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'submissions';
  IF NOT FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions';
  END IF;
END $$;

-- Required extensions for cron-driven worker
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;