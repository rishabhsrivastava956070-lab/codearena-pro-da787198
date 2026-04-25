import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, CheckCircle2, Circle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Problem = {
  id: string;
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
};

export default function ProblemsList() {
  const { user } = useAuth();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());
  const [daily, setDaily] = useState<Problem | null>(null);
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("problems")
        .select("id, slug, title, difficulty, tags")
        .eq("is_published", true)
        .order("created_at", { ascending: true });
      setProblems((data as Problem[]) || []);

      const today = new Date().toISOString().slice(0, 10);
      const { data: dc } = await supabase
        .from("daily_challenges")
        .select("problems(id, slug, title, difficulty, tags)")
        .eq("date", today)
        .maybeSingle();
      if (dc?.problems) setDaily(dc.problems as unknown as Problem);

      if (user) {
        const { data: subs } = await supabase
          .from("submissions")
          .select("problem_id")
          .eq("user_id", user.id)
          .eq("status", "accepted");
        setSolvedIds(new Set((subs || []).map((s: { problem_id: string }) => s.problem_id)));
      }
      setLoading(false);
    })();
  }, [user]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    problems.forEach((p) => p.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [problems]);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      if (q && !p.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (diff !== "all" && p.difficulty !== diff) return false;
      if (tag !== "all" && !p.tags?.includes(tag)) return false;
      if (status === "solved" && !solvedIds.has(p.id)) return false;
      if (status === "unsolved" && solvedIds.has(p.id)) return false;
      return true;
    });
  }, [problems, q, diff, tag, status, solvedIds]);

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-1">Problems</h1>
      <p className="text-muted-foreground mb-6">Sharpen your skills, one challenge at a time.</p>

      {daily && (
        <Card className="p-4 mb-6 border-primary/30 bg-primary/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-md gradient-primary flex items-center justify-center shadow-glow">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-primary">Daily Challenge · +50 XP</div>
                <div className="font-semibold">{daily.title}</div>
              </div>
            </div>
            <Button asChild size="sm">
              <Link to={`/problems/${daily.slug}`}>Solve now</Link>
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search problems…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={diff} onValueChange={setDiff}>
          <SelectTrigger className="md:w-[140px]"><SelectValue placeholder="Difficulty" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulty</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="md:w-[160px]"><SelectValue placeholder="Tag" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {allTags.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="solved">Solved</SelectItem>
            <SelectItem value="unsolved">Unsolved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_120px_1fr] gap-4 px-4 py-3 border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <div></div>
          <div>Title</div>
          <div>Difficulty</div>
          <div className="hidden md:block">Tags</div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No problems match your filters.</div>
        ) : (
          filtered.map((p, i) => (
            <Link
              key={p.id}
              to={`/problems/${p.slug}`}
              className={`grid grid-cols-[40px_1fr_120px_1fr] gap-4 px-4 py-3 items-center hover:bg-secondary/40 transition-colors ${
                i !== filtered.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div>
                {solvedIds.has(p.id) ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50" />
                )}
              </div>
              <div className="font-medium">{p.title}</div>
              <div><DifficultyBadge difficulty={p.difficulty} /></div>
              <div className="hidden md:flex flex-wrap gap-1">
                {p.tags?.slice(0, 3).map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}