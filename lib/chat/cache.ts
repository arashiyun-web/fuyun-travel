// Reserved extension point. No response caching or PII persistence is enabled.
export interface SimpleQuestionCache {
  get(key: string): Promise<string | null>;
  set(key: string, answer: string, ttlSeconds: number): Promise<void>;
}
