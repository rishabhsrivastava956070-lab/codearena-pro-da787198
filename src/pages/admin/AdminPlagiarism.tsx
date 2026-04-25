import { useEffect, useState } from "react";
import { Check, X, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

type Report = {
  id: string;
  submission_id: string;
  matched_submission_id: string;
  user_id: string;
  matched_user_id: string;
  problem_id: string;
  contest_id: string | null;
  similarity: number;
  language: string;
  status: "pending" | "dismissed" | "confirmed";
  created_at: string;
};

type Enriched = Report & {
  problem_title?: string;
  problem_slug?: string;
  user_name?: string;
  matched_name?: string;
  code?: string;
  matched_code?: string;
};

export default function AdminPlagiarism() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"pending" | "confirmed" | "dismissed">("pending");
  const [items, setItems] = useState<Enriched[] | null>(null);

  const load = async () => {
    setItems(null);
    const { data: reports, error } = await supabase
      .from("plagiarism_reports")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); setItems([]); return; }
    if (!reports?.length) { setItems([]); return; }

    const probIds = [...new Set(reports.map((r) => r.problem_id))];
    const subIds = [...new Set(reports.flatMap((r) => [r.submission_id, r.matched_submission_id]))];
    const userIds = [...new Set(reports.flatMap((r) => [r.user_id, r.matched_user_id]))];

    const [{ data: probs }, { data: subs }, { data: profs }] = await Promise.all([
      supabase.from("problems").select("id, title, slug").in("id", probIds),
      supabase.from("submissions").select("id, code").in("id", subIds),
      supabase.from("profiles").select("id, username, display_name").in("id", userIds),
    ]);
    const probMap = new Map(probs?.map((p) => [p.id, p]));
    const subMap = new Map(subs?.map((s) => [s.id, s.code]));
    const profMap = new Map(profs?.map((p) => [p.id, p.display_name || p.username || p.id.slice(0, 6)]));

    setItems(
      reports.map((r) => ({
        ...r,
        problem_title: probMap.get(r.problem_id)?.title,
        problem_slug: probMap.get(r.problem_id)?.slug,
        user_name: profMap.get(r.user_id),
        matched_name: profMap.get(r.matched_user_id),
        code: subMap.get(r.submission_id),
        matched_code: subMap.get(r.matched_submission_id),
      })) as Enriched[],
    );
  };

  useEffect(() => { load(); }, [tab]);

  const decide = async (id: string, status: "confirmed" | "dismissed") => {
    const { error } = await supabase
      .from("plagiarism_reports")
      .update({ status, reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-destructive" />
        <div>
          <h1 className="text-2xl font-bold">Plagiarism review</h1>
          <p className="text-sm text-muted-foreground">
            Submissions flagged with ≥80% Jaccard similarity against another user's accepted code.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="dismissed">Dismissed</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-3 mt-4">
          {!items ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
          ) : items.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground text-sm">
              No {tab} reports.
            </Card>
          ) : (
            items.map((r) => (
              <Card key={r.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{r.problem_title || r.problem_id.slice(0, 8)}</h3>
                      <Badge variant="outline" className="text-xs">{r.language}</Badge>
                      <Badge variant="destructive" className="text-xs">
                        {(r.similarity * 100).toFixed(1)}% match
                      </Badge>
                      {r.contest_id && <Badge variant="secondary" className="text-xs">Contest</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{r.user_name}</span> vs{" "}
                      <span className="font-medium text-foreground">{r.matched_name}</span> ·{" "}
                      {new Date(r.created_at).toLocaleString()}
                    </div>
                  </div>
                  {tab === "pending" && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => decide(r.id, "dismissed")}>
                        <X className="h-4 w-4" /> Dismiss
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => decide(r.id, "confirmed")}>
                        <Check className="h-4 w-4" /> Confirm
                      </Button>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium mb-1">{r.user_name}'s code</div>
                    <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                      {r.code || "—"}
                    </pre>
                  </div>
                  <div>
                    <div className="text-xs font-medium mb-1">{r.matched_name}'s code</div>
                    <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-64 whitespace-pre-wrap">
                      {r.matched_code || "—"}
                    </pre>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}