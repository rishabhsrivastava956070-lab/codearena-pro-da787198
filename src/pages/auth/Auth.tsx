import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Code2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  username: z.string().trim().min(3, "Min 3 chars").max(30, "Max 30").regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, _ only"),
});
const signInSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(72),
});

export default function AuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const next = params.get("next") || "/problems";
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(
    params.get("mode") === "signup" ? "signup" : "signin"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user, next, navigate]);

  const handleGoogle = async () => {
    setBusy(true);
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + next,
    });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const v = signUpSchema.safeParse({ email, password, username });
        if (!v.success) {
          toast.error(v.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: v.data.email,
          password: v.data.password,
          options: {
            emailRedirectTo: window.location.origin + next,
            data: { username: v.data.username, display_name: v.data.username },
          },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account");
      } else if (mode === "signin") {
        const v = signInSchema.safeParse({ email, password });
        if (!v.success) {
          toast.error(v.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword({
          email: v.data.email,
          password: v.data.password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Password reset email sent");
        setMode("signin");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 gradient-hero">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 font-bold text-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-md gradient-primary shadow-glow">
            <Code2 className="h-5 w-5 text-primary-foreground" />
          </div>
          CodeArena
        </Link>
        <Card className="p-6 shadow-card">
          <h1 className="text-2xl font-bold mb-1">
            {mode === "signin" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin"
              ? "Sign in to continue your coding journey"
              : mode === "signup"
                ? "Start solving problems and climbing the ranks"
                : "We'll send you a reset link"}
          </p>

          {mode !== "forgot" && (
            <>
              <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={handleGoogle}>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
                </svg>
                Continue with Google
              </Button>
              <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                OR
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="codeNinja" required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button type="button" className="text-xs text-primary hover:underline" onClick={() => setMode("forgot")}>
                      Forgot?
                    </button>
                  )}
                </div>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button className="text-primary hover:underline" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <button className="text-primary hover:underline" onClick={() => setMode("signin")}>
                Already have an account? Sign in
              </button>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}