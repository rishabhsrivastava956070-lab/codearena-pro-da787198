-- 1) Server-side leaderboard recompute trigger
CREATE OR REPLACE FUNCTION public.recalc_contest_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_score integer := 0;
  v_penalty integer := 0;
BEGIN
  -- Only act on contest submissions
  IF NEW.contest_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get contest window
  SELECT start_time, end_time INTO v_start, v_end
  FROM public.contests WHERE id = NEW.contest_id;

  -- Ignore submissions outside the window
  IF NEW.created_at < v_start OR NEW.created_at > v_end THEN
    RETURN NEW;
  END IF;

  -- Score: sum of points for problems with at least one accepted submission in this contest by this user
  SELECT COALESCE(SUM(cp.points), 0) INTO v_score
  FROM public.contest_problems cp
  WHERE cp.contest_id = NEW.contest_id
    AND EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.contest_id = NEW.contest_id
        AND s.user_id = NEW.user_id
        AND s.problem_id = cp.problem_id
        AND s.status = 'accepted'
        AND s.created_at BETWEEN v_start AND v_end
    );

  -- Penalty: count of wrong attempts before first AC, summed across solved problems
  SELECT COALESCE(SUM(wrongs), 0) INTO v_penalty
  FROM (
    SELECT (
      SELECT count(*) FROM public.submissions s2
      WHERE s2.contest_id = NEW.contest_id
        AND s2.user_id = NEW.user_id
        AND s2.problem_id = cp.problem_id
        AND s2.status <> 'accepted'
        AND s2.created_at BETWEEN v_start AND first_ac.first_at
    ) AS wrongs
    FROM public.contest_problems cp
    JOIN LATERAL (
      SELECT MIN(created_at) AS first_at
      FROM public.submissions s3
      WHERE s3.contest_id = NEW.contest_id
        AND s3.user_id = NEW.user_id
        AND s3.problem_id = cp.problem_id
        AND s3.status = 'accepted'
        AND s3.created_at BETWEEN v_start AND v_end
    ) first_ac ON first_ac.first_at IS NOT NULL
    WHERE cp.contest_id = NEW.contest_id
  ) t;

  -- Upsert participant row
  INSERT INTO public.contest_participants (contest_id, user_id, score, penalty)
  VALUES (NEW.contest_id, NEW.user_id, v_score, v_penalty)
  ON CONFLICT (contest_id, user_id)
  DO UPDATE SET score = EXCLUDED.score, penalty = EXCLUDED.penalty;

  RETURN NEW;
END;
$$;

-- Add unique constraint needed for ON CONFLICT (idempotent guard)
DO $$ BEGIN
  ALTER TABLE public.contest_participants
    ADD CONSTRAINT contest_participants_pkey_user PRIMARY KEY (contest_id, user_id);
EXCEPTION WHEN invalid_table_definition THEN null;
WHEN duplicate_object THEN null;
WHEN duplicate_table THEN null; END $$;

DROP TRIGGER IF EXISTS trg_recalc_contest_score ON public.submissions;
CREATE TRIGGER trg_recalc_contest_score
AFTER INSERT OR UPDATE OF status ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.recalc_contest_score();

-- 2) Enable realtime on the leaderboard table
ALTER TABLE public.contest_participants REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_participants;
EXCEPTION WHEN duplicate_object THEN null; END $$;