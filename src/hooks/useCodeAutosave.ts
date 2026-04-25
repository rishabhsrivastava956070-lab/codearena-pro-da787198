import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Auto-saves the user's current code to public.code_drafts (debounced).
 * One row per (user, problem, language). Falls back silently if not signed in.
 */
export function useCodeAutosave(params: {
  userId: string | undefined;
  problemId: string | undefined;
  language: string;
  code: string;
  delayMs?: number;
}) {
  const { userId, problemId, language, code, delayMs = 1500 } = params;
  const lastSavedRef = useRef<string>("");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId || !problemId) return;
    if (code === lastSavedRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const { error } = await supabase
        .from("code_drafts")
        .upsert(
          { user_id: userId, problem_id: problemId, language, code, updated_at: new Date().toISOString() },
          { onConflict: "user_id,problem_id,language" },
        );
      if (!error) lastSavedRef.current = code;
    }, delayMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [userId, problemId, language, code, delayMs]);
}

/** Loads the user's most recent draft for (problem, language). Returns null if none. */
export async function loadDraft(userId: string, problemId: string, language: string) {
  const { data } = await supabase
    .from("code_drafts")
    .select("code, updated_at")
    .eq("user_id", userId)
    .eq("problem_id", problemId)
    .eq("language", language)
    .maybeSingle();
  return data;
}