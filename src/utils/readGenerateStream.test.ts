import { describe, it, expect, vi } from 'vitest';
import { readGenerateStream } from './readGenerateStream';

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

const line = (event: object) => `${JSON.stringify(event)}\n`;

describe('readGenerateStream', () => {
  it('delta 이벤트마다 누적된 코드를 콜백으로 전달한다', async () => {
    const onProgress = vi.fn();
    await readGenerateStream(
      streamOf(
        line({ type: 'delta', text: 'const ' }),
        line({ type: 'delta', text: 'A' }),
        line({ type: 'done', code: 'const A' }),
      ),
      onProgress,
    );

    expect(onProgress.mock.calls.map((c) => c[0])).toEqual(['const ', 'const A']);
  });

  it('done 이벤트의 최종 코드를 반환한다', async () => {
    const code = await readGenerateStream(
      streamOf(line({ type: 'delta', text: '```js\nx' }), line({ type: 'done', code: 'x' })),
      () => {},
    );
    expect(code).toBe('x');
  });

  it('청크 경계에서 잘린 줄도 올바르게 이어 붙인다', async () => {
    const full = line({ type: 'done', code: 'ok' });
    const code = await readGenerateStream(streamOf(full.slice(0, 7), full.slice(7)), () => {});
    expect(code).toBe('ok');
  });

  it('error 이벤트는 해당 메시지로 예외를 던진다', async () => {
    await expect(
      readGenerateStream(streamOf(line({ type: 'error', error: '과부하' })), () => {}),
    ).rejects.toThrow('과부하');
  });

  it('error 이벤트로 중단하면 남은 스트림을 취소해 연결을 정리한다', async () => {
    const cancel = vi.fn();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(line({ type: 'error', error: '과부하' })));
      },
      cancel,
    });

    await expect(readGenerateStream(body, () => {})).rejects.toThrow('과부하');
    expect(cancel).toHaveBeenCalled();
  });

  it('done의 코드가 비어 있으면 빈 컴포넌트 대신 예외를 던진다', async () => {
    await expect(
      readGenerateStream(streamOf(line({ type: 'done', code: '' })), () => {}),
    ).rejects.toThrow('비어');
  });

  it('done 없이 스트림이 끝나면 예외를 던진다', async () => {
    await expect(
      readGenerateStream(streamOf(line({ type: 'delta', text: 'x' })), () => {}),
    ).rejects.toThrow();
  });
});
