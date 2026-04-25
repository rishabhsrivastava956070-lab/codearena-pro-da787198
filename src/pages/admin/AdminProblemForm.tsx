import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type TC = { id?: string; input: string; expected_output: string; is_sample: boolean; explanation?: string };

/**
 * Reusable create/edit form. When :id is provided we load and edit that problem.
 * Sample + hidden test cases are managed in the same form.
 */
export default function AdminProblemForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [tags, setTags] = useState("");
  const [constraints, setConstraints] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [isPublished, setIsPublished] = useState(true);
  const [samples, setSamples] = useState<TC[]>([{ input: "", expected_output: "", is_sample: true }]);
  const [hidden, setHidden] = useState<TC[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      const { data: p } = await supabase.from("problems").select("*").eq("id", id).maybeSingle();
      if (!p) return toast.error("Problem not found");
      setSlug(p.slug); setTitle(p.title); setDescription(p.description);
      setDifficulty(p.difficulty); setTags((p.tags || []).join(", "));
      setConstraints(p.constraints || ""); setStatus(p.status); setIsPublished(p.is_published);
      const { data: tcs } = await supabase.from("test_cases").select("*").eq("problem_id", id).order("ordering");
      setSamples((tcs || []).filter((t) => t.is_sample) as TC[]);
      setHidden((tcs || []).filter((t) => !t.is_sample) as TC[]);
    })();
  }, [id, isEdit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        slug: slug.trim(), title: title.trim(), description: description.trim(),
        difficulty, tags: tags.split(",").map((s) => s.trim()).filter(Boolean),
        constraints: constraints.trim() || null, status, is_published: isPublished,
        starter_code: { python: "# write your solution\n" },
      };
      let pid = id;
      if (isEdit) {
        const { error } = await supabase.from("problems").update(payload).eq("id", id);
        if (error) throw error;
        // Replace test cases (simpler than diffing)
        await supabase.from("test_cases").delete().eq("problem_id", id);
      } else {
        const { data, error } = await supabase.from("problems").insert(payload).select("id").single();
        if (error) throw error;
        pid = data.id;
      }
      const all = [
        ...samples.map((s, i) => ({ ...s, problem_id: pid, is_sample: true, ordering: i })),
        ...hidden.map((s, i) => ({ ...s, problem_id: pid, is_sample: false, ordering: 100 + i })),
      ].filter((t) => t.input !== "" || t.expected_output !== "");
      if (all.length) {
        const { error: tcErr } = await supabase.from("test_cases").insert(
          all.map(({ id: _ignore, ...rest }) => rest)
        );
        if (tcErr) throw tcErr;
      }
      toast.success(isEdit ? "Problem updated" : "Problem created");
      navigate("/admin/problems");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const updateTC = (list: TC[], setter: (v: TC[]) => void, idx: number, patch: Partial<TC>) => {
    setter(list.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const TCBlock = ({ list, setter, label }: { list: TC[]; setter: (v: TC[]) => void; label: string }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setter([...list, { input: "", expected_output: "", is_sample: label.startsWith("Sample") }])}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {list.length === 0 && <p className="text-xs text-muted-foreground">No test cases.</p>}
      {list.map((tc, i) => (
        <Card key={i} className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">#{i + 1}</div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setter(list.filter((_, j) => j !== i))}>
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Input</Label>
              <Textarea rows={3} className="font-mono text-xs" value={tc.input} onChange={(e) => updateTC(list, setter, i, { input: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Expected output</Label>
              <Textarea rows={3} className="font-mono text-xs" value={tc.expected_output} onChange={(e) => updateTC(list, setter, i, { expected_output: e.target.value })} />
            </div>
          </div>
          {label.startsWith("Sample") && (
            <div>
              <Label className="text-xs">Explanation (optional)</Label>
              <Input value={tc.explanation || ""} onChange={(e) => updateTC(list, setter, i, { explanation: e.target.value })} />
            </div>
          )}
        </Card>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">{isEdit ? "Edit problem" : "Create problem"}</h1>
      <p className="text-sm text-muted-foreground mb-6">Markdown is supported in the description.</p>
      <form onSubmit={submit} className="space-y-5">
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="two-sum" /></div>
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
          <div><Label>Tags (comma separated)</Label><Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="array, hash-table" /></div>
          <div><Label>Description (Markdown)</Label><Textarea rows={10} value={description} onChange={(e) => setDescription(e.target.value)} required /></div>
          <div><Label>Constraints</Label><Textarea rows={4} value={constraints} onChange={(e) => setConstraints(e.target.value)} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "pending" | "approved" | "rejected")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <Switch id="pub" checked={isPublished} onCheckedChange={setIsPublished} />
                <Label htmlFor="pub">Published</Label>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <TCBlock list={samples} setter={setSamples} label="Sample test cases (visible to users)" />
        </Card>
        <Card className="p-5">
          <TCBlock list={hidden} setter={setHidden} label="Hidden test cases (used for judging)" />
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate("/admin/problems")}>Cancel</Button>
          <Button type="submit" disabled={busy}><Save className="h-4 w-4" /> {isEdit ? "Save changes" : "Create problem"}</Button>
        </div>
      </form>
    </div>
  );
}