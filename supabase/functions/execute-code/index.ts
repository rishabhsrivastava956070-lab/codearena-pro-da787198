import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDGE0_BASE = "https://ce.judge0.com";
const LANG_ID: Record<string, number> = { cpp: 54, java: 62, python: 71, javascript: 63 };

type SubmitBody = { problem_id: string; language: string; code: string; mode: "run" | "submit" };

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

    if (body.mode === "submit" && user) {
      await admin.from("submissions").insert({
        user_id: user.id,
        problem_id: body.problem_id,
        language: body.language,
        code: body.code,
        status: overall,
        runtime_ms: totalRuntime,
        memory_kb: maxMemory,
        passed_count: passedCount,
        total_count: totalCount,
        error_message: firstError,
        score: overall === "accepted" ? 100 : Math.floor((passedCount / Math.max(1, totalCount)) * 100),
      });

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