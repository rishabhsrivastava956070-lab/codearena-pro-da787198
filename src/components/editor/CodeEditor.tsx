import Editor, { OnMount } from "@monaco-editor/react";
import { useRef } from "react";

export type Lang = "cpp" | "java" | "python" | "javascript";

const monacoLang: Record<Lang, string> = {
  cpp: "cpp",
  java: "java",
  python: "python",
  javascript: "javascript",
};

export const CodeEditor = ({
  value,
  onChange,
  language,
  height = "100%",
  readOnly = false,
}: {
  value: string;
  onChange?: (v: string) => void;
  language: Lang;
  height?: string | number;
  readOnly?: boolean;
}) => {
  const ref = useRef<unknown>(null);
  const handleMount: OnMount = (editor) => {
    ref.current = editor;
  };
  return (
    <Editor
      height={height}
      language={monacoLang[language]}
      value={value}
      theme="vs-dark"
      onMount={handleMount}
      onChange={(v) => onChange?.(v ?? "")}
      options={{
        readOnly,
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontFamily: "JetBrains Mono, Fira Code, ui-monospace, monospace",
        smoothScrolling: true,
        automaticLayout: true,
        tabSize: 2,
        padding: { top: 12 },
      }}
    />
  );
};