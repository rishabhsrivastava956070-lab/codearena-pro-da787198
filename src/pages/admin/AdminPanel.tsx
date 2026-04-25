import { FormEvent, useEffect, useState } from "react";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { toast } from "sonner";

type Problem = { id: string; slug: string; title: string; difficulty: string; is_published: boolean };

export default function AdminPanel() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [aiResult, setAiResult] = useState<string>("");

  const load = async () => {
    const { data } = await supabase.from("problems").select("id, slug, title, difficulty, is_published").order("created_at", { ascending: false });
    setProblems((data as Problem[]) || []);
  };
  useEffect(() => { load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("Delete this problem?")) return;
    const { error } = await supabase.from("problems").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const generate = async () => {
    setAiBusy(true);
    setAiResult("");
    try {
      const { data, error } = await supabase.functions.invoke("ai-generate-problem", {
        body: { topic: aiTopic, difficulty: aiDifficulty }
      });
      if (error) throw error;
      setAiResult((data as { problem: string }).problem);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-1">Admin</h1>
      <p className="text-muted-foreground mb-6">Manage problems, contests, and challenges.</p>

      <Tabs defaultValue="problems">
        <TabsList>
          <TabsTrigger value="problems">Problems</TabsTrigger>
          <TabsTrigger value="create">Create</TabsTrigger>
          <TabsTrigger value="contest">New Contest</TabsTrigger>
          <TabsTrigger value="ai">AI Generator</TabsTrigger>
        </TabsList>

        <TabsContent value="problems" className="mt-4">
          <Card>
            {problems.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-border last:border-b-0 p-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium">{p.title}</span>
                  <DifficultyBadge difficulty={p.difficulty} />
                  {!p.is_published && <span className="text-xs text-muted-foreground">(draft)</span>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <CreateProblem onCreated={load} />
        </TabsContent>

        <TabsContent value="contest" className="mt-4">
          <CreateContest />
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-3">
          <Card className="p-5 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Problem Generator</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input placeholder="Topic (e.g. dynamic programming)" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
              <Select value={aiDifficulty} onValueChange={(v) => setAiDifficulty(v as "easy" | "medium" | "hard")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={generate} disabled={aiBusy || !aiTopic}>
                {aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate
              </Button>
            </div>
            {aiResult && (
              <Textarea rows={20} value={aiResult} onChange={(e) => setAiResult(e.target.value)} className="font-mono text-xs" />
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateProblem({ onCreated }: { onCreated: () => void }) {
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("problems").insert({
      slug: slug.trim(), title: title.trim(), description: description.trim(),
      difficulty,
      tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
      starter_code: { python: "# write your solution\n" }
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Problem created");
    setSlug(""); setTitle(""); setDescription(""); setTags("");
    onCreated();
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} required /></div>
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div>
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as "easy" | "medium" | "hard")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Tags (comma separated)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} /></div>
        <div><Label>Description (Markdown)</Label><Textarea rows={8} value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
        <Button type="submit" disabled={busy}><Plus className="h-4 w-4" />Create</Button>
      </form>
    </Card>
  );
}

function CreateContest() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("contests").insert({
      title: title.trim(), slug: slug.trim(),
      start_time: new Date(start).toISOString(), end_time: new Date(end).toISOString()
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Contest created");
    setTitle(""); setSlug(""); setStart(""); setEnd("");
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
          <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} required /></div>
          <div><Label>Start</Label><Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required /></div>
          <div><Label>End</Label><Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} required /></div>
        </div>
        <Button type="submit" disabled={busy}>Create contest</Button>
      </form>
    </Card>
  );
}