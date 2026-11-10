import { describe, it, expect, vi } from 'vitest';
import { createClientStream } from './clientStream';

const encoder = new TextEncoder();

async function* chunks(...texts: string[]) {
  for (const text of texts) yield encoder.encode(text);
}

async function readEvents(stream: ReadableStream<Uint8Array>): Promise<object[]> {
  const text = await new Response(stream).text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const extractDelta = (data: string) => (JSON.parse(data) as { t: string }).t;

function build(source: AsyncIterable<Uint8Array>, overrides = {}) {
  return createClientStream({
    source,
    extractDelta,
    finalize: (full) => `final:${full}`,
    formatError: (err) => `err:${(err as Error).message}`,
    onCancel: () => {},
    ...overrides,
  });
}

describe('createClientStream', () => {
  it('종료 시 마지막 SSE 이벤트가 빈 줄 없이 끝나도 delta로 내보낸다', async () => {
    const events = await readEvents(build(chunks('data: {"t":"a"}\n\n', 'data: {"t":"b"}')));
    expect(events).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'delta', text: 'b' },
      { type: 'done', code: 'final:ab' },
    ]);
  });

  it('추출기가 던진 에러는 formatError 결과의 error 이벤트로 바꾼다', async () => {
    const boom = (data: string) => {
      if (data.includes('bad')) throw new Error('잘림');
      return extractDelta(data);
    };
    const events = await readEvents(
      build(chunks('data: {"t":"a"}\n\n', 'data: {"bad":1}\n\n'), { extractDelta: boom }),
    );
    expect(events.at(-1)).toEqual({ type: 'error', error: 'err:잘림' });
  });

  it('클라이언트가 취소하면 onCancel을 호출해 업스트림을 끊는다', async () => {
    const onCancel = vi.fn();
    async function* endless() {
      while (true) {
        yield encoder.encode('data: {"t":"x"}\n\n');
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
    const reader = build(endless(), { onCancel }).getReader();
    await reader.read();
    await reader.cancel();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
