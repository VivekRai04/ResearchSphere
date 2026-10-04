const stopWords = new Set([
  "about", "after", "also", "among", "and", "are", "been", "between", "but",
  "can", "could", "for", "from", "have", "into", "its", "more", "not", "our",
  "over", "research", "should", "such", "than", "that", "the", "their", "this",
  "through", "was", "were", "which", "with", "would",
]);

function terms(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g)
    ?.filter((term) => !stopWords.has(term)) ?? [];
}

function weights(tokens: string[], inverseDocumentFrequency: Map<string, number>) {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const result = new Map<string, number>();
  for (const [token, count] of counts) {
    const tf = 1 + Math.log(count);
    result.set(token, tf * (inverseDocumentFrequency.get(token) ?? 0));
  }
  return result;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [term, value] of a) {
    dot += value * (b.get(term) ?? 0);
    normA += value * value;
  }
  for (const value of b.values()) normB += value * value;
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}

export function rankByTfidf<T>(
  records: T[],
  query: string,
  toText: (record: T) => string,
): Array<{ record: T; score: number }> {
  const documentTokens = records.map((record) => terms(toText(record)));
  const allTokens = [...documentTokens, terms(query)];
  const documentFrequency = new Map<string, number>();
  for (const tokens of documentTokens) {
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const idf = new Map<string, number>();
  for (const token of new Set(allTokens.flat())) {
    idf.set(token, Math.log(1 + (records.length + 1) /
      (1 + (documentFrequency.get(token) ?? 0))));
  }
  const queryVector = weights(terms(query), idf);
  return records.map((record, index) => ({
    record,
    score: cosine(weights(documentTokens[index], idf), queryVector),
  })).sort((a, b) => b.score - a.score);
}