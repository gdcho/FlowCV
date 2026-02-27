import Anthropic from "@anthropic-ai/sdk";
import type { LaTeXBlock } from "@/types/latex";
import type { JobContext } from "@/types/job";
import type { ProposedChange } from "@/types/ai";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { matchBlocksToKeywords } from "./matcher";
import { validateAIOutput } from "./safety";

// Sentinel marker embedded in the stream to signal the complete changes payload
const CHANGES_SENTINEL = "__LATEX_FLOW_CHANGES__";

interface PipelineInput {
  blocks: LaTeXBlock[];
  jd: JobContext;
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

/**
 * AsyncGenerator that yields text chunks as they stream from Claude,
 * then yields a final sentinel JSON string with the parsed ProposedChange[].
 */
export async function* runAIPipeline(
  input: PipelineInput,
): AsyncGenerator<string> {
  const {
    blocks,
    jd,
    apiKey,
    model = "claude-sonnet-4-6",
    maxTokens = 4096,
  } = input;

  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: {
      "anthropic-dangerous-direct-browser-access": "true",
    },
  });

  const relevantBlocks = matchBlocksToKeywords(blocks, jd);

  if (relevantBlocks.length === 0) {
    yield JSON.stringify({ [CHANGES_SENTINEL]: [] });
    return;
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(relevantBlocks, jd);

  const stream = client.messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  let fullResponse = "";

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const text = event.delta.text;
      fullResponse += text;
      yield text;
    }
  }

  // Parse and validate the response
  const changes = parseAndValidate(fullResponse, relevantBlocks);

  // Yield the final structured payload
  yield JSON.stringify({ [CHANGES_SENTINEL]: changes });
}

export { CHANGES_SENTINEL };

function parseAndValidate(
  response: string,
  blocks: LaTeXBlock[],
): ProposedChange[] {
  // Extract JSON from markdown code fence
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1].trim() : response.trim();

  let raw: Array<{
    blockId: string;
    original: string;
    modified: string;
    reasoning: string;
  }>;

  try {
    raw = JSON.parse(jsonStr) as typeof raw;
    if (!Array.isArray(raw)) return [];
  } catch {
    console.warn("[FlowCV Pipeline] Failed to parse AI response JSON");
    return [];
  }

  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  // Group items by blockId so multiple sub-changes per block can be merged.
  // Claude often returns several small edits targeting the same block; if we
  // apply them independently the second indexOf() fails because the first
  // edit already changed the document. We merge them here instead.
  const grouped = new Map<string, typeof raw>();
  for (const item of raw) {
    if (!grouped.has(item.blockId)) grouped.set(item.blockId, []);
    grouped.get(item.blockId)!.push(item);
  }

  const result: ProposedChange[] = [];

  for (const [blockId, items] of grouped) {
    const block = blockMap.get(blockId);
    if (!block) continue;

    // Start with the known block content and fold each sub-change in.
    // Using block.content as `original` guarantees the bridge can find it.
    let current = block.content;
    const reasonings: string[] = [];

    for (const item of items) {
      if (item.original === current) {
        // Full-block replacement
        current = item.modified;
      } else if (current.includes(item.original)) {
        // Substring replacement — replace only the first occurrence
        current = current.replace(item.original, item.modified);
      } else {
        // Whitespace-normalized fallback: find the closest match
        const normCurrent = current.replace(/\s+/g, " ").trim();
        const normOriginal = item.original.replace(/\s+/g, " ").trim();
        if (normCurrent.includes(normOriginal)) {
          // Rebuild: replace in the normalized version, then re-apply to original spacing
          // (best-effort — avoids a silent skip)
          current = current
            .replace(/\s+/g, " ")
            .trim()
            .replace(normOriginal, item.modified);
        } else {
          console.warn(
            "[FlowCV Pipeline] Could not match original in block, skipping sub-change:",
            item.original.slice(0, 80),
          );
          continue;
        }
      }
      if (item.reasoning) reasonings.push(item.reasoning);
    }

    if (current === block.content) continue; // nothing actually changed

    const change: ProposedChange = {
      blockId,
      original: block.content, // always the full block — bridge indexOf is reliable
      modified: current,
      reasoning: reasonings.join(" | "),
      block,
    };

    if (validateAIOutput(change)) result.push(change);
  }

  return result;
}
