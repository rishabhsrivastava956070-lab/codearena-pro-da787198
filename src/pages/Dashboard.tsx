import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, Trophy, Target, Zap, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heatmap } from "@/components/dashboard/Heatmap";

type Stats = { xp: number; level: number; streak: number; longest_streak: number; problems_solved: number };
type RecentSub = {
  id: string;
  status: string;
  created_at: string;
  language: string;
  problems: { title: string; slug: string; difficulty: string } | null;
};

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentSub[]>([]);
  const [heat, setHeat] = useState<{ date: string; count: number }[]>([]);
  const [byDifficulty, setByDifficulty] = useState({ easy: 0, medium: 0, hard: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: s } = await supabase.from("user_stats").select("*").eq("user_id", user.id).maybeSingle();
      setStats(s as Stats | null);

      const { data: r } = await supabase
        .from("submissions")
        .select("id, status, created_at, language, problems(title, slug, difficulty)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setRecent((r as unknown as RecentSub[]) || []);

      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data: all } = await supabase
        .from("submissions")
        .select("created_at, status, problem_id, problems(difficulty)")
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString());
      const counts = new Map<string, number>();
      const solved = new Map<string, "easy" | "medium" | "hard">();
      (all || []).forEach((sub: { created_at: string; status: string; problem_id: string; problems?: { difficulty: string } | null }) => {
        const day = sub.created_at.slice(0, 10);
        counts.set(day, (counts.get(day) || 0) + 1);
        if (sub.status === "accepted" && sub.problems?.difficulty) {
          solved.set(sub.problem_id, sub.problems.difficulty as "easy" | "medium" | "hard");
        }
      });
      setHeat(Array.from(counts.entries()).map(([date, count]) => ({ date, count })));
      const buckets = { easy: 0, medium: 0, hard: 0 };
      solved.forEach((d) => buckets[d]++);
      setByDifficulty(buckets);
    })();
  }, [user]);

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome back, {profile?.display_name || profile?.username} 👋</h1>
        <p className="text-muted-foreground">Here's your coding journey at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Solved" value={stats?.problems_solved ?? 0} accent="text-primary" />
        <StatCard icon={Zap} label="XP" value={stats?.xp ?? 0} accent="text-accent" />
        <StatCard icon={Flame} label="Streak" value={`${stats?.streak ?? 0}d`} accent="text-difficulty-medium" />
        <StatCard icon={Target} label="Level" value={stats?.level ?? 1} accent="text-success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Activity</h2>
            <span className="text-xs text-muted-foreground">Last 12 months</span>
          </div>
          <Heatmap data={heat} />
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold mb-4">Solved by difficulty</h2>
          <div className="space-y-3">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <div key={d}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize">{d}</span>
                  <span className="text-muted-foreground">{byDifficulty[d]}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full ${d === "easy" ? "bg-difficulty-easy" : d === "medium" ? "bg-difficulty-medium" : "bg-difficulty-hard"}`}
                    style={{ width: `${Math.min(100, byDifficulty[d] * 10)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">Recent submissions</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet — <Link to="/problems" className="text-primary hover:underline">solve your first problem</Link>.</p>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <Link key={s.id} to={`/problems/${s.problems?.slug}`} className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-secondary/40 transition-colors">
                <div className="flex items-center gap-3">
                  {s.status === "accepted" ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Target className="h-4 w-4 text-destructive" />}
                  <div>
                    <div className="font-medium text-sm">{s.problems?.title}</div>
                    <div className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{s.language}</Badge>
                  <span className={`text-xs ${s.status === "accepted" ? "text-success" : "text-destructive"}`}>{s.status.replace(/_/g, " ")}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

const StatCard = ({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; accent: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wide">
      <Icon className={`h-3.5 w-3.5 ${accent}`} /> {label}
    </div>
    <div className="mt-1 text-2xl font-bold">{value}</div>
  </Card>
);