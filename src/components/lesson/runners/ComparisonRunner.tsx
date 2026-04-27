import type { ComparisonBlock } from "@/lib/courseSchema";

export function ComparisonRunner({ block }: { block?: ComparisonBlock }) {
  if (!block || !block.headers?.length) {
    return <p className="text-muted-foreground italic">Sin tabla.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {block.headers.map((h, i) => (
              <th key={i} className="text-left px-3 py-2 font-semibold text-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
              {row.cells.map((c, ci) => (
                <td key={ci} className="px-3 py-2 text-foreground/80">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
