import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Edit2, Plus, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Row = {
  id: string; slug: string; title: string;
  difficulty: "easy" | "medium" | "hard";
  tags: string[];
  status: "pending" | "approved" | "rejected";
  is_published: boolean;
};

const statusColor: Record<Row["status"], string> = {
  pending: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  approved: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  rejected: "bg-red-500/15 text-red-500 border-red-500/30",
};

export default function AdminProblems() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState("all");
  const [tag, setTag] = useState("all");
  const [status, setStatus] = useState("all");

  const load = async () => {
    setRows(null);
    const { data, error } = await supabase
      .from("problems")
      .select("id, slug, title, difficulty, tags, status, is_published")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as Row[]) || []);
  };
  useEffect(() => { load(); }, []);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    (rows || []).forEach((r) => r.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return (rows || []).filter((r) => {
      if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
      if (diff !== "all" && r.difficulty !== diff) return false;
      if (tag !== "all" && !r.tags?.includes(tag)) return false;
      if (status !== "all" && r.status !== status) return false;
      return true;
    });
  }, [rows, q, diff, tag, status]);

  const remove = async (id: string) => {
    if (!confirm("Delete this problem? This also removes its test cases.")) return;
    const { error } = await supabase.from("problems").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Problem deleted");
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Problems</h1>
          <p className="text-sm text-muted-foreground">Manage the full problem catalog.</p>
        </div>
        <Button asChild>
          <Link to="/admin/problems/create"><Plus className="h-4 w-4" /> New problem</Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by title…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={diff} onValueChange={setDiff}>
          <SelectTrigger className="md:w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All difficulty</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="md:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="md:w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {!rows ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No problems match your filters.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-[110px]">Difficulty</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link to={`/problems/${r.slug}`} className="hover:text-primary">{r.title}</Link>
                    <div className="text-xs text-muted-foreground">{r.slug}</div>
                  </TableCell>
                  <TableCell><DifficultyBadge difficulty={r.difficulty} /></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColor[r.status]}>{r.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {r.tags?.slice(0, 4).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/admin/problems/${r.id}/edit`}><Edit2 className="h-3.5 w-3.5" /></Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
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