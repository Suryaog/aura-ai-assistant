import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";

const EXT_MAP: Record<string, string> = {
  javascript: "js", typescript: "ts", python: "py", bash: "sh", shell: "sh",
  markdown: "md", html: "html", css: "css", json: "json", yaml: "yml",
  rust: "rs", go: "go", java: "java", c: "c", cpp: "cpp", csharp: "cs",
  ruby: "rb", php: "php", sql: "sql", swift: "swift", kotlin: "kt",
};

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const download = () => {
    const ext = EXT_MAP[language?.toLowerCase()] || language || "txt";
    const blob = new Blob([value], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snippet.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const lines = value.split("\n").length;
  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-code-bg not-prose">
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-border bg-card/40">
        <span className="font-mono">{language || "text"} · {lines} {lines === 1 ? "line" : "lines"}</span>
        <div className="flex items-center gap-1">
          <button onClick={download} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent hover:text-foreground transition" aria-label="Download">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={copy} className="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent hover:text-foreground transition" aria-label="Copy">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="text-[11px]">{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language || "text"}
          style={oneDark}
          PreTag="div"
          showLineNumbers
          lineNumberStyle={{ minWidth: "2.25em", paddingRight: "1em", textAlign: "right", color: "oklch(0.5 0 0)", userSelect: "none", borderRight: "1px solid var(--color-border)", marginRight: "0.875em" }}
          customStyle={{ margin: 0, background: "transparent", padding: "0.875rem 0", fontSize: "0.85rem", lineHeight: "1.5" }}
          codeTagProps={{ style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" } }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-chat space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // react-markdown v10: no `inline` prop. Detect block via language- className.
          code({ className, children, ...props }: any) {
            const text = String(children ?? "");
            const match = /language-(\w+)/.exec(className || "");
            const isBlock = !!match || text.includes("\n");
            if (isBlock) {
              return <CodeBlock language={match?.[1] ?? ""} value={text.replace(/\n$/, "")} />;
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }: any) {
            // Avoid <pre> wrapping our custom code block
            return <>{children}</>;
          },
          p: ({ children }) => <p className="leading-7 my-2">{children}</p>,
          h1: ({ children }) => <h1 className="text-2xl font-semibold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mt-3 mb-2">{children}</h3>,
          ul: ({ children }) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
          a: ({ children, href }) => <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">{children}</a>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-4 italic text-muted-foreground my-2">{children}</blockquote>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          hr: () => <hr className="my-4 border-border" />,
          table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full border-collapse text-sm">{children}</table></div>,
          th: ({ children }) => <th className="border border-border px-3 py-2 bg-muted text-left">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
