-- Auto-saved drafts: one row per (user, problem, language)
CREATE TABLE IF NOT EXISTS public.code_drafts (
  user_id uuid NOT NULL,
  problem_id uuid NOT NULL,
  language text NOT NULL,
  code text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, problem_id, language)
);

ALTER TABLE public.code_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY drafts_select_own ON public.code_drafts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY drafts_insert_own ON public.code_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY drafts_update_own ON public.code_drafts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY drafts_delete_own ON public.code_drafts
  FOR DELETE USING (auth.uid() = user_id);

-- Manual / milestone version history
CREATE TABLE IF NOT EXISTS public.code_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  problem_id uuid NOT NULL,
  language text NOT NULL,
  code text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_code_versions_lookup
  ON public.code_versions(user_id, problem_id, language, created_at DESC);

ALTER TABLE public.code_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY versions_select_own ON public.code_versions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY versions_insert_own ON public.code_versions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY versions_delete_own ON public.code_versions
  FOR DELETE USING (auth.uid() = user_id);
