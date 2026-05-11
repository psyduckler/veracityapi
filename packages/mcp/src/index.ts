#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { analyzeAudioInputSchema, analyzeImageInputSchema, analyzeTextInputSchema, toolInputSchemas } from "./schemas.js";
import { summarizeAnalysisResult, summarizeBalance, formatToolError } from "./summaries.js";
import { VeracityClient } from "./veracity-client.js";

const server = new Server(
  { name: "veracityapi", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const client = new VeracityClient();

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_text",
      description: "Analyze text for content trust, specificity risk, weak provenance, slop risk, evidence, and recommended workflow action. VeracityAPI is not an AI-authorship detector or truth detector.",
      inputSchema: toolInputSchemas.analyze_text,
    },
    {
      name: "analyze_image",
      description: "Analyze an HTTPS image URL for visible synthetic-image artifact risk, content trust score, evidence, and recommended workflow action. Not proof of AI authorship, provenance, or truth.",
      inputSchema: toolInputSchemas.analyze_image,
    },
    {
      name: "analyze_audio",
      description: "Analyze a short HTTPS audio URL for synthetic-audio workflow triage. VeracityAPI fetches audio transiently, stores no audio bytes/base64/full URL, and returns workflow risk only — not proof of AI generation, voice cloning, speaker identity, or truth.",
      inputSchema: toolInputSchemas.analyze_audio,
    },
    {
      name: "check_balance",
      description: "Get VeracityAPI account credit balance and recent usage before running agent analysis loops. Requires VERACITY_API_KEY.",
      inputSchema: toolInputSchemas.check_balance,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments ?? {};
  try {
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
    if (request.params.name === "check_balance") {
      const result = await client.getBalance();
      return toolResult(summarizeBalance(result), result);
    }
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: formatToolError(err) }] };
  }
});

function toolResult(summary: string, result: Record<string, unknown>) {
  return {
    content: [
      { type: "text", text: summary },
      { type: "text", text: JSON.stringify(result, null, 2) },
    ],
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
