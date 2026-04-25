import { useEffect, useState } from "react";
import { History, RotateCcw, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

type Version = {
  id: string;
  language: string;
  code: string;
  label: string | null;
  created_at: string;
};

export function VersionHistoryPanel(props: {
  userId: string | undefined;
  problemId: string | undefined;
  language: string;
  currentCode: string;
  onRestore: (code: string, language: string) => void;
}) {
  const { userId, problemId, language, currentCode, onRestore } = props;
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [label, setLabel] = useState("");

  const load = async () => {
    if (!userId || !problemId) return;
    const { data } = await supabase
      .from("code_versions")
      .select("id, language, code, label, created_at")
      .eq("user_id", userId)
      .eq("problem_id", problemId)
      .order("created_at", { ascending: false })
      .limit(50);
    setVersions((data as Version[]) || []);
  };
  useEffect(() => { load(); }, [userId, problemId]);

  const save = async () => {
    if (!userId || !problemId) return toast.error("Sign in to save versions");
    if (!currentCode.trim()) return toast.error("Nothing to save");
    const { error } = await supabase.from("code_versions").insert({
      user_id: userId,
      problem_id: problemId,
      language,
      code: currentCode,
      label: label || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Version saved");
    setLabel("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("code_versions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  if (!userId) {
    return <p className="text-sm text-muted-foreground p-4">Sign in to use version history.</p>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-3 flex items-center gap-2">
        <Input
          placeholder="Label (e.g. brute force, optimized)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-8"
        />
        <Button size="sm" onClick={save}>
          <Save className="h-3.5 w-3.5" /> <span className="ml-1">Snapshot</span>
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {!versions ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : versions.length === 0 ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <History className="h-4 w-4" /> No snapshots yet. Save the current code to start a history.
            </div>
          ) : (
            versions.map((v) => (
              <div key={v.id} className="rounded-md border border-border p-2 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">
                    {v.label || new Date(v.created_at).toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onRestore(v.code, v.language)}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(v.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="text-muted-foreground flex items-center gap-2">
                  <span>{v.language}</span>·<span>{new Date(v.created_at).toLocaleString()}</span>
                </div>
                <pre className="bg-muted/40 rounded p-2 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[10px]">
                  {v.code.slice(0, 400)}{v.code.length > 400 ? "…" : ""}
                </pre>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}