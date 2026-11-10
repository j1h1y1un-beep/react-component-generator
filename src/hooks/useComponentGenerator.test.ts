import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

function mockFetchOk(code = 'render(<div />)') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code }) }),
  );
}

describe('useComponentGenerator 영속화', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('생성한 컴포넌트가 localStorage에 저장되어 새로 마운트해도 복원된다', async () => {
    mockFetchOk('render(<b />)');
    const first = renderHook(() => useComponentGenerator());
    await act(() => first.result.current.generate('카드', undefined, 'google'));
    first.unmount();

    const second = renderHook(() => useComponentGenerator());
    expect(second.result.current.components).toHaveLength(1);
    expect(second.result.current.components[0].prompt).toBe('카드');
    expect(second.result.current.components[0].code).toBe('render(<b />)');
  });

  it('복원된 컴포넌트의 createdAt은 Date 객체다', async () => {
    mockFetchOk();
    const first = renderHook(() => useComponentGenerator());
    await act(() => first.result.current.generate('카드', undefined, 'google'));
    first.unmount();

    const second = renderHook(() => useComponentGenerator());
    expect(second.result.current.components[0].createdAt).toBeInstanceOf(Date);
  });

  it('형식이 깨진 저장 데이터는 무시하고 빈 목록으로 시작한다', () => {
    localStorage.setItem('rcg:components', JSON.stringify([{ id: 1 }, 'x', null]));
    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.components).toEqual([]);
  });

  it('컴포넌트를 삭제하면 저장소에도 반영된다', async () => {
    mockFetchOk();
    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('카드', undefined, 'google'));
    act(() => result.current.removeComponent(result.current.components[0].id));

    expect(JSON.parse(localStorage.getItem('rcg:components')!)).toEqual([]);
  });
});

describe('useComponentGenerator 프롬프트 히스토리', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('생성 요청한 프롬프트가 최신순으로 쌓인다', async () => {
    mockFetchOk();
    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('첫째', undefined, 'google'));
    await act(() => result.current.generate('둘째', undefined, 'google'));

    expect(result.current.promptHistory).toEqual(['둘째', '첫째']);
  });

  it('같은 프롬프트를 다시 보내면 중복 없이 맨 앞으로 올라온다', async () => {
    mockFetchOk();
    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('A', undefined, 'google'));
    await act(() => result.current.generate('B', undefined, 'google'));
    await act(() => result.current.generate('A', undefined, 'google'));

    expect(result.current.promptHistory).toEqual(['A', 'B']);
  });

  it('최대 50개까지만 보관한다', async () => {
    mockFetchOk();
    const { result } = renderHook(() => useComponentGenerator());
    for (let i = 0; i < 55; i++) {
      await act(() => result.current.generate(`p${i}`, undefined, 'google'));
    }

    expect(result.current.promptHistory).toHaveLength(50);
    expect(result.current.promptHistory[0]).toBe('p54');
  });

  it('생성이 실패해도 프롬프트는 히스토리에 남는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: '실패' }) }),
    );
    const { result } = renderHook(() => useComponentGenerator());
    await act(() => result.current.generate('실패할 요청', undefined, 'google'));

    expect(result.current.promptHistory).toEqual(['실패할 요청']);
  });

  it('히스토리가 localStorage에 저장되어 새로 마운트해도 복원된다', async () => {
    mockFetchOk();
    const first = renderHook(() => useComponentGenerator());
    await act(() => first.result.current.generate('유지될 프롬프트', undefined, 'google'));
    first.unmount();

    const second = renderHook(() => useComponentGenerator());
    expect(second.result.current.promptHistory).toEqual(['유지될 프롬프트']);
  });
});
