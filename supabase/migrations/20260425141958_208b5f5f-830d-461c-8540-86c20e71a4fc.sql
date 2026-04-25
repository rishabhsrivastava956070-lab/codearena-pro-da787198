
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.difficulty AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE public.submission_status AS ENUM ('pending','running','accepted','wrong_answer','time_limit_exceeded','memory_limit_exceeded','runtime_error','compilation_error','internal_error');
CREATE TYPE public.code_language AS ENUM ('cpp','java','python','javascript');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ========== USER ROLES ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== USER STATS ==========
CREATE TABLE public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INT NOT NULL DEFAULT 0,
  level INT NOT NULL DEFAULT 1,
  streak INT NOT NULL DEFAULT 0,
  longest_streak INT NOT NULL DEFAULT 0,
  last_active_date DATE,
  problems_solved INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_stats_select_all" ON public.user_stats FOR SELECT USING (true);
CREATE POLICY "user_stats_update_own" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_stats_insert_own" ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ========== PROBLEMS ==========
CREATE TABLE public.problems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty public.difficulty NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  constraints TEXT,
  input_format TEXT,
  output_format TEXT,
  function_signature TEXT,
  starter_code JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_limit_ms INT NOT NULL DEFAULT 2000,
  memory_limit_mb INT NOT NULL DEFAULT 256,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "problems_select_published_or_admin" ON public.problems FOR SELECT
  USING (is_published OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "problems_admin_write" ON public.problems FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== TEST CASES ==========
CREATE TABLE public.test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  is_sample BOOLEAN NOT NULL DEFAULT false,
  explanation TEXT,
  ordering INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "test_cases_select_sample_or_admin" ON public.test_cases FOR SELECT
  USING (is_sample OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "test_cases_admin_write" ON public.test_cases FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== SUBMISSIONS ==========
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  contest_id UUID,
  language public.code_language NOT NULL,
  code TEXT NOT NULL,
  status public.submission_status NOT NULL DEFAULT 'pending',
  runtime_ms INT,
  memory_kb INT,
  passed_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  error_message TEXT,
  score INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_submissions_user ON public.submissions(user_id, created_at DESC);
CREATE INDEX idx_submissions_problem ON public.submissions(problem_id);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions_select_own_or_admin" ON public.submissions FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "submissions_insert_own" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "submissions_update_own" ON public.submissions FOR UPDATE USING (auth.uid() = user_id);

-- ========== CONTESTS ==========
CREATE TABLE public.contests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contests_select_all" ON public.contests FOR SELECT USING (true);
CREATE POLICY "contests_admin_write" ON public.contests FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.contest_problems (
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 100,
  ordering INT NOT NULL DEFAULT 0,
  PRIMARY KEY (contest_id, problem_id)
);
ALTER TABLE public.contest_problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contest_problems_select_all" ON public.contest_problems FOR SELECT USING (true);
CREATE POLICY "contest_problems_admin_write" ON public.contest_problems FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.contest_participants (
  contest_id UUID NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INT NOT NULL DEFAULT 0,
  penalty INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, user_id)
);
ALTER TABLE public.contest_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contest_participants_select_all" ON public.contest_participants FOR SELECT USING (true);
CREATE POLICY "contest_participants_insert_own" ON public.contest_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "contest_participants_update_own" ON public.contest_participants FOR UPDATE USING (auth.uid() = user_id);

-- ========== DISCUSSIONS / COMMENTS / VOTES ==========
CREATE TABLE public.discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_id UUID REFERENCES public.problems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  video_url TEXT,
  upvotes INT NOT NULL DEFAULT 0,
  downvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "discussions_select_all" ON public.discussions FOR SELECT USING (true);
CREATE POLICY "discussions_insert_own" ON public.discussions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "discussions_update_own" ON public.discussions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "discussions_delete_own_or_admin" ON public.discussions FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES public.discussions(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  upvotes INT NOT NULL DEFAULT 0,
  downvotes INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_select_all" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_own" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_own_or_admin" ON public.comments FOR DELETE
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.votes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('discussion','comment')),
  target_id UUID NOT NULL,
  value SMALLINT NOT NULL CHECK (value IN (-1,1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id)
);
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_select_all" ON public.votes FOR SELECT USING (true);
CREATE POLICY "votes_manage_own" ON public.votes FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ========== DAILY CHALLENGES ==========
CREATE TABLE public.daily_challenges (
  date DATE PRIMARY KEY,
  problem_id UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  bonus_xp INT NOT NULL DEFAULT 50
);
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_select_all" ON public.daily_challenges FOR SELECT USING (true);
CREATE POLICY "daily_admin_write" ON public.daily_challenges FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ========== PEER ROOMS ==========
CREATE TABLE public.peer_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  problem_id UUID REFERENCES public.problems(id) ON DELETE SET NULL,
  language public.code_language NOT NULL DEFAULT 'python',
  current_code TEXT NOT NULL DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.peer_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "peer_rooms_select_all" ON public.peer_rooms FOR SELECT USING (true);
CREATE POLICY "peer_rooms_insert_authed" ON public.peer_rooms FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "peer_rooms_update_authed" ON public.peer_rooms FOR UPDATE USING (auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.peer_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contest_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;

-- ========== TIMESTAMP TRIGGER ==========
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_problems_updated BEFORE UPDATE ON public.problems
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_peer_rooms_updated BEFORE UPDATE ON public.peer_rooms
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ========== NEW USER HANDLER ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  attempt INT := 0;
BEGIN
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1),
    'user'
  );
  final_username := base_username;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    attempt := attempt + 1;
    final_username := base_username || attempt::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', final_username),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.user_stats (user_id) VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
