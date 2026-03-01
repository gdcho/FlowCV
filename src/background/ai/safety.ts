import type { ProposedChange } from "@/types/ai";

// Commands the AI is allowed to produce (anything already in the original is also OK)
const ALWAYS_ALLOWED_COMMANDS = new Set([
  "textbf",
  "textit",
  "emph",
  "underline",
  "texttt",
  "textrm",
  "resumeItem",
  "resumeSubheading",
  "resumeProjectHeading",
  "resumeSubItem",
  "resumeSubSubheading",
  "section",
  "subsection",
  "subsubsection",
  "begin",
  "end",
  "item",
  "href",
  "url",
  "email",
  "small",
  "large",
  "Large",
  "normalsize",
  "newline",
  "vspace",
  "hspace",
  "noindent",
  "left",
  "right",
]);

function countBraces(text: string): { open: number; close: number } {
  let open = 0;
  let close = 0;
  let inComment = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "%") {
      inComment = true;
    } else if (ch === "\n") {
      inComment = false;
    } else if (!inComment) {
      if (ch === "{") open++;
      else if (ch === "}") close++;
    }
  }

  return { open, close };
}

function extractCommands(text: string): string[] {
  const matches = text.matchAll(/\\([a-zA-Z]+)/g);
  return Array.from(matches, (m) => m[1]);
}

export function validateAIOutput(change: ProposedChange): boolean {
  const { modified, original, blockId } = change;

  // 1. Brace balance
  const { open, close } = countBraces(modified);
  if (open !== close) {
    console.warn(
      `[FlowCV Safety] Brace mismatch in block ${blockId}: ${open} open vs ${close} close`,
    );
    return false;
  }

  // 2. No hallucinated commands (new cmds must be in allowed list or already in original)
  const originalCommands = new Set(extractCommands(original));
  const newCommands = extractCommands(modified).filter(
    (cmd) => !ALWAYS_ALLOWED_COMMANDS.has(cmd) && !originalCommands.has(cmd),
  );
  if (newCommands.length > 0) {
    console.warn(
      `[FlowCV Safety] Unknown new commands in block ${blockId}:`,
      newCommands,
    );
    return false;
  }

  // 3. Content size guard - must be at least 30% of original length
  if (modified.length < original.length * 0.3) {
    console.warn(
      `[FlowCV Safety] Modified content too short for block ${blockId}: ` +
        `${modified.length} chars vs ${original.length} original`,
    );
    return false;
  }

  // 4. Ensure original string is not empty (sanity check)
  if (!original.trim()) {
    return false;
  }

  return true;
}
