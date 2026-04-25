import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDGE0_BASE = "https://ce.judge0.com";
const LANG_ID: Record<string, number> = { cpp: 54, java: 62, python: 71, javascript: 63 };

const BATCH_SIZE = 4; // claim up to N jobs per worker tick
const LOCK_SECONDS = 90;
const MAX_POLL_ATTEMPTS = 20;
const POLL_DELAY_MS = 700;

// ---- shared plagiarism check (mirror of execute-code) ----
function normalizeCode(src: string, lang: string): string {
  let s = src;
  s = s.replace(/\/\*[\s\S]*?\*\//g, " ");
  if (lang === "python") {
    s = s.replace(/(^|\n)\s*#[^\n]*/g, "$1");
    s = s.replace(/"""[\s\S]*?"""|'''[\s\S]*?'''/g, " ");
  } else {
    s = s.replace(/\/\/[^\n]*/g, " ");
  }
  s = s.replace(/"(?:\\.|[^"\\])*"/g, '""').replace(/'(?:\\.|[^'\\])*'/g, "''");
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}
function tokenSet(src: string): Set<string> {
  const tokens = src.match(/[a-z_][a-z0-9_]*|[0-9]+|[^\s\w]/gi) ?? [];
  const sh = new Set<string>();
  for (let i = 0; i + 3 <= tokens.length; i++) sh.add(tokens.slice(i, i + 3).join("|"));
  if (sh.size === 0) tokens.forEach((t) => sh.add(t));
  return sh;
}
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [s, b2] = a.size < b.size ? [a, b] : [b, a];
  for (const t of s) if (b2.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
async function runPlagiarismCheck(admin: any, p: { submission_id: string; user_id: string; problem_id: string; contest_id: string | null; language: string; code: string; }) {
  try {
    const norm = normalizeCode(p.code, p.language);
    if (norm.length < 40) return;
    const tokens = tokenSet(norm);
    let q = admin.from("submissions")
      .select("id, user_id, code, contest_id, created_at")
      .eq("problem_id", p.problem_id).eq("language", p.language).eq("status", "accepted")
      .neq("user_id", p.user_id).order("created_at", { ascending: false }).limit(200);
    if (p.contest_id) q = q.eq("contest_id", p.contest_id);
    const { data: others } = await q;
    if (!others?.length) return;
    let best = { sim: 0, sub: null as any };
    for (const o of others) {
      const sim = jaccard(tokens, tokenSet(normalizeCode(o.code, p.language)));
      if (sim > best.sim) best = { sim, sub: o };
    }
    if (best.sim >= 0.8 && best.sub) {
      await admin.from("plagiarism_reports").insert({
        submission_id: p.submission_id, matched_submission_id: best.sub.id,
        user_id: p.user_id, matched_user_id: best.sub.user_id,
        problem_id: p.problem_id, contest_id: p.contest_id,
        similarity: Math.round(best.sim * 10000) / 10000, language: p.language,
      });
    }
  } catch (e) { console.error("plagiarism check failed", e); }
}

// ---- core judge: run all hidden test cases for a submission ----
async function judgeSubmission(admin: any, job: any) {
  const { data: prob } = await admin
    .from("problems")
    .select("id, time_limit_ms, memory_limit_mb")
    .eq("id", job.problem_id).maybeSingle();
  if (!prob) throw new Error("Problem not found");

  const { data: cases } = await admin
    .from("test_cases")
    .select("input, expected_output, is_sample")
    .eq("problem_id", job.problem_id)
    .order("ordering");
  const testCases = cases ?? [];
  if (testCases.length === 0) throw new Error("No test cases");

  let overall = "accepted";
  let totalRuntime = 0;
  let maxMemory = 0;
  let firstError: string | null = null;
  let passedCount = 0;

  for (const tc of testCases) {
    const submission = {
      source_code: job.code,
      language_id: LANG_ID[job.language],
      stdin: tc.input,
      expected_output: tc.expected_output,
      cpu_time_limit: Math.max(1, Math.ceil((prob.time_limit_ms ?? 2000) / 1000)),
      memory_limit: (prob.memory_limit_mb ?? 256) * 1024,
    };
    const submitRes = await fetch(`${JUDGE0_BASE}/submissions?base64_encoded=false&wait=false`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(submission),
    });
    if (!submitRes.ok) {
      const t = await submitRes.text();
      throw new Error(`Judge0 submit ${submitRes.status}: ${t.slice(0, 200)}`);
    }
    const { token } = await submitRes.json();
    if (!token) throw new Error("Judge0 returned no token");

    let j: any = null;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
      const pollRes = await fetch(
        `${JUDGE0_BASE}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,compile_output,message,status,time,memory`,
        { headers: { "Content-Type": "application/json" } },
      );
      if (!pollRes.ok) throw new Error(`Judge0 poll ${pollRes.status}`);
      j = await pollRes.json();
      if (j?.status?.id && j.status.id >= 3) break;
    }
    if (!j?.status) throw new Error("Judge0 polling timed out");

    const got = (j.stdout ?? "").trimEnd();
    const expected = (tc.expected_output ?? "").trimEnd();
    const passed = j.status?.id === 3 && got === expected;

    let mapped = "accepted";
    if (j.status?.id === 4) mapped = "wrong_answer";
    else if (j.status?.id === 5) mapped = "time_limit_exceeded";
    else if (j.status?.id === 6) mapped = "compilation_error";
    else if (j.status?.id >= 7 && j.status?.id <= 12) mapped = "runtime_error";
    else if (j.status?.id !== 3) mapped = "internal_error";
    if (!passed && j.status?.id === 3) mapped = "wrong_answer";

    if (passed) passedCount++;
    totalRuntime += Math.round(parseFloat(j.time || "0") * 1000);
    maxMemory = Math.max(maxMemory, j.memory || 0);

    if (!passed && overall === "accepted") {
      overall = mapped;
      firstError = j.compile_output || j.stderr || j.message || null;
      break; // submit mode: stop on first failure
    }
  }

  const totalCount = testCases.length;

  // Validate contest window
  let validContestId: string | null = null;
  if (job.contest_id) {
    const { data: c } = await admin
      .from("contests")
      .select("id, start_time, end_time")
      .eq("id", job.contest_id).maybeSingle();
    if (c) {
      const now = Date.now();
      if (now >= new Date(c.start_time).getTime() && now <= new Date(c.end_time).getTime()) {
        const { data: cp } = await admin.from("contest_problems")
          .select("contest_id").eq("contest_id", c.id).eq("problem_id", job.problem_id).maybeSingle();
        if (cp) validContestId = c.id;
      }
    }
  }

  // Update the existing submission row (created when the job was enqueued)
  await admin.from("submissions").update({
    status: overall,
    contest_id: validContestId,
    runtime_ms: totalRuntime,
    memory_kb: maxMemory,
    passed_count: passedCount,
    total_count: totalCount,
    error_message: firstError,
    score: overall === "accepted" ? 100 : Math.floor((passedCount / Math.max(1, totalCount)) * 100),
  }).eq("id", job.submission_id);

  // Plagiarism + XP only on accepted
  if (overall === "accepted") {
    await runPlagiarismCheck(admin, {
      submission_id: job.submission_id,
      user_id: job.user_id,
      problem_id: job.problem_id,
      contest_id: validContestId,
      language: job.language,
      code: job.code,
    });

    const { data: prev } = await admin
      .from("submissions").select("id")
      .eq("user_id", job.user_id).eq("problem_id", job.problem_id).eq("status", "accepted").limit(2);
    if ((prev?.length ?? 0) <= 1) {
      const { data: stats } = await admin.from("user_stats").select("*").eq("user_id", job.user_id).maybeSingle();
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
      }).eq("user_id", job.user_id);
    }
  }
}

async function processJob(admin: any, job: any) {
  try {
    await judgeSubmission(admin, job);
    await admin.from("submission_jobs").update({
      status: "done",
      locked_until: null,
      last_error: null,
    }).eq("id", job.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`Job ${job.id} attempt ${job.attempts} failed:`, msg);
    const giveUp = job.attempts >= job.max_attempts;
    if (giveUp) {
      // Mark submission as internal_error so the user sees a final state
      await admin.from("submissions").update({
        status: "internal_error",
        error_message: msg,
      }).eq("id", job.submission_id);
      await admin.from("submission_jobs").update({
        status: "failed",
        locked_until: null,
        last_error: msg,
      }).eq("id", job.id);
    } else {
      // Exponential backoff: 5s, 20s, 80s ...
      const backoffSec = 5 * Math.pow(4, job.attempts - 1);
      await admin.from("submission_jobs").update({
        status: "queued",
        locked_until: null,
        last_error: msg,
        next_run_at: new Date(Date.now() + backoffSec * 1000).toISOString(),
      }).eq("id", job.id);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: jobs, error } = await admin.rpc("claim_submission_jobs", {
      _limit: BATCH_SIZE,
      _lock_seconds: LOCK_SECONDS,
    });
    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in parallel — Judge0 is the bottleneck per job, not the worker
    await Promise.all(jobs.map((j: any) => processJob(admin, j)));

    return new Response(JSON.stringify({ processed: jobs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "worker failed";
    console.error("judge-worker error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});