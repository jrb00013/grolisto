/** Rough token estimate — ~4 chars/token for packing budgets. */
export function estimateTokens(text) {
  const s = String(text || '');
  if (!s) return 0;
  return Math.ceil(s.length / 4);
}

export function estimateMessagesTokens(messages = []) {
  return messages.reduce((n, m) => n + estimateTokens(m?.content) + 4, 0);
}

export function truncateToTokens(text, maxTokens) {
  const s = String(text || '');
  const maxChars = Math.max(0, Math.floor(maxTokens * 4));
  if (s.length <= maxChars) return s;
  return `${s.slice(0, Math.max(0, maxChars - 16))}…[truncated]`;
}
