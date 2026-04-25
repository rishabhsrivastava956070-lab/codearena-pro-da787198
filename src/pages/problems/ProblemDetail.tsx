import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2, Play, Send, Sparkles, CheckCircle2, XCircle, Clock, Trophy, FlaskConical, History as HistoryIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeEditor, type Lang } from "@/components/editor/CodeEditor";
import { useCodeAutosave, loadDraft } from "@/hooks/useCodeAutosave";
import { VersionHistoryPanel } from "@/components/problems/VersionHistoryPanel";
import { toast } from "sonner";

type Problem = {
  id: string;
  title: string;
  slug: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  constraints: string | null;
  input_format: string | null;
  output_format: string | null;
  starter_code: Record<Lang, string>;
  time_limit_ms: number;
  memory_limit_mb: number;
};
type TestCase = { id: string; input: string; expected_output: string; explanation: string | null };
type Submission = {
  id: string;
  status: string;
  language: string;
  runtime_ms: number | null;
  passed_count: number | null;
  total_count: number | null;
  error_message: string | null;
  created_at: string;
};
type RunResult = {
  status: string;
  passed_count: number;
  total_count: number;
  runtime_ms?: number;
  memory_kb?: number;
  error_message?: string;
  cases?: { input: string; expected: string; got: string; passed: boolean; status: string }[];
};
type CustomResult = {
  status: string;
  stdout: string;
  stderr: string;
  runtime_ms: number;
  memory_kb: number;
};

export default function ProblemDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const contestId = searchParams.get("contest"); // present when entering from a live contest
  const { user } = useAuth();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [samples, setSamples] = useState<TestCase[]>([]);
  const [language, setLanguage] = useState<Lang>("python");
  const [code, setCode] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string>("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [history, setHistory] = useState<Submission[]>([]);
  // Custom test panel state
  const [customStdin, setCustomStdin] = useState<string>("");
  const [customResult, setCustomResult] = useState<CustomResult | null>(null);
  const [customRunning, setCustomRunning] = useState(false);
  const [outputTab, setOutputTab] = useState<string>("result");

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: p } = await supabase.from("problems").select("*").eq("slug", slug).maybeSingle();
      if (!p) return;
      setProblem(p as unknown as Problem);
      const { data: tc } = await supabase
        .from("test_cases")
        .select("id, input, expected_output, explanation")
        .eq("problem_id", p.id)
        .eq("is_sample", true)
        .order("ordering");
      setSamples((tc as TestCase[]) || []);

      const starter = (p.starter_code as Record<string, string>) || {};
      const initLang: Lang = (starter.python ? "python" : (Object.keys(starter)[0] as Lang)) || "python";
      setLanguage(initLang);
      setCode(starter[initLang] || "");
    })();
  }, [slug]);

  useEffect(() => {
    if (problem && (problem.starter_code as Record<string, string>)?.[language] !== undefined) {
      // Prefer cloud draft (when signed in), else localStorage fallback, else starter code.
      (async () => {
        if (user) {
          const draft = await loadDraft(user.id, problem.id, language);
          if (draft?.code) {
            setCode(draft.code);
            return;
          }
        }
        const saved = localStorage.getItem(`code:${problem.id}:${language}`);
        setCode(saved ?? (problem.starter_code as Record<string, string>)[language] ?? "");
      })();
    }
  }, [language, problem, user]);

  useEffect(() => {
    if (problem && code) localStorage.setItem(`code:${problem.id}:${language}`, code);
  }, [code, language, problem]);

  // Cloud autosave (debounced) for signed-in users
  useCodeAutosave({ userId: user?.id, problemId: problem?.id, language, code });

  useEffect(() => {
    if (!problem || !user) return;
    (async () => {
      const { data } = await supabase
        .from("submissions")
        .select("id, status, language, runtime_ms, passed_count, total_count, error_message, created_at")
        .eq("problem_id", problem.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setHistory((data as Submission[]) || []);
    })();
  }, [problem, user, result]);

  const callExec = async (mode: "run" | "submit") => {
    if (!problem) return;
    if (mode === "submit" && !user) {
      navigate(`/auth?next=/problems/${problem.slug}`);
      return;
    }
    const setBusy = mode === "run" ? setRunning : setSubmitting;
    setBusy(true);
    setResult(null);
    setOutputTab("result");
    try {
      const { data, error } = await supabase.functions.invoke("execute-code", {
        body: {
          problem_id: problem.id,
          language,
          code,
          mode,
          ...(mode === "submit" && contestId ? { contest_id: contestId } : {}),
        },
      });
      if (error) {
        // Surface server-side rate-limit specifically
        const msg = (error as { message?: string }).message || "Execution failed";
        if (msg.toLowerCase().includes("rate") || msg.includes("429")) {
          toast.error("Too many submissions. Wait a moment and retry.");
        } else {
          toast.error(msg);
        }
        throw error;
      }

      if (mode === "run") {
        setResult(data as RunResult);
        return;
      }

      // SUBMIT: server returns { status: "queued", submission_id }. Watch realtime.
      const queued = data as { status: string; submission_id?: string };
      if (queued.status !== "queued" || !queued.submission_id) {
        // Backwards-compat fallback: treat as final result
        setResult(data as RunResult);
        return;
      }
      setResult({
        status: "queued",
        passed_count: 0,
        total_count: 0,
      });
      toast.message("Submission queued — judging in progress…");
      await waitForSubmissionResult(queued.submission_id);
    } catch (err: unknown) {
      // Already toasted above for known cases; swallow here
      console.error("submit failed", err);
    } finally {
      setBusy(false);
    }
  };

  // Subscribe to the submissions row and resolve when it reaches a final state
  const waitForSubmissionResult = (submissionId: string) =>
    new Promise<void>((resolve) => {
      const TERMINAL = new Set([
        "accepted", "wrong_answer", "time_limit_exceeded",
        "compilation_error", "runtime_error", "memory_limit_exceeded", "internal_error",
      ]);

      const finalize = (row: {
        status: string;
        passed_count: number | null;
        total_count: number | null;
        runtime_ms: number | null;
        memory_kb: number | null;
        error_message: string | null;
      }) => {
        const final: RunResult = {
          status: row.status,
          passed_count: row.passed_count ?? 0,
          total_count: row.total_count ?? 0,
          runtime_ms: row.runtime_ms ?? undefined,
          memory_kb: row.memory_kb ?? undefined,
          error_message: row.error_message ?? undefined,
        };
        setResult(final);
        if (row.status === "accepted") {
          toast.success(`Accepted! ${final.passed_count}/${final.total_count} tests passed`);
        } else {
          toast.error(row.status.replace(/_/g, " "));
        }
      };

      const channel = supabase
        .channel(`submission-${submissionId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "submissions", filter: `id=eq.${submissionId}` },
          (payload) => {
            const row = payload.new as {
              status: string;
              passed_count: number | null;
              total_count: number | null;
              runtime_ms: number | null;
              memory_kb: number | null;
              error_message: string | null;
            };
            if (TERMINAL.has(row.status)) {
              finalize(row);
              supabase.removeChannel(channel);
              clearInterval(pollId);
              clearTimeout(timeoutId);
              resolve();
            }
          },
        )
        .subscribe();

      // Backup poll every 3s in case the realtime event is missed
      const pollId = setInterval(async () => {
        const { data: row } = await supabase
          .from("submissions")
          .select("status, passed_count, total_count, runtime_ms, memory_kb, error_message")
          .eq("id", submissionId)
          .maybeSingle();
        if (row && TERMINAL.has(row.status)) {
          finalize(row);
          supabase.removeChannel(channel);
          clearInterval(pollId);
          clearTimeout(timeoutId);
          resolve();
        }
      }, 3000);

      // Hard cap: 2 minutes
      const timeoutId = setTimeout(() => {
        supabase.removeChannel(channel);
        clearInterval(pollId);
        toast.error("Judging is taking longer than expected. Check Submissions tab shortly.");
        resolve();
      }, 120_000);
    });

  const runCustom = async () => {
    if (!problem) return;
    setCustomRunning(true);
    setCustomResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("execute-code", {
        body: { problem_id: problem.id, language, code, mode: "custom", stdin: customStdin },
      });
      if (error) throw error;
      setCustomResult(data as CustomResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Execution failed";
      toast.error(msg);
    } finally {
      setCustomRunning(false);
    }
  };

  const aiReview = async () => {
    if (!problem) return;
    setAiReviewing(true);
    setAiFeedback("");
    setOutputTab("ai");
    try {
      const { data, error } = await supabase.functions.invoke("ai-code-review", {
        body: { problem_title: problem.title, problem_description: problem.description, language, code },
      });
      if (error) throw error;
      setAiFeedback((data as { feedback: string }).feedback);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI review failed";
      toast.error(msg);
    } finally {
      setAiReviewing(false);
    }
  };

  const PENDING = new Set(["queued", "pending", "running"]);
  const statusColor = (s: string) => {
    if (s === "accepted") return "text-success";
    if (PENDING.has(s)) return "text-muted-foreground";
    return "text-destructive";
  };
  const StatusIcon = ({ s }: { s: string }) =>
    s === "accepted" ? <CheckCircle2 className="h-4 w-4 text-success" /> :
    PENDING.has(s) ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" /> :
    <XCircle className="h-4 w-4 text-destructive" />;

  const langs: Lang[] = useMemo(() => (problem ? (Object.keys(problem.starter_code) as Lang[]) : ["python"]), [problem]);

  if (!problem) {
    return <div className="container py-12 text-muted-foreground">Loading problem…</div>;
  }

  return (
    <div className="container py-4 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[calc(100vh-3.5rem)]">
      {contestId && (
        <div className="lg:col-span-2 -mb-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 flex items-center gap-2 text-sm text-primary">
          <Trophy className="h-4 w-4" />
          Contest mode — submissions count toward the live leaderboard.
        </div>
      )}
      {/* LEFT: description */}
      <div className="flex flex-col min-h-0">
        <Card className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="desc" className="flex-1 flex flex-col">
            <div className="border-b border-border px-4">
              <TabsList className="bg-transparent p-0 h-11">
                <TabsTrigger value="desc" className="data-[state=active]:bg-transparent">Description</TabsTrigger>
                <TabsTrigger value="subs" className="data-[state=active]:bg-transparent">Submissions</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="desc" className="flex-1 overflow-y-auto p-6 space-y-4 mt-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold">{problem.title}</h1>
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {problem.tags.map((t) => (
                  <Badge key={t} variant="secondary">{t}</Badge>
                ))}
              </div>
              <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-code:text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.description}</ReactMarkdown>
              </div>
              {problem.constraints && (
                <div>
                  <div className="font-semibold text-sm mb-2">Constraints</div>
                  <pre className="bg-secondary border border-border rounded-md p-3 text-xs whitespace-pre-wrap font-mono">{problem.constraints}</pre>
                </div>
              )}
              {samples.length > 0 && (
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Sample Tests</div>
                  {samples.map((s, i) => (
                    <div key={s.id} className="rounded-md border border-border bg-secondary/40 p-3 text-xs">
                      <div className="text-muted-foreground mb-1">Example {i + 1}</div>
                      <div className="font-mono"><span className="text-muted-foreground">Input:</span><pre className="whitespace-pre-wrap">{s.input}</pre></div>
                      <div className="font-mono mt-2"><span className="text-muted-foreground">Output:</span><pre className="whitespace-pre-wrap">{s.expected_output}</pre></div>
                      {s.explanation && <div className="mt-2 text-muted-foreground">{s.explanation}</div>}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="subs" className="flex-1 overflow-y-auto p-4 mt-0">
              {!user ? (
                <p className="text-sm text-muted-foreground">Sign in to view your submissions.</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No submissions yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <StatusIcon s={s.status} />
                        <span className={statusColor(s.status)}>{s.status.replace(/_/g, " ")}</span>
                        <Badge variant="outline" className="text-xs">{s.language}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {s.passed_count ?? 0}/{s.total_count ?? 0}
                        {s.runtime_ms !== null && <> · {s.runtime_ms}ms</>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      {/* RIGHT: editor */}
      <div className="flex flex-col gap-4 min-h-0">
        <Card className="flex-1 flex flex-col overflow-hidden min-h-[300px]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <Select value={language} onValueChange={(v) => setLanguage(v as Lang)}>
              <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {langs.map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={aiReview} disabled={aiReviewing}>
                {aiReviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                <span className="ml-1">AI Review</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => callExec("run")} disabled={running || submitting}>
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                <span className="ml-1">Run</span>
              </Button>
              <Button size="sm" onClick={() => callExec("submit")} disabled={running || submitting}>
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span className="ml-1">Submit</span>
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor value={code} onChange={setCode} language={language} />
          </div>
        </Card>

        <Card className="overflow-hidden max-h-[45vh] flex flex-col">
          <Tabs value={outputTab} onValueChange={setOutputTab} className="flex-1 flex flex-col">
            <div className="border-b border-border px-3">
              <TabsList className="bg-transparent p-0 h-10">
                <TabsTrigger value="result" className="data-[state=active]:bg-transparent text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Result
                </TabsTrigger>
                <TabsTrigger value="custom" className="data-[state=active]:bg-transparent text-xs">
                  <FlaskConical className="h-3.5 w-3.5 mr-1" /> Custom
                </TabsTrigger>
                <TabsTrigger value="ai" className="data-[state=active]:bg-transparent text-xs">
                  <Sparkles className="h-3.5 w-3.5 mr-1" /> AI
                </TabsTrigger>
                <TabsTrigger value="versions" className="data-[state=active]:bg-transparent text-xs">
                  <HistoryIcon className="h-3.5 w-3.5 mr-1" /> Versions
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="result" className="flex-1 overflow-y-auto p-4 mt-0 text-sm space-y-3">
              {!result && <div className="text-muted-foreground">Run your code to see output here.</div>}
              {result && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon s={result.status} />
                    <span className={`font-semibold ${statusColor(result.status)}`}>{result.status.replace(/_/g, " ")}</span>
                    <span className="text-muted-foreground text-xs">
                      {result.passed_count}/{result.total_count} cases
                      {result.runtime_ms !== undefined && <> · {result.runtime_ms}ms</>}
                    </span>
                  </div>
                  {result.error_message && (
                    <pre className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-2 text-xs whitespace-pre-wrap">{result.error_message}</pre>
                  )}
                  {result.cases?.map((c, i) => (
                    <div key={i} className={`rounded-md border p-2 text-xs ${c.passed ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                      <div className="flex items-center gap-2 font-semibold mb-1">
                        {c.passed ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-destructive" />}
                        Case {i + 1}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 font-mono">
                        <div><div className="text-muted-foreground">Input</div><pre className="whitespace-pre-wrap">{c.input}</pre></div>
                        <div><div className="text-muted-foreground">Expected</div><pre className="whitespace-pre-wrap">{c.expected}</pre></div>
                        <div><div className="text-muted-foreground">Got</div><pre className="whitespace-pre-wrap">{c.got || "—"}</pre></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="flex-1 overflow-y-auto p-4 mt-0 text-sm space-y-3">
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Custom stdin</div>
                <Textarea
                  value={customStdin}
                  onChange={(e) => setCustomStdin(e.target.value)}
                  placeholder="Paste any input you'd like to test against…"
                  className="font-mono text-xs min-h-[80px]"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={runCustom} disabled={customRunning}>
                    {customRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    <span className="ml-1">Run with input</span>
                  </Button>
                </div>
              </div>
              {customResult && (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon s={customResult.status} />
                    <span className={`font-semibold ${statusColor(customResult.status)}`}>
                      {customResult.status.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {customResult.runtime_ms}ms · {Math.round(customResult.memory_kb / 1024)}MB
                    </span>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">stdout</div>
                    <pre className="bg-muted/50 rounded p-2 text-xs whitespace-pre-wrap font-mono max-h-40 overflow-auto">
                      {customResult.stdout || "—"}
                    </pre>
                  </div>
                  {customResult.stderr && (
                    <div>
                      <div className="text-xs text-destructive mb-1">stderr</div>
                      <pre className="bg-destructive/10 border border-destructive/30 text-destructive rounded p-2 text-xs whitespace-pre-wrap font-mono max-h-40 overflow-auto">
                        {customResult.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="ai" className="flex-1 overflow-y-auto p-4 mt-0 text-sm">
              {aiReviewing && !aiFeedback && (
                <div className="text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing your code…
                </div>
              )}
              {!aiReviewing && !aiFeedback && (
                <div className="text-muted-foreground">
                  Click <span className="font-medium">AI Review</span> to get an explanation, complexity estimate, and improvement suggestions.
                </div>
              )}
              {aiFeedback && (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiFeedback}</ReactMarkdown>
                </div>
              )}
            </TabsContent>

            <TabsContent value="versions" className="flex-1 overflow-hidden mt-0">
              <VersionHistoryPanel
                userId={user?.id}
                problemId={problem.id}
                language={language}
                currentCode={code}
                onRestore={(c, l) => {
                  setLanguage(l as Lang);
                  setCode(c);
                  toast.success("Restored from snapshot");
                }}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}