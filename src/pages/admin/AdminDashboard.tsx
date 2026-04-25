import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { Users, ListChecks, Inbox, Activity, Clock, ShieldAlert } from "lucide-react";

type Stats = {
  users: number;
  problems: number;
  submissions: number;
  pending: number;
  daily: number;
  weekly: number;
};

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: number | string; hint?: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-3xl font-semibold mt-1 tabular-nums">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const [u, p, s, pend, d, w] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("problems").select("id", { count: "exact", head: true }),
        supabase.from("submissions").select("id", { count: "exact", head: true }),
        supabase.from("problems").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("submissions").select("user_id", { count: "exact", head: true }).gte("created_at", dayAgo),
        supabase.from("submissions").select("user_id", { count: "exact", head: true }).gte("created_at", weekAgo),
      ]);
      setStats({
        users: u.count || 0,
        problems: p.count || 0,
        submissions: s.count || 0,
        pending: pend.count || 0,
        daily: d.count || 0,
        weekly: w.count || 0,
      });
    })();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform overview at a glance.</p>
      </div>
      {!stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={Users} label="Total Users" value={stats.users} />
          <StatCard icon={ListChecks} label="Total Problems" value={stats.problems} />
          <StatCard icon={Inbox} label="Total Submissions" value={stats.submissions} />
          <StatCard icon={ShieldAlert} label="Pending Approval" value={stats.pending} hint="Problems awaiting review" />
          <StatCard icon={Activity} label="Active (24h)" value={stats.daily} hint="Submissions in last 24 hours" />
          <StatCard icon={Clock} label="Active (7d)" value={stats.weekly} hint="Submissions in last 7 days" />
        </div>
      )}
    </div>
  );
}