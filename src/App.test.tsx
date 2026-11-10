import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('App 설정 영속화', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ envKeys: { anthropic: false, google: false } }),
      }),
    );
  });

  it('선택한 Provider가 새로고침 후에도 유지된다', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');
    first.unmount();

    render(<App />);
    expect(screen.getByLabelText('Provider')).toHaveValue('anthropic');
  });

  it('입력한 API 키가 새로고침 후에도 유지된다', async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await user.type(screen.getByLabelText('API Key'), 'AIza-test-key');
    first.unmount();

    render(<App />);
    expect(screen.getByLabelText('API Key')).toHaveValue('AIza-test-key');
  });

  it('저장된 Provider 값이 올바르지 않으면 기본값 google을 쓴다', () => {
    localStorage.setItem('rcg:provider', JSON.stringify('openai'));
    render(<App />);
    expect(screen.getByLabelText('Provider')).toHaveValue('google');
  });

  it('Provider를 바꾸면 이전 Provider의 API 키는 비워진다', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('API Key'), 'AIza-test-key');
    await user.selectOptions(screen.getByLabelText('Provider'), 'anthropic');

    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(JSON.parse(localStorage.getItem('rcg:apiKey')!)).toBe('');
  });
});
