import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeEditor, type Lang } from "@/components/editor/CodeEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus } from "lucide-react";
import { toast } from "sonner";

const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export default function PeerRooms() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<{ id: string; code: string; current_code: string; language: Lang } | null>(null);
  const [text, setText] = useState("");
  const [language, setLanguage] = useState<Lang>("python");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!code) { setRoom(null); return; }
    (async () => {
      const { data } = await supabase.from("peer_rooms").select("*").eq("code", code).maybeSingle();
      if (!data) return toast.error("Room not found");
      setRoom(data as { id: string; code: string; current_code: string; language: Lang });
      setText(data.current_code || "");
      setLanguage(data.language as Lang);

      const ch = supabase
        .channel(`room-${data.id}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "peer_rooms", filter: `id=eq.${data.id}` }, (p) => {
          const n = p.new as { current_code: string; language: Lang };
          setText(n.current_code);
          setLanguage(n.language);
        })
        .subscribe();
      return () => { supabase.removeChannel(ch); };
    })();
  }, [code]);

  // Debounced save
  useEffect(() => {
    if (!room) return;
    const t = setTimeout(async () => {
      setSaving(true);
      await supabase.from("peer_rooms").update({ current_code: text, language }).eq("id", room.id);
      setSaving(false);
    }, 600);
    return () => clearTimeout(t);
  }, [text, language, room]);

  const create = async () => {
    if (!user) return navigate("/auth?next=/rooms");
    const newCode = randomCode();
    const { data, error } = await supabase.from("peer_rooms").insert({
      code: newCode, created_by: user.id, language: "python", current_code: "# Code together!\n"
    }).select().single();
    if (error) return toast.error(error.message);
    navigate(`/rooms/${data.code}`);
  };

  const join = (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    navigate(`/rooms/${joinCode.trim().toUpperCase()}`);
  };

  if (!code) {
    return (
      <div className="container py-12 max-w-md">
        <h1 className="text-3xl font-bold mb-2">Peer Coding Rooms</h1>
        <p className="text-muted-foreground mb-6">Code together in real-time. Share a room code with a friend.</p>
        <Card className="p-5 mb-4">
          <Button onClick={create} className="w-full"><Plus className="h-4 w-4" /> Create new room</Button>
        </Card>
        <Card className="p-5">
          <form onSubmit={join} className="flex gap-2">
            <Input placeholder="Room code (e.g. ABC123)" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
            <Button type="submit" variant="outline">Join</Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-4 h-[calc(100vh-3.5rem)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <span className="font-semibold">Room <span className="font-mono text-primary">{code}</span></span>
          <span className="text-xs text-muted-foreground">{saving ? "Saving…" : "Synced"}</span>
        </div>
        <Select value={language} onValueChange={(v) => setLanguage(v as Lang)}>
          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(["python", "javascript", "cpp", "java"] as Lang[]).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="flex-1 overflow-hidden">
        <CodeEditor value={text} onChange={setText} language={language} />
      </Card>
    </div>
  );
}