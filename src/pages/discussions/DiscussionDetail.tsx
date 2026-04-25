import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Disc = {
  id: string;
  title: string;
  body: string;
  upvotes: number;
  downvotes: number;
  video_url: string | null;
  created_at: string;
  profiles: { username: string | null; display_name: string | null } | null;
};
type Comment = {
  id: string;
  body: string;
  upvotes: number;
  created_at: string;
  profiles: { username: string | null; display_name: string | null } | null;
};

export default function DiscussionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [disc, setDisc] = useState<Disc | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data: d } = await supabase
      .from("discussions")
      .select("id, title, body, upvotes, downvotes, video_url, created_at, profiles(username, display_name)")
      .eq("id", id).maybeSingle();
    setDisc(d as unknown as Disc);
    const { data: c } = await supabase
      .from("comments")
      .select("id, body, upvotes, created_at, profiles(username, display_name)")
      .eq("discussion_id", id)
      .order("created_at", { ascending: true });
    setComments((c as unknown as Comment[]) || []);
  };
  useEffect(() => { load(); }, [id]);

  const vote = async (value: 1 | -1) => {
    if (!user || !disc) return;
    const { error } = await supabase.from("votes").upsert({
      user_id: user.id, target_type: "discussion", target_id: disc.id, value
    });
    if (error) return toast.error(error.message);
    const delta = value === 1 ? { upvotes: (disc.upvotes || 0) + 1 } : { downvotes: (disc.downvotes || 0) + 1 };
    await supabase.from("discussions").update(delta).eq("id", disc.id);
    load();
  };

  const post = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    if (body.trim().length < 2) return toast.error("Comment too short");
    setBusy(true);
    const { error } = await supabase.from("comments").insert({
      discussion_id: id, user_id: user.id, body: body.trim()
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setBody("");
    load();
  };

  if (!disc) return <div className="container py-12 text-muted-foreground">Loading…</div>;

  return (
    <div className="container py-8 max-w-3xl space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => vote(1)} className="hover:text-primary"><ArrowUp className="h-4 w-4" /></button>
            <span className="text-sm font-bold">{(disc.upvotes || 0) - (disc.downvotes || 0)}</span>
            <button onClick={() => vote(-1)} className="hover:text-destructive"><ArrowDown className="h-4 w-4" /></button>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{disc.title}</h1>
            <div className="text-xs text-muted-foreground mt-1">
              by {disc.profiles?.display_name || disc.profiles?.username} · {formatDistanceToNow(new Date(disc.created_at), { addSuffix: true })}
            </div>
            <div className="prose prose-invert prose-sm max-w-none mt-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{disc.body}</ReactMarkdown>
            </div>
            {disc.video_url && (
              <a href={disc.video_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm mt-2 inline-block">
                ▶ Watch video explanation
              </a>
            )}
          </div>
        </div>
      </Card>

      <h2 className="text-lg font-semibold pt-4">Comments ({comments.length})</h2>
      {user ? (
        <Card className="p-4">
          <form onSubmit={post} className="space-y-2">
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a comment…" maxLength={5000} />
            <Button type="submit" size="sm" disabled={busy}>{busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Post comment</Button>
          </form>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Sign in to comment.</p>
      )}

      <div className="space-y-2">
        {comments.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="text-xs text-muted-foreground mb-1">
              {c.profiles?.display_name || c.profiles?.username} · {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
            </div>
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.body}</ReactMarkdown>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}