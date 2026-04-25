import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Flame, Zap, Target } from "lucide-react";
import { Heatmap } from "@/components/dashboard/Heatmap";

type ProfileData = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const [p, setP] = useState<ProfileData | null>(null);
  const [stats, setStats] = useState<{ xp: number; level: number; streak: number; problems_solved: number } | null>(null);
  const [heat, setHeat] = useState<{ date: string; count: number }[]>([]);

  useEffect(() => {
    if (!username) return;
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (!prof) return;
      setP(prof as ProfileData);
      const { data: s } = await supabase.from("user_stats").select("*").eq("user_id", prof.id).maybeSingle();
      setStats(s as { xp: number; level: number; streak: number; problems_solved: number } | null);
      const since = new Date();
      since.setDate(since.getDate() - 365);
      const { data: subs } = await supabase
        .from("submissions")
        .select("created_at")
        .eq("user_id", prof.id)
        .gte("created_at", since.toISOString());
      const counts = new Map<string, number>();
      (subs || []).forEach((s: { created_at: string }) => {
        const d = s.created_at.slice(0, 10);
        counts.set(d, (counts.get(d) || 0) + 1);
      });
      setHeat(Array.from(counts.entries()).map(([date, count]) => ({ date, count })));
    })();
  }, [username]);

  if (!p) return <div className="container py-12 text-muted-foreground">Loading…</div>;

  const initials = (p.display_name || p.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="container py-8 space-y-6 max-w-4xl">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border border-border">
            <AvatarImage src={p.avatar_url ?? undefined} />
            <AvatarFallback className="bg-secondary">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{p.display_name || p.username}</h1>
            <div className="text-muted-foreground">@{p.username}</div>
            {p.bio && <p className="mt-2 text-sm">{p.bio}</p>}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={Trophy} label="Solved" value={stats?.problems_solved ?? 0} />
        <Stat icon={Zap} label="XP" value={stats?.xp ?? 0} />
        <Stat icon={Flame} label="Streak" value={`${stats?.streak ?? 0}d`} />
        <Stat icon={Target} label="Level" value={stats?.level ?? 1} />
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Activity</h2>
        <Heatmap data={heat} />
      </Card>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) => (
  <Card className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5 text-primary" /> {label}</div>
    <div className="mt-1 text-2xl font-bold">{value}</div>
  </Card>
);