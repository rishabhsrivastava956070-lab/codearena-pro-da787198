import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Contest = { id: string; slug: string; title: string; start_time: string; end_time: string };
type Problem = { id: string; title: string; difficulty: string };

function statusOf(c: Contest) {
  const now = Date.now();
  if (now < new Date(c.start_time).getTime()) return { label: "Upcoming", cls: "text-blue-500" };
  if (now > new Date(c.end_time).getTime()) return { label: "Ended", cls: "text-muted-foreground" };
  return { label: "Live", cls: "text-emerald-500" };
}

export default function AdminContests() {
  const [list, setList] = useState<Contest[] | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("contests").select("id, slug, title, start_time, end_time").order("start_time", { ascending: false }),
      supabase.from("problems").select("id, title, difficulty").eq("status", "approved").order("title"),
    ]);
    setList((c as Contest[]) || []);
    setProblems((p as Problem[]) || []);
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("contests")
        .insert({
          title: title.trim(), slug: slug.trim(), description: description.trim() || null,
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
        })
        .select("id").single();
      if (error) throw error;
      if (selected.size) {
        const rows = Array.from(selected).map((problem_id, i) => ({
          contest_id: data.id, problem_id, ordering: i, points: 100,
        }));
        const { error: e2 } = await supabase.from("contest_problems").insert(rows);
        if (e2) throw e2;
      }
      toast.success("Contest created");
      setTitle(""); setSlug(""); setDescription(""); setStart(""); setEnd(""); setSelected(new Set());
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this contest?")) return;
    const { error } = await supabase.from("contests").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Contests</h1>
        <p className="text-sm text-muted-foreground">Schedule contests with start/end windows and problem sets.</p>
      </div>

      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="weekly-1" /></div>
            <div><Label>Start</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
            <div><Label>End</Label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
          </div>
          <div><Label>Description</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div>
            <Label>Problems ({selected.size} selected)</Label>
            <Card className="max-h-64 overflow-auto p-2 mt-1">
              {problems.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No approved problems yet.</p>
              ) : problems.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={(v) => {
                      const next = new Set(selected);
                      if (v) next.add(p.id); else next.delete(p.id);
                      setSelected(next);
                    }}
                  />
                  <span className="flex-1">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{p.difficulty}</span>
                </label>
              ))}
            </Card>
          </div>
          <Button type="submit" disabled={busy}><Plus className="h-4 w-4" /> Create contest</Button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {!list ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No contests yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Window</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((c) => {
                const s = statusOf(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link to={`/contests/${c.slug}`} className="hover:text-primary">{c.title}</Link>
                      <div className="text-xs text-muted-foreground">{c.slug}</div>
                    </TableCell>
                    <TableCell><span className={s.cls}>{s.label}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.start_time).toLocaleString()} → {new Date(c.end_time).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}