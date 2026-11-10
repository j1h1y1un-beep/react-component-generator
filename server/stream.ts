// 제공자의 SSE 스트림에서 텍스트 조각을 추출하는 순수 함수들.
// 부수효과(Bun.serve, fetch 등)가 없어 단위 테스트가 가능하다.

/** 청크 단위로 SSE 텍스트를 받아, 완성된 이벤트의 data 페이로드 목록을 반환하는 파서를 만든다. */
export function createSseParser(): (chunk: string) => string[] {
  let buffer = '';

  return (chunk) => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    return events.flatMap((event) =>
      event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim()),
    );
  };
}

/** Anthropic 스트림 이벤트(JSON)에서 텍스트 조각을 꺼낸다. error 이벤트는 예외로 던진다. */
export function extractAnthropicDelta(data: string): string {
  const event = JSON.parse(data) as {
    type: string;
    delta?: { type?: string; text?: string };
    error?: { message?: string };
  };

  if (event.type === 'error') {
    throw new Error(event.error?.message ?? 'Claude API stream error');
  }
  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return event.delta.text ?? '';
  }
  return '';
}

/** Gemini 스트림 청크(JSON)에서 텍스트 조각을 꺼낸다. MAX_TOKENS 잘림은 예외로 던진다. */
export function extractGoogleDelta(data: string): string {
  const chunk = JSON.parse(data) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = chunk.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') {
    throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
  }
  return candidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
}
