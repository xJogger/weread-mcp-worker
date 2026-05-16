export interface WeReadGatewayRequest {
  api_name: string;
  skill_version: string;
  [key: string]: unknown;
}

export type WeReadGatewayResponse = Record<string, unknown>;

export interface WeReadBookSummary {
  bookId: string;
  title?: string;
  author?: string;
  cover?: string;
  category?: string;
  readingUrl?: string;
  webUrl?: string;
}

export interface WeReadToolContext {
  apiKey: string;
  env: Env;
}
