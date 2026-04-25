import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDGE0_BASE = "https://ce.judge0.com";
const LANG_ID: Record<string, number> = { cpp: 54, java: 62, python: 71, javascript: 63 };

// Rate limit: max N submit jobs per user per window
const SUBMIT_RATE_LIMIT = 5;
const SUBMIT_RATE_WINDOW_SEC = 10;

type SubmitBody = {
  problem_id: string;
  language: string;
  code: string;
  mode: "run" | "submit" | "custom";
  contest_id?: string;
  stdin?: string; // only for mode === "custom"
};

// ----- Plagiarism: normalize + tokenize + Jaccard similarity -----
function normalizeCode(src: string, lang: string): string {
  let s = src;
  // strip block comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
  // strip line comments
  if (lang === "python") {
    s = s.replace(/(^|\n)\s*#[^\n]*/g, "$1");
    // triple-quoted docstrings
    s = s.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, " ");
  } else {
    s = s.replace(/\/\/[^\n]*/g, " ");
  }
  // strip string literals
  s = s.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim().toLowerCase();
  return s;
}
function tokenSet(src: string): Set<string> {
  const tokens = src.match(/[a-z_][a-z0-9_]*|[0-9]+|[^\s\w]/gi) ?? [];
  // 3-gram shingles for stronger signal
  const shingles = new Set<string>();
  for (let i = 0; i + 3 <= tokens.length; i++) shingles.add(tokens.slice(i, i + 3).join("|"));
  if (shingles.size === 0) tokens.forEach((t) => shingles.add(t));
  return shingles;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const t of small) if (big.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

async function runPlagiarismCheck(admin: any, params: {
  submission_id: string;
  user_id: string;
  problem_id: string;
  contest_id: string | null;
  language: string;
  code: string;
}) {
  try {
    const norm = normalizeCode(params.code, params.language);
    if (norm.length < 40) return; // too small to be meaningful
    const tokens = tokenSet(norm);

    // Compare against accepted submissions for the same problem+language by other users
    let q = admin
      .from("submissions")
      .select("id, user_id, code, contest_id, created_at")
      .eq("problem_id", params.problem_id)
      .eq("language", params.language)
      .eq("status", "accepted")
      .neq("user_id", params.user_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (params.contest_id) q = q.eq("contest_id", params.contest_id);
    const { data: others } = await q;
    if (!others?.length) return;

    let best = { sim: 0, sub: null as any };
    for (const o of others) {
      const sim = jaccard(tokens, tokenSet(normalizeCode(o.code, params.language)));
      if (sim > best.sim) best = { sim, sub: o };
    }
    if (best.sim >= 0.8 && best.sub) {
      await admin.from("plagiarism_reports").insert({
        submission_id: params.submission_id,
        matched_submission_id: best.sub.id,
        user_id: params.user_id,
        matched_user_id: best.sub.user_id,
        problem_id: params.problem_id,
        contest_id: params.contest_id,
        similarity: Math.round(best.sim * 10000) / 10000,
        language: params.language,
      });
    }
  } catch (e) {
    console.error("plagiarism check failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    const body = (await req.json()) as SubmitBody;
    if (!body.problem_id || !body.code || !LANG_ID[body.language]) {
      return new Response(JSON.stringify({ error: "Invalid input" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auth (required for submit)
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (body.mode === "submit" && !user) {
      return new Response(JSON.stringify({ error: "Auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: prob } = await admin.from("problems").select("id, time_limit_ms, memory_limit_mb").eq("id", body.problem_id).maybeSingle();
    if (!prob) throw new Error("Problem not found");

    // ----- SUBMIT mode: enqueue and return immediately -----
    if (body.mode === "submit" && user) {
      // Per-user rate limit
      const { data: recent, error: rlErr } = await admin.rpc("count_recent_submission_jobs", {
        _user_id: user.id,
        _within_seconds: SUBMIT_RATE_WINDOW_SEC,
      });
      if (rlErr) throw rlErr;
      if ((recent ?? 0) >= SUBMIT_RATE_LIMIT) {
        return new Response(
          JSON.stringify({
            error: "rate_limited",
            message: `Too many submissions. Wait a few seconds (max ${SUBMIT_RATE_LIMIT} per ${SUBMIT_RATE_WINDOW_SEC}s).`,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Create the submission row up-front in 'queued' state so the user can watch it via realtime
      const { data: subRow, error: subErr } = await admin
        .from("submissions")
        .insert({
          user_id: user.id,
          problem_id: body.problem_id,
          contest_id: body.contest_id ?? null,
          language: body.language,
          code: body.code,
          status: "queued",
        })
        .select("id")
        .maybeSingle();
      if (subErr || !subRow) throw new Error(subErr?.message || "Failed to create submission");

      const { error: jobErr } = await admin.from("submission_jobs").insert({
        user_id: user.id,
        submission_id: subRow.id,
        problem_id: body.problem_id,
        contest_id: body.contest_id ?? null,
        language: body.language,
        code: body.code,
      });
      if (jobErr) throw jobErr;

      // Best-effort kick the worker so the user doesn't wait for the cron tick
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/judge-worker`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
          body: "{}",
        });
      } catch (_) {/* ignore — cron will pick it up */}

      return new Response(
        JSON.stringify({ status: "queued", submission_id: subRow.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ----- CUSTOM mode: run once against user-provided stdin, no DB writes -----
    if (body.mode === "custom") {
      const submission = {
        source_code: body.code,
        language_id: LANG_ID[body.language],
        stdin: body.stdin ?? "",
        cpu_time_limit: Math.max(1, Math.ceil((prob.time_limit_ms ?? 2000) / 1000)),
        memory_limit: (prob.memory_limit_mb ?? 256) * 1024,
      };
      const submitRes = await fetch(`${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      if (!submitRes.ok) {
        const text = await submitRes.text();
        throw new Error(`Judge0 submit ${submitRes.status}: ${text.slice(0, 200)}`);
      }
      const { token } = await submitRes.json();
      if (!token) throw new Error("Judge0 returned no token");
      let j: any = null;
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 700));
        const pollRes = await fetch(
          `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory`,
          { headers: { "Content-Type": "application/json" } },
        );
        if (!pollRes.ok) throw new Error(`Judge0 poll ${pollRes.status}`);
        j = await pollRes.json();
        if (j?.status?.id && j.status.id >= 3) break;
      }
      if (!j?.status) throw new Error("Judge0 polling timed out");
      let mapped = "accepted";
      if (j.status.id === 5) mapped = "time_limit_exceeded";
      else if (j.status.id === 6) mapped = "compilation_error";
      else if (j.status.id >= 7 && j.status.id <= 12) mapped = "runtime_error";
      else if (j.status.id !== 3) mapped = "internal_error";
      return new Response(
        JSON.stringify({
          status: mapped,
          stdout: j.stdout ?? "",
          stderr: j.stderr ?? j.compile_output ?? j.message ?? "",
          runtime_ms: Math.round(parseFloat(j.time || "0") * 1000),
          memory_kb: j.memory ?? 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: cases } = await admin
      .from("test_cases")
      .select("input, expected_output, is_sample")
      .eq("problem_id", body.problem_id)
      .order("ordering");
    let testCases = cases || [];
    if (body.mode === "run") testCases = testCases.filter((c) => c.is_sample);
    if (testCases.length === 0) throw new Error("No test cases");

    const results: { input: string; expected: string; got: string; passed: boolean; status: string }[] = [];
    let overall: string = "accepted";
    let totalRuntime = 0;
    let maxMemory = 0;
    let firstError: string | null = null;

    for (const tc of testCases) {
      const submission = {
        source_code: body.code,
        language_id: LANG_ID[body.language],
        stdin: tc.input,
        expected_output: tc.expected_output,
        cpu_time_limit: Math.max(1, Math.ceil((prob.time_limit_ms ?? 2000) / 1000)),
        memory_limit: (prob.memory_limit_mb ?? 256) * 1024,
      };
      // Submit (async) then poll — public ce.judge0.com may not honor wait=true reliably
      const submitRes = await fetch(`${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission),
      });
      if (!submitRes.ok) {
        const text = await submitRes.text();
        throw new Error(`Judge0 submit ${submitRes.status}: ${text.slice(0, 200)}`);
      }
      const { token } = await submitRes.json();
      if (!token) throw new Error("Judge0 returned no token");

      let j: any = null;
      const maxAttempts = 20;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((res) => setTimeout(res, 700));
        const pollRes = await fetch(
          `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory`,
          { headers: { "Content-Type": "application/json" } },
        );
        if (!pollRes.ok) {
          const text = await pollRes.text();
          throw new Error(`Judge0 poll ${pollRes.status}: ${text.slice(0, 200)}`);
        }
        j = await pollRes.json();
        // status id 1 = In Queue, 2 = Processing; anything >=3 is final
        if (j?.status?.id && j.status.id >= 3) break;
      }
      if (!j || !j.status) throw new Error("Judge0 polling timed out");
      const got = (j.stdout ?? "").trimEnd();
      const expected = (tc.expected_output ?? "").trimEnd();
      const passed = j.status?.id === 3 && got === expected;

      let mappedStatus = "accepted";
      if (j.status?.id === 4) mappedStatus = "wrong_answer";
      else if (j.status?.id === 5) mappedStatus = "time_limit_exceeded";
      else if (j.status?.id === 6) mappedStatus = "compilation_error";
      else if (j.status?.id >= 7 && j.status?.id <= 12) mappedStatus = "runtime_error";
      else if (j.status?.id !== 3) mappedStatus = "internal_error";
      if (!passed && j.status?.id === 3) mappedStatus = "wrong_answer";

      results.push({ input: tc.input, expected, got, passed, status: mappedStatus });
      totalRuntime += Math.round((parseFloat(j.time || "0")) * 1000);
      maxMemory = Math.max(maxMemory, j.memory || 0);

      if (!passed && overall === "accepted") {
        overall = mappedStatus;
        firstError = j.compile_output || j.stderr || j.message || null;
        if (body.mode === "submit") break;
      }
    }

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = body.mode === "run" ? testCases.length : (cases?.length ?? testCases.length);

    // Validate contest window server-side: only count submission for contest if within window
    let validContestId: string | null = null;
    if (body.mode === "submit" && body.contest_id && user) {
      const { data: c } = await admin
        .from("contests")
        .select("id, start_time, end_time")
        .eq("id", body.contest_id)
        .maybeSingle();
      if (c) {
        const now = Date.now();
        const start = new Date(c.start_time).getTime();
        const end = new Date(c.end_time).getTime();
        if (now >= start && now <= end) {
          // Also verify the problem belongs to the contest
          const { data: cp } = await admin
            .from("contest_problems")
            .select("contest_id")
            .eq("contest_id", c.id)
            .eq("problem_id", body.problem_id)
            .maybeSingle();
          if (cp) validContestId = c.id;
        }
      }
    }

    if (body.mode === "submit" && user) {
      const { data: subRow } = await admin.from("submissions").insert({
        user_id: user.id,
        problem_id: body.problem_id,
        contest_id: validContestId,
        language: body.language,
        code: body.code,
        status: overall,
        runtime_ms: totalRuntime,
        memory_kb: maxMemory,
        passed_count: passedCount,
        total_count: totalCount,
        error_message: firstError,
        score: overall === "accepted" ? 100 : Math.floor((passedCount / Math.max(1, totalCount)) * 100),
      }).select("id").maybeSingle();

      // Run plagiarism check for accepted submissions only
      if (overall === "accepted" && subRow?.id) {
        await runPlagiarismCheck(admin, {
          submission_id: subRow.id,
          user_id: user.id,
          problem_id: body.problem_id,
          contest_id: validContestId,
          language: body.language,
          code: body.code,
        });
      }

      if (overall === "accepted") {
        const { data: prev } = await admin
          .from("submissions")
          .select("id")
          .eq("user_id", user.id)
          .eq("problem_id", body.problem_id)
          .eq("status", "accepted")
          .limit(2);
        if ((prev?.length ?? 0) <= 1) {
          const { data: stats } = await admin.from("user_stats").select("*").eq("user_id", user.id).maybeSingle();
          const today = new Date().toISOString().slice(0, 10);
          const last = stats?.last_active_date;
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          const newStreak = last === today ? stats?.streak ?? 1 : last === yesterday ? (stats?.streak ?? 0) + 1 : 1;
          const newXp = (stats?.xp ?? 0) + 10;
          await admin.from("user_stats").update({
            xp: newXp,
            level: Math.floor(newXp / 100) + 1,
            streak: newStreak,
            longest_streak: Math.max(stats?.longest_streak ?? 0, newStreak),
            last_active_date: today,
            problems_solved: (stats?.problems_solved ?? 0) + 1,
          }).eq("user_id", user.id);
        }
      }
    }

    return new Response(JSON.stringify({
      status: overall,
      passed_count: passedCount,
      total_count: totalCount,
      runtime_ms: totalRuntime,
      memory_kb: maxMemory,
      error_message: firstError,
      cases: body.mode === "run" ? results : results.slice(0, 1),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});