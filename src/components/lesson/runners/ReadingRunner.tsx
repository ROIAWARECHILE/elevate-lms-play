import { motion } from "framer-motion";
import type { ReadingBlock } from "@/lib/courseSchema";
import { Info, AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";

const calloutStyles = {
  info: { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", Icon: Info },
  warning: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", Icon: AlertTriangle },
  success: { bg: "bg-success/10", border: "border-success/30", text: "text-success", Icon: CheckCircle2 },
  tip: { bg: "bg-accent/10", border: "border-accent/30", text: "text-accent", Icon: Lightbulb },
} as const;

export function ReadingRunner({ blocks, legacyText }: { blocks: ReadingBlock[]; legacyText?: string }) {
  if (blocks.length === 0 && legacyText) {
    return <div className="whitespace-pre-wrap text-foreground leading-relaxed">{legacyText}</div>;
  }
  if (blocks.length === 0) {
    return <p className="text-muted-foreground italic">Esta lección no tiene contenido todavía.</p>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + idx * 0.04 }}
        >
          {block.type === "heading" && (
            block.level === 1 ? (
              <h2 className="text-xl font-bold text-foreground mt-4 mb-2">{block.text}</h2>
            ) : (
              <h3 className="text-lg font-bold text-foreground mt-4 mb-2">{block.text}</h3>
            )
          )}
          {block.type === "paragraph" && (
            <p className="text-foreground leading-relaxed">{block.text}</p>
          )}
          {block.type === "callout" && (() => {
            const v = (block.variant ?? "info") as keyof typeof calloutStyles;
            const s = calloutStyles[v] ?? calloutStyles.info;
            const Icon = s.Icon;
            return (
              <div className={`flex gap-3 p-4 rounded-xl border ${s.bg} ${s.border}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${s.text}`} />
                <div>
                  {block.title && <p className={`font-semibold mb-1 ${s.text}`}>{block.title}</p>}
                  <p className="text-sm text-foreground leading-relaxed">{block.text}</p>
                </div>
              </div>
            );
          })()}
          {block.type === "quote" && (
            <blockquote className="border-l-4 border-primary pl-4 italic text-foreground/80">
              "{block.text}"
              {block.cite && <footer className="text-xs text-muted-foreground mt-1">— {block.cite}</footer>}
            </blockquote>
          )}
          {block.type === "code" && (
            <pre className="bg-muted text-foreground p-3 rounded-lg overflow-x-auto text-sm">
              <code>{block.code}</code>
            </pre>
          )}
          {block.type === "image" && (
            <figure>
              <img src={block.url} alt={block.alt ?? ""} className="rounded-xl w-full" loading="lazy" />
              {block.caption && (
                <figcaption className="text-xs text-muted-foreground text-center mt-1">{block.caption}</figcaption>
              )}
            </figure>
          )}
          {block.type === "divider" && <hr className="border-border my-4" />}
        </motion.div>
      ))}
    </div>
  );
}
