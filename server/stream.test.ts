import { describe, it, expect } from 'vitest';
import { createSseParser, extractAnthropicDelta, extractGoogleDelta } from './stream';

describe('createSseParser', () => {
  it('완성된 이벤트의 data 페이로드를 반환한다', () => {
    const parse = createSseParser();
    expect(parse('data: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('청크 경계에서 잘린 이벤트는 다음 청크와 합쳐서 처리한다', () => {
    const parse = createSseParser();
    expect(parse('data: {"a"')).toEqual([]);
    expect(parse(':1}\n\ndata: {"b":2}\n\n')).toEqual(['{"a":1}', '{"b":2}']);
  });

  it('event: 줄과 CRLF 줄바꿈을 무시하고 data만 추출한다', () => {
    const parse = createSseParser();
    expect(parse('event: content_block_delta\r\ndata: {"x":1}\r\n\r\n')).toEqual(['{"x":1}']);
  });
});

describe('extractAnthropicDelta', () => {
  it('content_block_delta의 text_delta 텍스트를 꺼낸다', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(extractAnthropicDelta(data)).toBe('const A');
  });

  it('텍스트가 없는 이벤트는 빈 문자열을 반환한다', () => {
    expect(extractAnthropicDelta(JSON.stringify({ type: 'message_start' }))).toBe('');
  });

  it('error 이벤트는 예외를 던진다', () => {
    const data = JSON.stringify({ type: 'error', error: { message: 'overloaded' } });
    expect(() => extractAnthropicDelta(data)).toThrow('overloaded');
  });
});

describe('extractGoogleDelta', () => {
  it('candidates의 parts 텍스트를 이어 붙인다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'foo' }, { text: 'bar' }] } }],
    });
    expect(extractGoogleDelta(data)).toBe('foobar');
  });

  it('텍스트가 없으면 빈 문자열을 반환한다', () => {
    expect(extractGoogleDelta(JSON.stringify({ candidates: [{}] }))).toBe('');
  });

  it('finishReason이 MAX_TOKENS이면 잘림 에러를 던진다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(() => extractGoogleDelta(data)).toThrow('잘렸습니다');
  });
});
