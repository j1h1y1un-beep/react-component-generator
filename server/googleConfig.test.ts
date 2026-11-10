import { describe, it, expect } from 'vitest';
import { buildGoogleGenerationConfig } from './googleConfig';

describe('buildGoogleGenerationConfig', () => {
  it('사고 토큰이 출력 예산을 잠식하지 않도록 사고 수준을 낮춘다', () => {
    expect(buildGoogleGenerationConfig().thinkingConfig).toEqual({ thinkingLevel: 'low' });
  });

  it('긴 컴포넌트 코드도 담을 수 있도록 출력 한도를 16384 이상으로 둔다', () => {
    expect(buildGoogleGenerationConfig().maxOutputTokens).toBeGreaterThanOrEqual(16384);
  });
});
