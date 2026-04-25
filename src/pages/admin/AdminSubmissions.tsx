import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Sub = {
  id: string;
  status: string;
  language: string;
  created_at: string;
  user_id: string;
  problem_id: string;
  passed_count: number | null;
  total_count: number | null;
  runtime_ms: number | null;
  problem_title?: string;
  problem_slug?: string;
  username?: string | null;
};

const statusColor: Record<string, string> = {
  accepted: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  wrong_answer: "bg-red-500/15 text-red-500 border-red-500/30",
  runtime_error: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  time_limit_exceeded: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  pending: "bg-muted text-muted-foreground border-border",
};

export default function AdminSubmissions() {
  const [rows, setRows] = useState<Sub[] | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    (async () => {
      const { data: subs } = await supabase
        .from("submissions")
        .select("id, status, language, created_at, user_id, problem_id, passed_count, total_count, runtime_ms")
        .order("created_at", { ascending: false })
        .limit(200);
      const list = (subs as Sub[] | null) || [];
      const userIds = Array.from(new Set(list.map((s) => s.user_id)));
      const probIds = Array.from(new Set(list.map((s) => s.problem_id)));
      const [{ data: profs }, { data: probs }] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("id, username").in("id", userIds) : Promise.resolve({ data: [] }),
        probIds.length ? supabase.from("problems").select("id, title, slug").in("id", probIds) : Promise.resolve({ data: [] }),
      ]);
      const userMap = new Map((profs as { id: string; username: string | null }[] || []).map((p) => [p.id, p]));
      const probMap = new Map((probs as { id: string; title: string; slug: string }[] || []).map((p) => [p.id, p]));
      setRows(list.map((s) => ({
        ...s,
        username: userMap.get(s.user_id)?.username ?? null,
        problem_title: probMap.get(s.problem_id)?.title,
        problem_slug: probMap.get(s.problem_id)?.slug,
      })));
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const ql = q.toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return (
        (r.problem_title || "").toLowerCase().includes(ql) ||
        (r.username || "").toLowerCase().includes(ql)
      );
    });
  }, [rows, q, status]);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Submissions</h1>
        <p className="text-sm text-muted-foreground">Latest 200 submissions across all users.</p>
      </div>
      <div className="flex flex-col md:flex-row gap-2">
        <Input className="md:max-w-sm" placeholder="Search by user or problem…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="wrong_answer">Wrong Answer</SelectItem>
            <SelectItem value="runtime_error">Runtime Error</SelectItem>
            <SelectItem value="time_limit_exceeded">Time Limit Exceeded</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-hidden">
        {!rows ? (
          <div className="p-4 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No submissions found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Problem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Tests</TableHead>
                <TableHead>Lang</TableHead>
                <TableHead className="text-right">Runtime</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.username ? <Link to={`/u/${r.username}`} className="hover:text-primary">@{r.username}</Link> : "—"}</TableCell>
                  <TableCell>{r.problem_slug ? <Link to={`/problems/${r.problem_slug}`} className="hover:text-primary">{r.problem_title}</Link> : "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[r.status] || statusColor.pending}>{r.status.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{r.passed_count ?? 0}/{r.total_count ?? 0}</TableCell>
                  <TableCell className="text-xs">{r.language}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{r.runtime_ms != null ? `${r.runtime_ms} ms` : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}