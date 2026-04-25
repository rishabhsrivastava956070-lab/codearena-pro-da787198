import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function NewDiscussion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [problems, setProblems] = useState<{ id: string; title: string }[]>([]);
  const [problemId, setProblemId] = useState<string>("none");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("problems").select("id, title").eq("is_published", true).order("title")
      .then(({ data }) => setProblems((data as { id: string; title: string }[]) || []));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (title.trim().length < 3 || title.length > 200) return toast.error("Title 3–200 chars");
    if (body.trim().length < 10 || body.length > 10000) return toast.error("Body 10–10,000 chars");
    setBusy(true);
    const { data, error } = await supabase.from("discussions").insert({
      user_id: user.id,
      title: title.trim(),
      body: body.trim(),
      video_url: videoUrl.trim() || null,
      problem_id: problemId === "none" ? null : problemId,
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate(`/discuss/${data.id}`);
  };

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">New post</h1>
      <Card className="p-5">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Related problem (optional)</Label>
            <Select value={problemId} onValueChange={setProblemId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {problems.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="t">Title</Label>
            <Input id="t" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="b">Body (Markdown supported)</Label>
            <Textarea id="b" rows={10} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="v">Video URL (optional)</Label>
            <Input id="v" type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/..." />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>Post</Button>
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}