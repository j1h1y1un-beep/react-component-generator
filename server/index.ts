import { stripCodeFences, ensureRenderCall } from './generator';
import { withModelFallback } from './fallback';
import { buildGoogleGenerationConfig } from './googleConfig';
import { createSseParser, extractAnthropicDelta, extractGoogleDelta } from './stream';

// 우선순위 순서. 앞 모델이 실패하면 다음 모델로 폴백한다.
const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];

const SYSTEM_PROMPT = `You are a React component generator. Generate a single React component based on the user's description.

Rules:
- Use inline styles only (no CSS imports, no CSS modules)
- Do NOT use import statements — React is already available in scope as a global
- Define the component as a function, then call render(<ComponentName />) at the end
- Make the component visually appealing with proper styling
- Use React hooks if needed (e.g., React.useState, React.useEffect)
- The component must be completely self-contained
- Respond with ONLY the code block — no explanations, no markdown fences
- Use descriptive variable names and clean formatting
- For colors, prefer modern palettes (gradients, shadows, etc.)
- Ensure the component is interactive where appropriate (hover states, click handlers, etc.)
- Do NOT use TypeScript syntax — no type annotations, no interfaces, no generics, no "as" casts. Write plain JavaScript only.

Example output format:
const GradientButton = () => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      style={{
        background: hovered
          ? 'linear-gradient(135deg, #667eea, #764ba2)'
          : 'linear-gradient(135deg, #764ba2, #667eea)',
        color: 'white',
        border: 'none',
        padding: '12px 24px',
        borderRadius: '8px',
        fontSize: '16px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      Click me
    </button>
  );
};

render(<GradientButton />);`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

type Provider = 'anthropic' | 'google';

const ENV_KEYS: Record<Provider, string | undefined> = {
  anthropic: process.env.ANTHROPIC_API_KEY,
  google: process.env.GOOGLE_API_KEY,
};

function resolveApiKey(provider: Provider, clientKey?: string): string | null {
  return clientKey || ENV_KEYS[provider] || null;
}

// 제공자 스트리밍 응답을 연다. 스트림 시작 전 실패(인증·과부하 등)는 여기서 던져 상태코드로 매핑한다.
async function openAnthropicStream(prompt: string, apiKey: string): Promise<Response> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }
  return response;
}

async function openGoogleStream(prompt: string, apiKey: string, model: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: buildGoogleGenerationConfig(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }
  return response;
}

async function openGoogle(prompt: string, apiKey: string): Promise<Response> {
  return withModelFallback(GOOGLE_MODELS, (model) => openGoogleStream(prompt, apiKey, model));
}

function mapError(err: unknown): { status: number; error: string } {
  const message = err instanceof Error ? err.message : 'Unknown error';

  if (message.includes('503')) {
    return { status: 503, error: 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.' };
  }
  if (message.includes('429')) {
    return { status: 429, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' };
  }
  return { status: 500, error: message };
}

// 제공자 SSE 스트림을 클라이언트용 NDJSON 이벤트(delta/done/error)로 변환한다.
function toClientStream(upstream: Response, provider: Provider): ReadableStream<Uint8Array> {
  const extractDelta = provider === 'google' ? extractGoogleDelta : extractAnthropicDelta;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const parse = createSseParser();

  return new ReadableStream({
    async start(controller) {
      // 클라이언트가 연결을 끊으면 enqueue/close가 던지므로 무시한다.
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          /* 이미 닫힌 스트림 */
        }
      };
      let full = '';

      const handleSse = (text: string) => {
        for (const data of parse(text)) {
          const delta = extractDelta(data);
          if (delta) {
            full += delta;
            send({ type: 'delta', text: delta });
          }
        }
      };

      try {
        for await (const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>) {
          handleSse(decoder.decode(chunk, { stream: true }));
        }
        // 마지막 이벤트가 빈 줄 없이 끝나도 처리되도록 잔여 버퍼를 비운다.
        handleSse(`${decoder.decode()}\n\n`);
        send({ type: 'done', code: ensureRenderCall(stripCodeFences(full)) });
      } catch (err) {
        send({ type: 'error', error: mapError(err).error });
      } finally {
        try {
          controller.close();
        } catch {
          /* 이미 닫힌 스트림 */
        }
      }
    },
  });
}

const server = Bun.serve({
  port: 3002,
  async fetch(req) {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/api/config') {
      return Response.json(
        {
          envKeys: {
            anthropic: !!ENV_KEYS.anthropic,
            google: !!ENV_KEYS.google,
          },
        },
        { headers: CORS_HEADERS }
      );
    }

    if (req.method === 'POST' && url.pathname === '/api/generate') {
      try {
        const { prompt, apiKey, provider = 'anthropic' } = (await req.json()) as {
          prompt: string;
          apiKey?: string;
          provider?: Provider;
        };

        const resolvedKey = resolveApiKey(provider, apiKey);

        if (!resolvedKey) {
          return Response.json(
            { error: `API key is required. Set ${provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GOOGLE_API_KEY'} in .env or enter it manually.` },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        if (!prompt) {
          return Response.json(
            { error: 'Prompt is required' },
            { status: 400, headers: CORS_HEADERS }
          );
        }

        const upstream =
          provider === 'google'
            ? await openGoogle(prompt, resolvedKey)
            : await openAnthropicStream(prompt, resolvedKey);

        return new Response(toClientStream(upstream, provider), {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (err) {
        const { status, error } = mapError(err);
        return Response.json({ error }, { status, headers: CORS_HEADERS });
      }
    }

    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  },
});

console.log(`API server running at http://localhost:${server.port}`);
