import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Trophy, Clock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { toast } from "sonner";

type Contest = { id: string; slug: string; title: string; description: string | null; start_time: string; end_time: string };
type CP = { points: number; problems: { id: string; slug: string; title: string; difficulty: string } };
type Participant = { user_id: string; score: number; penalty: number; profiles: { username: string | null; display_name: string | null; avatar_url: string | null } | null };

export default function ContestDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [problems, setProblems] = useState<CP[]>([]);
  const [board, setBoard] = useState<Participant[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: c } = await supabase.from("contests").select("*").eq("slug", slug).maybeSingle();
      if (!c) return;
      setContest(c as Contest);
      const { data: ps } = await supabase
        .from("contest_problems")
        .select("points, problems(id, slug, title, difficulty)")
        .eq("contest_id", c.id)
        .order("ordering");
      setProblems((ps as unknown as CP[]) || []);

      const fetchBoard = async () => {
        const { data: bp } = await supabase
          .from("contest_participants")
          .select("user_id, score, penalty, profiles(username, display_name, avatar_url)")
          .eq("contest_id", c.id)
          .order("score", { ascending: false })
          .order("penalty", { ascending: true });
        setBoard((bp as unknown as Participant[]) || []);
      };
      fetchBoard();

      const ch = supabase
        .channel(`contest-${c.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "contest_participants", filter: `contest_id=eq.${c.id}` }, fetchBoard)
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
  }, [slug]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const status = useMemo(() => {
    if (!contest) return null;
    const start = new Date(contest.start_time).getTime();
    const end = new Date(contest.end_time).getTime();
    if (now < start) return { label: "Starts in", target: start, color: "text-info" };
    if (now > end) return { label: "Ended", target: 0, color: "text-muted-foreground" };
    return { label: "Time remaining", target: end, color: "text-success" };
  }, [contest, now]);

  const remaining = status?.target ? Math.max(0, status.target - now) : 0;
  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600).toString().padStart(2, "0");
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  const join = async () => {
    if (!user || !contest) return;
    const { error } = await supabase.from("contest_participants").insert({ contest_id: contest.id, user_id: user.id });
    if (error && !error.message.includes("duplicate")) return toast.error(error.message);
    toast.success("Joined contest!");
  };

  if (!contest) return <div className="container py-12 text-muted-foreground">Loading…</div>;

  const joined = board.some((b) => b.user_id === user?.id);

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{contest.title}</h1>
          {contest.description && <p className="text-muted-foreground mt-1">{contest.description}</p>}
        </div>
        <Card className="px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {status?.label}
          </div>
          <div className={`text-2xl font-mono font-bold ${status?.color}`}>{status?.target ? fmt(remaining) : "—"}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Problems</h2>
            {user && !joined && <Button size="sm" onClick={join}>Join contest</Button>}
          </div>
          {problems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No problems added yet.</p>
          ) : (
            <div className="space-y-2">
              {problems.map((cp, i) => (
                <Link key={cp.problems.id} to={`/problems/${cp.problems.slug}`} className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-secondary/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground font-mono w-6">{String.fromCharCode(65 + i)}</span>
                    <span className="font-medium">{cp.problems.title}</span>
                    <DifficultyBadge difficulty={cp.problems.difficulty} />
                  </div>
                  <Badge variant="secondary">{cp.points} pts</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" /> Leaderboard</h2>
          {board.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Be the first to join.</div>
          ) : (
            <div className="space-y-2">
              {board.slice(0, 20).map((p, i) => (
                <div key={p.user_id} className={`flex items-center justify-between rounded-md p-2 text-sm ${p.user_id === user?.id ? "bg-primary/10 border border-primary/30" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-6 text-center font-bold ${i === 0 ? "text-primary" : i < 3 ? "text-accent" : "text-muted-foreground"}`}>#{i + 1}</span>
                    <span className="font-medium">{p.profiles?.display_name || p.profiles?.username || "Anonymous"}</span>
                  </div>
                  <div className="text-xs">
                    <span className="font-bold">{p.score}</span>
                    <span className="text-muted-foreground"> · {p.penalty}m</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}