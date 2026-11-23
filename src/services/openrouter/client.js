import { config } from '../../lib/config.js';
import { logger } from '../../lib/logger.js';

/**
 * Thin OpenRouter HTTP client. No model IDs hardcoded — caller passes model.
 */
export async function openRouterChat({ model, messages, temperature = 0.4, responseFormat }) {
  if (!config.openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  if (!model) {
    throw new Error('model is required (routed via ROUTE_* model tiers)');
  }

  const headers = {
    Authorization: `Bearer ${config.openRouterApiKey}`,
    'Content-Type': 'application/json',
  };
  if (config.openRouterSiteUrl) headers['HTTP-Referer'] = config.openRouterSiteUrl;
  if (config.openRouterSiteName) headers['X-Title'] = config.openRouterSiteName;

  const body = {
    model,
    messages,
    temperature,
  };
  if (responseFormat) body.response_format = responseFormat;

  const res = await fetch(`${config.openRouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error('openrouter_error', { status: res.status, text: text.slice(0, 500) });
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content ?? '';
  return { content, raw: json, model };
}

export async function openRouterEmbed({ model, input }) {
  if (!config.openRouterApiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }
  const embedModel = model || config.embeddingModel;
  if (!embedModel) throw new Error('EMBEDDING_MODEL is not set');

  const headers = {
    Authorization: `Bearer ${config.openRouterApiKey}`,
    'Content-Type': 'application/json',
  };
  if (config.openRouterSiteUrl) headers['HTTP-Referer'] = config.openRouterSiteUrl;
  if (config.openRouterSiteName) headers['X-Title'] = config.openRouterSiteName;

  const res = await fetch(`${config.openRouterBaseUrl}/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model: embedModel, input }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter embeddings ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  return json?.data?.[0]?.embedding ?? [];
}
