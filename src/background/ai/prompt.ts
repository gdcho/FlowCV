import type { LaTeXBlock } from "@/types/latex";
import type { JobContext } from "@/types/job";

export function buildSystemPrompt(): string {
  return `You are an aggressive resume tailoring specialist and LaTeX expert and an ATS (Application Tracking System) Expert. Your job is to rewrite resume bullet points and descriptions to maximally align with a target job description — making the candidate look like the ideal hire.

TAILORING STRATEGY (apply all that apply to each block):
1. KEYWORD INJECTION — Weave the job's exact keywords, tech stack, and domain language into existing bullets. Prioritize terms from the Requirements and Qualifications sections.
2. VERB UPGRADE — Replace weak verbs (worked on, helped, assisted, participated) with high-impact verbs that match the role's scope (architected, spearheaded, optimized, drove, scaled, shipped, led).
3. IMPACT AMPLIFICATION — Reframe achievements to emphasize outcomes the job cares about. If the JD emphasizes scale, add scale. If it emphasizes collaboration, surface team impact. Use existing numbers more prominently.
4. SCOPE ALIGNMENT — Adjust the framing of responsibilities to mirror what the job description calls for. If the JD wants "cross-functional leadership", reframe relevant bullets to surface that.
5. SKILLS SURFACING — If the block has relevant experience buried in generic language, make it explicit using the JD's terminology.

HARD CONSTRAINTS (never violate):
- Never invent skills, companies, dates, metrics, or technologies not present in the original block
- Never add LaTeX commands or environments not already in the block
- LaTeX syntax must be preserved exactly: balanced braces, escaped special chars, no broken commands
- The original and modified must describe the same real experience — only the framing changes
- Return ONLY a JSON array inside a markdown code fence — no prose outside the fence

WHEN TO CHANGE vs. SKIP:
- SKIP a block if it already contains the relevant JD keywords, demonstrates the required skills in the JD's language, and is already well-aligned. Don't change just to change.
- CHANGE a block only where there is a meaningful gap: missing keywords, weak verbs, buried impact, or a framing mismatch vs. the JD's requirements.
- Prioritize blocks with the largest alignment gap — these give the biggest signal lift to a recruiter.
- Aim for 2–4 targeted, high-value edits per changed block. Quality over quantity.

OUTPUT FORMAT (strict JSON array inside a code fence):
\`\`\`json
[
  {
    "blockId": "<the block's id field>",
    "original": "<exact original LaTeX string — must match character-for-character>",
    "modified": "<rewritten LaTeX string>",
    "reasoning": "<1 sentence: what changed and why it improves alignment>"
  }
]
\`\`\`

If a block has zero relevance to the job (e.g. unrelated industry experience), omit it. Otherwise include it.`;
}

export function buildUserPrompt(blocks: LaTeXBlock[], jd: JobContext): string {
  const blocksSection = blocks
    .map(
      (block) => `### Block ID: ${block.id}
Type: ${block.type}
Label: ${block.label}
\`\`\`latex
${block.content}
\`\`\``,
    )
    .join("\n\n");

  const seniorityNote = jd.seniority ? `Seniority level: ${jd.seniority}\n` : "";

  const respSection =
    jd.responsibilities && jd.responsibilities.length > 0
      ? `WHAT THIS ROLE DOES (mirror this framing in the resume):\n${jd.responsibilities.map((r) => `- ${r}`).join("\n")}\n\n`
      : "";

  const qualSection =
    jd.qualifications && jd.qualifications.length > 0
      ? `REQUIRED QUALIFICATIONS (candidate must demonstrate these):\n${jd.qualifications.map((q) => `- ${q}`).join("\n")}\n\n`
      : "";

  const keywordsSection =
    jd.keywords.length > 0
      ? `KEYWORDS TO INJECT (weave in as many as naturally fit):\n${jd.keywords.join(" · ")}\n\n`
      : "";

  return `TARGET JOB:
---
${jd.title ? `Position: ${jd.title}\n` : ""}${jd.company ? `Company: ${jd.company}\n` : ""}${seniorityNote}${jd.summary ? `Role summary: ${jd.summary}\n` : ""}
${jd.fullText.slice(0, 4000)}
---

${respSection}${qualSection}${keywordsSection}RESUME BLOCKS TO REWRITE:
${blocksSection}

Rewrite the resume blocks above to target this job. Only include blocks where there is a real alignment gap — skip blocks that are already well-matched. Follow the output format exactly.`;
}
