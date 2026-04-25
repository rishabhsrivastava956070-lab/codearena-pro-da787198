import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Row = {
  id: string; username: string | null; display_name: string | null; created_at: string;
  problems_solved: number; xp: number; streak: number; is_admin: boolean;
};

export default function AdminUsers() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setRows(null);
    const [{ data: profs }, { data: stats }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name, created_at").order("created_at", { ascending: false }),
      supabase.from("user_stats").select("user_id, problems_solved, xp, streak"),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    const statMap = new Map((stats || []).map((s: { user_id: string } & Record<string, number>) => [s.user_id, s]));
    const adminSet = new Set((roles || []).map((r: { user_id: string }) => r.user_id));
    setRows((profs || []).map((p: { id: string; username: string | null; display_name: string | null; created_at: string }) => ({
      ...p,
      problems_solved: statMap.get(p.id)?.problems_solved || 0,
      xp: statMap.get(p.id)?.xp || 0,
      streak: statMap.get(p.id)?.streak || 0,
      is_admin: adminSet.has(p.id),
    })));
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const ql = q.toLowerCase();
    return rows.filter((r) =>
      !q || (r.username || "").toLowerCase().includes(ql) || (r.display_name || "").toLowerCase().includes(ql)
    );
  }, [rows, q]);

  const toggleAdmin = async (uid: string, makeAdmin: boolean) => {
    if (makeAdmin) {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
      if (error) return toast.error(error.message);
      toast.success("Granted admin");
    } else {
      if (!confirm("Revoke admin role?")) return;
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
      if (error) return toast.error(error.message);
      toast.success("Revoked admin");
    }
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-sm text-muted-foreground">All registered users and their stats.</p>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search users…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="overflow-hidden">
        {!rows ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No users found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead className="text-right">Solved</TableHead>
                <TableHead className="text-right">XP</TableHead>
                <TableHead className="text-right">Streak</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.username ? (
                      <Link to={`/u/${r.username}`} className="hover:text-primary">@{r.username}</Link>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{r.display_name || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.problems_solved}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.xp}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.streak}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    {r.is_admin ? (
                      <Button variant="ghost" size="sm" onClick={() => toggleAdmin(r.id, false)}>
                        <ShieldOff className="h-3.5 w-3.5" />
                        <Badge variant="outline" className="ml-1 bg-primary/10 text-primary border-primary/30">admin</Badge>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => toggleAdmin(r.id, true)}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Make admin
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}