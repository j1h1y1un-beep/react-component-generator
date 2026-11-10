import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PromptInput } from './PromptInput';

describe('PromptInput', () => {
  it('프롬프트가 비어 있으면 생성 버튼이 비활성이다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('입력하면 버튼이 활성화되고 클릭 시 입력값으로 onGenerate가 호출된다', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);

    await user.type(screen.getByRole('textbox'), '프로필 카드');
    const submit = screen.getByRole('button', { name: '컴포넌트 생성' });
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onGenerate).toHaveBeenCalledWith('프로필 카드');
  });

  it('로딩 중에는 생성 버튼이 비활성이고 "생성 중..." 을 보여준다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={true} />);
    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled();
  });

  it('입력 글자 수를 "현재/500" 형태로 보여준다', async () => {
    const user = userEvent.setup();
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

    expect(screen.getByText('0/500')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox'), '카드');
    expect(screen.getByText('2/500')).toBeInTheDocument();
  });

  it('500자를 넘으면 경고를 보여주고 생성 버튼이 비활성이다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a'.repeat(501) } });

    expect(screen.getByRole('alert')).toHaveTextContent('500자');
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeDisabled();
  });

  it('500자 이하면 경고가 없다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a'.repeat(500) } });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '컴포넌트 생성' })).toBeEnabled();
  });

  it('history가 있으면 최근 프롬프트 목록을 보여준다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} history={['카드 만들기', '표 만들기']} />);

    expect(screen.getByText('최근 프롬프트')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '카드 만들기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '표 만들기' })).toBeInTheDocument();
  });

  it('history가 비어 있으면 최근 프롬프트 영역을 보여주지 않는다', () => {
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} history={[]} />);

    expect(screen.queryByText('최근 프롬프트')).not.toBeInTheDocument();
  });

  it('최근 프롬프트를 클릭하면 입력창에 채워진다', async () => {
    const user = userEvent.setup();
    render(<PromptInput onGenerate={vi.fn()} isLoading={false} history={['카드 만들기']} />);

    await user.click(screen.getByRole('button', { name: '카드 만들기' }));

    expect(screen.getByRole('textbox')).toHaveValue('카드 만들기');
  });

  it('500자 초과 상태에서 Ctrl+Enter를 눌러도 onGenerate가 호출되지 않는다', () => {
    const onGenerate = vi.fn();
    render(<PromptInput onGenerate={onGenerate} isLoading={false} />);
    const textbox = screen.getByRole('textbox');

    fireEvent.change(textbox, { target: { value: 'a'.repeat(501) } });
    fireEvent.keyDown(textbox, { key: 'Enter', ctrlKey: true });

    expect(onGenerate).not.toHaveBeenCalled();
  });
});
