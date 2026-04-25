import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, X, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Pending = {
  id: string; slug: string; title: string; description: string;
  difficulty: "easy" | "medium" | "hard"; tags: string[]; created_at: string;
};

export default function AdminApprovals() {
  const { user } = useAuth();
  const [list, setList] = useState<Pending[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setList(null);
    const { data } = await supabase
      .from("problems")
      .select("id, slug, title, description, difficulty, tags, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setList((data as Pending[]) || []);
  };
  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("problems")
      .update({
        status,
        review_notes: notes[id] || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Problem ${status}`);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Approvals queue</h1>
        <p className="text-sm text-muted-foreground">Review pending problems before they go live to users.</p>
      </div>

      {!list ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : list.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground text-sm">No problems awaiting review. 🎉</Card>
      ) : (
        list.map((p) => (
          <Card key={p.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  <DifficultyBadge difficulty={p.difficulty} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Submitted {new Date(p.created_at).toLocaleString()} · /{p.slug}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.tags?.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                </div>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to={`/admin/problems/${p.id}/edit`}><ExternalLink className="h-3.5 w-3.5" /> Edit</Link>
              </Button>
            </div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{p.description}</div>
            <Textarea
              rows={2}
              placeholder="Optional review notes (e.g. why rejected)…"
              value={notes[p.id] || ""}
              onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => decide(p.id, "rejected")}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button onClick={() => decide(p.id, "approved")}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}