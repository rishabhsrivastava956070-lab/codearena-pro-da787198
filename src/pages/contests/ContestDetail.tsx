import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Trophy, Clock, Users, Lock, CheckCircle2, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Contest = { id: string; slug: string; title: string; description: string | null; start_time: string; end_time: string };
type CP = { points: number; problems: { id: string; slug: string; title: string; difficulty: string } };
type Participant = {
  user_id: string;
  score: number;
  penalty: number;
  username: string | null;
  display_name: string | null;
};

export default function ContestDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [contest, setContest] = useState<Contest | null>(null);
  const [problems, setProblems] = useState<CP[]>([]);
  const [board, setBoard] = useState<Participant[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!slug) return;
    let unsub: (() => void) | null = null;
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
          .select("user_id, score, penalty")
          .eq("contest_id", c.id)
          .order("score", { ascending: false })
          .order("penalty", { ascending: true });
        const list = (bp as { user_id: string; score: number; penalty: number }[] | null) || [];
        if (list.length === 0) {
          setBoard([]);
          return;
        }
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", list.map((p) => p.user_id));
        const profMap = new Map((profs || []).map((p: { id: string; username: string | null; display_name: string | null }) => [p.id, p]));
        setBoard(list.map((p) => ({
          ...p,
          username: profMap.get(p.user_id)?.username ?? null,
          display_name: profMap.get(p.user_id)?.display_name ?? null,
        })));
      };
      fetchBoard();

      const ch = supabase
        .channel(`contest-${c.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contest_participants", filter: `contest_id=eq.${c.id}` },
          fetchBoard,
        )
        .subscribe();
      unsub = () => { supabase.removeChannel(ch); };
    })();
    return () => { unsub?.(); };
  }, [slug]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const phase = useMemo<"upcoming" | "live" | "ended" | null>(() => {
    if (!contest) return null;
    const start = new Date(contest.start_time).getTime();
    const end = new Date(contest.end_time).getTime();
    if (now < start) return "upcoming";
    if (now > end) return "ended";
    return "live";
  }, [contest, now]);

  const status = useMemo(() => {
    if (!contest || !phase) return null;
    const start = new Date(contest.start_time).getTime();
    const end = new Date(contest.end_time).getTime();
    if (phase === "upcoming") return { label: "Starts in", target: start, color: "text-info" };
    if (phase === "ended") return { label: "Ended", target: 0, color: "text-muted-foreground" };
    return { label: "Time remaining", target: end, color: "text-success" };
  }, [contest, phase]);

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
  const locked = phase === "upcoming";
  const ended = phase === "ended";

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold">{contest.title}</h1>
            {phase === "live" && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 animate-pulse">
                <Radio className="h-3 w-3 mr-1" /> Live
              </Badge>
            )}
            {phase === "upcoming" && (
              <Badge variant="outline" className="bg-info/10 text-info border-info/30">Upcoming</Badge>
            )}
            {phase === "ended" && (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-border">Ended</Badge>
            )}
          </div>
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
            {user && !joined && phase !== "ended" && (
              <Button size="sm" onClick={join}>Join contest</Button>
            )}
          </div>

          {locked && (
            <div className="rounded-md border border-info/30 bg-info/5 p-3 mb-4 flex items-center gap-2 text-sm text-info">
              <Lock className="h-4 w-4" />
              Problems unlock when the contest starts.
            </div>
          )}
          {ended && (
            <div className="rounded-md border border-border bg-muted/30 p-3 mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Contest ended — submissions no longer count toward the leaderboard, but you can still practice.
            </div>
          )}

          {problems.length === 0 ? (
            <p className="text-sm text-muted-foreground">No problems added yet.</p>
          ) : (
            <div className="space-y-2">
              {problems.map((cp, i) => {
                const inner = (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-mono w-6">{String.fromCharCode(65 + i)}</span>
                      <span className="font-medium">{cp.problems.title}</span>
                      <DifficultyBadge difficulty={cp.problems.difficulty} />
                    </div>
                    <Badge variant="secondary">{cp.points} pts</Badge>
                  </div>
                );
                if (locked) {
                  return (
                    <div key={cp.problems.id} className="flex items-center rounded-md border border-border p-3 opacity-50 cursor-not-allowed">
                      {inner}
                    </div>
                  );
                }
                // Pass contest_id so submissions count toward the leaderboard while live
                const href = phase === "live"
                  ? `/problems/${cp.problems.slug}?contest=${contest.id}`
                  : `/problems/${cp.problems.slug}`;
                return (
                  <Link
                    key={cp.problems.id}
                    to={href}
                    className="flex items-center rounded-md border border-border p-3 hover:bg-secondary/40 transition-colors"
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" /> Leaderboard
            {phase === "live" && <span className="text-xs text-success font-normal">· live</span>}
          </h2>
          {board.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Be the first to join.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Pen.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {board.slice(0, 50).map((p, i) => (
                  <TableRow key={p.user_id} className={p.user_id === user?.id ? "bg-primary/10" : ""}>
                    <TableCell className={`font-bold ${i === 0 ? "text-primary" : i < 3 ? "text-accent" : "text-muted-foreground"}`}>
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">
                      {p.username
                        ? <Link to={`/u/${p.username}`} className="hover:text-primary">{p.display_name || `@${p.username}`}</Link>
                        : (p.display_name || "Anonymous")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{p.score}</TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">{p.penalty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}