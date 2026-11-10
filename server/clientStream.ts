// 제공자 SSE 바이트 스트림을 클라이언트용 NDJSON 이벤트(delta/done/error)로 변환하는 순수 모듈.
// Bun.serve·fetch 같은 부수효과가 없어 단위 테스트가 가능하다.
import { createSseParser } from './stream';

interface ClientStreamOptions {
  source: AsyncIterable<Uint8Array>;
  extractDelta: (data: string) => string;
  /** 누적된 전체 텍스트를 최종 코드로 정규화한다. */
  finalize: (full: string) => string;
  formatError: (err: unknown) => string;
  /** 클라이언트가 연결을 끊으면 호출된다. 업스트림 요청을 중단하는 데 쓴다. */
  onCancel: () => void;
}

export function createClientStream({
  source,
  extractDelta,
  finalize,
  formatError,
  onCancel,
}: ClientStreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const parse = createSseParser();
  let cancelled = false;

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
        for await (const chunk of source) {
          if (cancelled) return;
          handleSse(decoder.decode(chunk, { stream: true }));
        }
        // 마지막 이벤트가 빈 줄 없이 끝나도 처리되도록 잔여 버퍼를 비운다.
        handleSse(`${decoder.decode()}\n\n`);
        send({ type: 'done', code: finalize(full) });
      } catch (err) {
        if (!cancelled) send({ type: 'error', error: formatError(err) });
      } finally {
        try {
          controller.close();
        } catch {
          /* 이미 닫힌 스트림 */
        }
      }
    },
    cancel() {
      cancelled = true;
      onCancel();
    },
  });
}
