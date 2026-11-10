// Gemini 호출의 generationConfig를 만드는 순수 함수.
// Gemini의 사고(thinking) 토큰은 maxOutputTokens 예산을 함께 소모한다.
// 사고 수준을 낮추고 한도를 넉넉히 두지 않으면 코드가 끝나기 전에 MAX_TOKENS로 잘린다.
export function buildGoogleGenerationConfig() {
  return {
    maxOutputTokens: 16384,
    thinkingConfig: { thinkingLevel: 'low' },
  };
}
