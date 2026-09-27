// lib/webmcp-tool.d.ts — TypeScript type declarations
// 實際匯入目標：同目錄 webmcp-tool.mjs

export declare const WEBMCP_TOOL: {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
};

export declare function runGetQuote(args: Record<string, unknown>): {
  ok: boolean;
  error?: string;
  errors?: string[];
  message?: string;
  lineUrl?: string;
  mailtoUrl?: string;
  next?: string[];
};

export declare function buildWebMCPTool(): {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => ReturnType<typeof runGetQuote>;
};
