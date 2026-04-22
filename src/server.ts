import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z, type ZodTypeAny } from "zod";

import { clusterEntitiesInputSchema, clusterEntitiesTool } from "./tools/cluster.js";
import { dedupeRecordsInputSchema, dedupeRecordsTool } from "./tools/dedupe.js";
import { exportCleanDatasetInputSchema, exportCleanDatasetTool } from "./tools/export.js";
import {
  normalizeContactFieldsInputSchema,
  normalizeContactFieldsTool,
} from "./tools/normalizeContact.js";
import {
  normalizeCompanyNameInputSchema,
  normalizeCompanyNameTool,
} from "./tools/normalizeName.js";
import {
  scoreRecordQualityInputSchema,
  scoreRecordQualityTool,
} from "./tools/quality.js";

type ToolInputSchema = {
  type: "object";
  properties?: Record<string, object>;
  required?: string[];
  [key: string]: unknown;
};

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  validator: ZodTypeAny;
  handler: (input: any) => unknown;
};

const toolDefinitions: ToolDefinition[] = [
  {
    name: "normalize_company_name",
    description: "Normalize a company name by cleaning punctuation and stripping legal suffixes.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
    validator: normalizeCompanyNameInputSchema,
    handler: normalizeCompanyNameTool,
  },
  {
    name: "normalize_contact_fields",
    description: "Normalize contact fields (phone, email, website).",
    inputSchema: {
      type: "object",
      properties: {
        phone: { type: "string" },
        email: { type: "string" },
        website: { type: "string" },
        default_country: { type: "string", minLength: 2, maxLength: 2 },
      },
    },
    validator: normalizeContactFieldsInputSchema,
    handler: normalizeContactFieldsTool,
  },
  {
    name: "dedupe_records",
    description: "Find likely duplicate records using fuzzy name, domain, and phone matching.",
    inputSchema: {
      type: "object",
      properties: {
        records: { type: "array", items: { type: "object" } },
        min_score: { type: "number", minimum: 0, maximum: 1 },
        default_country: { type: "string", minLength: 2, maxLength: 2 },
      },
      required: ["records"],
    },
    validator: dedupeRecordsInputSchema,
    handler: dedupeRecordsTool,
  },
  {
    name: "cluster_entities",
    description: "Cluster related records into entities using dedupe score thresholds.",
    inputSchema: {
      type: "object",
      properties: {
        records: { type: "array", items: { type: "object" } },
        threshold: { type: "number", minimum: 0, maximum: 1 },
        default_country: { type: "string", minLength: 2, maxLength: 2 },
      },
      required: ["records"],
    },
    validator: clusterEntitiesInputSchema,
    handler: clusterEntitiesTool,
  },
  {
    name: "score_record_quality",
    description: "Score a single record quality (0-1) and report missing fields/issues.",
    inputSchema: {
      type: "object",
      properties: {
        record: { type: "object" },
        record_index: { type: "integer", minimum: 0 },
        default_country: { type: "string", minLength: 2, maxLength: 2 },
      },
      required: ["record"],
    },
    validator: scoreRecordQualityInputSchema,
    handler: scoreRecordQualityTool,
  },
  {
    name: "export_clean_dataset",
    description: "Run normalization, dedupe, clustering, and quality scoring in one pipeline.",
    inputSchema: {
      type: "object",
      properties: {
        records: { type: "array", items: { type: "object" } },
        dedupe_threshold: { type: "number", minimum: 0, maximum: 1 },
        default_country: { type: "string", minLength: 2, maxLength: 2 },
      },
      required: ["records"],
    },
    validator: exportCleanDatasetInputSchema,
    handler: exportCleanDatasetTool,
  },
];

const toolMap = new Map(toolDefinitions.map((tool) => [tool.name, tool]));

const server = new Server(
  {
    name: "dirty-business-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Tool[] = toolDefinitions.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));

  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const def = toolMap.get(name);

  if (!def) {
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
    };
  }

  const rawArgs = request.params.arguments ?? {};
  const parsed = def.validator.safeParse(rawArgs);

  if (!parsed.success) {
    const error = parsed.error.flatten();
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: "Validation failed", details: error }) }],
    };
  }

  const result = def.handler(parsed.data);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("dirty-business-mcp server failed:", error);
  process.exit(1);
});
