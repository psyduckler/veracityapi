#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { analyzeAudioInputSchema, analyzeBatchInputSchema, analyzeVideoInputSchema, analyzeImageInputSchema, analyzeTextInputSchema, verifyContentInputSchema, toolInputSchemas, toolOutputSchemas } from "./schemas.js";
import { summarizeAnalysisResult, summarizeBalance, formatToolError, type Modality } from "./summaries.js";
import { VeracityClient } from "./veracity-client.js";

const server = new Server(
  { name: "veracityapi", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const client = new VeracityClient();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "verify_content",
      description: "Use this before publishing, citing, embedding, training on, ingesting, moderating, or relying on user-supplied or AI-generated content. It returns recommended_action: allow, revise, human_review, or reject.",
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      inputSchema: toolInputSchemas.verify_content,
      outputSchema: toolOutputSchemas.verify_content,
    },
    {
      name: "analyze_text",
      description: "Analyze text for content trust, specificity risk, weak provenance, slop risk, evidence, and recommended workflow action. VeracityAPI is not an AI-authorship detector or truth detector.",
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      inputSchema: toolInputSchemas.analyze_text,
      outputSchema: toolOutputSchemas.analyze_text,
    },
    {
      name: "analyze_image",
      description: "Analyze an HTTPS image URL for visible synthetic-image artifact risk, content trust score, evidence, and recommended workflow action. Not proof of AI authorship, provenance, or truth.",
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      inputSchema: toolInputSchemas.analyze_image,
      outputSchema: toolOutputSchemas.analyze_image,
    },
    {
      name: "analyze_audio",
      description: "Analyze a short HTTPS audio URL for synthetic-audio workflow triage. VeracityAPI fetches audio transiently, stores no audio bytes/base64/full URL, and returns workflow risk only — not proof of AI generation, voice cloning, speaker identity, or truth.",
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      inputSchema: toolInputSchemas.analyze_audio,
      outputSchema: toolOutputSchemas.analyze_audio,
    },
    {
      name: "analyze_video",
      description: "Analyze a short direct HTTPS video URL for authenticity workflow risk using bounded contact-sheet sampling. Private-beta triage only: not forensic proof of AI generation, deepfake manipulation, or truth.",
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      inputSchema: toolInputSchemas.analyze_video,
      outputSchema: toolOutputSchemas.analyze_video,
    },
    {
      name: "analyze_batch",
      description: "Analyze 1-25 short text items in one bounded synchronous batch. Returns per-item recommended_action plus aggregate billing. Use before autonomous publishing/moderation loops.",
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      inputSchema: toolInputSchemas.analyze_batch,
      outputSchema: toolOutputSchemas.analyze_batch,
    },
    {
      name: "check_balance",
      description: "Get VeracityAPI account credit balance and recent usage before running agent analysis loops. Requires VERACITY_API_KEY.",
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      inputSchema: toolInputSchemas.check_balance,
      outputSchema: toolOutputSchemas.check_balance,
    },
    {
      name: "get_balance",
      description: "Compatibility alias for check_balance. Get VeracityAPI account credit balance and recent usage before autonomous runs.",
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      inputSchema: toolInputSchemas.get_balance,
      outputSchema: toolOutputSchemas.get_balance,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments ?? {};
  try {
    if (request.params.name === "verify_content") {
      const input = verifyContentInputSchema.parse(args);
      const result = await client.verifyContent(input);
      const modality = isModality(result.modality) ? result.modality : "content";
      return toolResult(summarizeAnalysisResult(modality, result), result);
    }
    if (request.params.name === "analyze_text") {
      const input = analyzeTextInputSchema.parse(args);
      const result = await client.analyzeText(input);
      return toolResult(summarizeAnalysisResult("text", result), result);
    }
    if (request.params.name === "analyze_image") {
      const input = analyzeImageInputSchema.parse(args);
      const result = await client.analyzeImage(input);
      return toolResult(summarizeAnalysisResult("image", result), result);
    }
    if (request.params.name === "analyze_audio") {
      const input = analyzeAudioInputSchema.parse(args);
      const result = await client.analyzeAudio(input);
      return toolResult(summarizeAnalysisResult("audio", result), result);
    }
    if (request.params.name === "analyze_video") {
      const input = analyzeVideoInputSchema.parse(args);
      const result = await client.analyzeVideo(input);
      return toolResult(summarizeAnalysisResult("video", result), result);
    }
    if (request.params.name === "analyze_batch") {
      const input = analyzeBatchInputSchema.parse(args);
      const result = await client.analyzeBatch(input);
      return toolResult(`Batch analysis complete: ${Array.isArray(result.results) ? result.results.length : 0} items analyzed.`, result);
    }
    if (request.params.name === "check_balance" || request.params.name === "get_balance") {
      const result = await client.getBalance();
      return toolResult(summarizeBalance(result), result);
    }
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: formatToolError(err) }] };
  }
});

function isModality(value: unknown): value is Modality {
  return value === "text" || value === "image" || value === "audio" || value === "video" || value === "asset" || value === "content";
}

function toolResult(summary: string, result: Record<string, unknown>) {
  return {
    structuredContent: result,
    content: [
      { type: "text", text: summary },
      { type: "text", text: JSON.stringify(result, null, 2) },
    ],
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
