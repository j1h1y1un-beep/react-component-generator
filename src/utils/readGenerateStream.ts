// /api/generate 의 NDJSON 스트림을 읽어 진행 중인 코드를 콜백으로 전달하고, 최종 코드를 반환한다.
// 이벤트: { type: 'delta', text } | { type: 'done', code } | { type: 'error', error }

type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; error: string };

export async function readGenerateStream(
  body: ReadableStream<Uint8Array>,
  onProgress: (partialCode: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let partial = '';
  let finalCode: string | null = null;

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as StreamEvent;
    if (event.type === 'delta') {
      partial += event.text;
      onProgress(partial);
    } else if (event.type === 'done') {
      if (!event.code.trim()) {
        throw new Error('생성된 코드가 비어 있습니다. 다시 시도해주세요.');
      }
      finalCode = event.code;
    } else if (event.type === 'error') {
      throw new Error(event.error);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      lines.forEach(handleLine);
    }
    handleLine(buffer);
  } catch (err) {
    // 에러 이벤트나 파싱 실패로 중단하면 남은 스트림을 취소해 연결을 정리한다.
    await reader.cancel().catch(() => {});
    throw err;
  }

  if (finalCode === null) {
    throw new Error('생성 응답이 중간에 끊겼습니다. 다시 시도해주세요.');
  }
  return finalCode;
}
