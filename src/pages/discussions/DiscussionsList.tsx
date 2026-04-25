import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MessageSquare, Plus, ArrowUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Disc = {
  id: string;
  title: string;
  body: string;
  upvotes: number;
  created_at: string;
  profiles: { username: string | null; display_name: string | null } | null;
  problems: { title: string; slug: string } | null;
};

export default function DiscussionsList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Disc[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("discussions")
        .select("id, title, body, upvotes, created_at, profiles(username, display_name), problems(title, slug)")
        .order("created_at", { ascending: false })
        .limit(50);
      setPosts((data as unknown as Disc[]) || []);
    })();
  }, []);

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Discuss</h1>
          <p className="text-muted-foreground">Share solutions, ask questions, learn together.</p>
        </div>
        <Button onClick={() => (user ? navigate("/discuss/new") : navigate("/auth?next=/discuss/new"))}>
          <Plus className="h-4 w-4" /> New post
        </Button>
      </div>

      {posts.length === 0 ? (
        <Card className="p-12 text-center">
          <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No discussions yet. Be the first to start one!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <Link key={p.id} to={`/discuss/${p.id}`}>
              <Card className="p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center text-xs text-muted-foreground">
                    <ArrowUp className="h-3 w-3" />
                    <span>{p.upvotes}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{p.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{p.body}</p>
                    <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-2">
                      <span>{p.profiles?.display_name || p.profiles?.username || "anon"}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                      {p.problems && (<><span>·</span><span className="text-primary">{p.problems.title}</span></>)}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}