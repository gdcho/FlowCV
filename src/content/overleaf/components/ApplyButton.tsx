import { useState } from "react";
import type { ProposedChange } from "@/types/ai";
import { applyChanges } from "../bridge-client";

interface Props {
  changes: ProposedChange[];
  selectedIds: Set<string>;
  onApplied: () => void;
}

export function ApplyButton({ changes, selectedIds, onApplied }: Props) {
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const selected = changes.filter((c) => selectedIds.has(c.blockId));

  async function handleApply() {
    if (selected.length === 0) return;
    setApplying(true);
    setResult(null);

    try {
      const count = await applyChanges(
        selected.map((c) => ({ original: c.original, modified: c.modified })),
      );
      if (count > 0) {
        setResult(
          `Applied ${count} of ${selected.length} changes, recompiling`,
        );
        onApplied();
      } else if (count === -1) {
        setResult("Bridge not connected - refresh the page then try again.");
      } else {
        setResult(
          "Could not apply - original text not found. Try re-analyzing.",
        );
      }
    } catch (err: unknown) {
      setResult(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setApplying(false);
    }
  }

  if (changes.length === 0) return null;

  return (
    <div className="px-3 pb-2">
      <button
        onClick={() => void handleApply()}
        disabled={applying || selected.length === 0}
        className="w-full py-2 px-4 rounded-lg bg-ov hover:bg-ov-dark disabled:bg-ov-light text-white text-sm font-semibold transition-colors"
      >
        {applying
          ? "Applying…"
          : `Apply ${selected.length} Change${selected.length !== 1 ? "s" : ""}`}
      </button>
      {result && (
        <p className="text-xs text-center text-gray-600 mt-1.5">{result}</p>
      )}
    </div>
  );
}
