import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Contest = { id: string; slug: string; title: string; description: string | null; start_time: string; end_time: string };

export default function ContestsList() {
  const [contests, setContests] = useState<Contest[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("contests").select("*").order("start_time", { ascending: false });
      setContests((data as Contest[]) || []);
    })();
  }, []);

  const now = Date.now();
  const tag = (c: Contest) => {
    const start = new Date(c.start_time).getTime();
    const end = new Date(c.end_time).getTime();
    if (now < start) return { label: "Upcoming", cls: "bg-info/15 text-info border-info/30" };
    if (now > end) return { label: "Ended", cls: "bg-muted text-muted-foreground border-border" };
    return { label: "Live", cls: "bg-success/15 text-success border-success/30 animate-pulse" };
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-1">Contests</h1>
      <p className="text-muted-foreground mb-6">Compete in real-time and climb the leaderboard.</p>

      {contests.length === 0 ? (
        <Card className="p-12 text-center">
          <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No contests yet. Admins can create one from the admin panel.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contests.map((c) => {
            const t = tag(c);
            return (
              <Link key={c.id} to={`/contests/${c.slug}`}>
                <Card className="p-5 hover:border-primary/40 transition-colors h-full">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold text-lg">{c.title}</h3>
                    <Badge variant="outline" className={t.cls}>{t.label}</Badge>
                  </div>
                  {c.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{c.description}</p>}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    Starts {formatDistanceToNow(new Date(c.start_time), { addSuffix: true })}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}