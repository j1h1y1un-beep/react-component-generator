import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

describe('usePersistentState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('저장된 값이 없으면 초기값을 사용한다', () => {
    const { result } = renderHook(() => usePersistentState('k', 'init'));
    expect(result.current[0]).toBe('init');
  });

  it('저장된 값이 있으면 초기값 대신 그 값으로 시작한다', () => {
    localStorage.setItem('k', JSON.stringify('saved'));
    const { result } = renderHook(() => usePersistentState('k', 'init'));
    expect(result.current[0]).toBe('saved');
  });

  it('상태를 바꾸면 localStorage에 저장된다', () => {
    const { result } = renderHook(() => usePersistentState('k', 'init'));
    act(() => result.current[1]('next'));
    expect(JSON.parse(localStorage.getItem('k')!)).toBe('next');
  });

  it('validate를 통과하지 못한 저장값은 무시하고 초기값을 쓴다', () => {
    localStorage.setItem('k', JSON.stringify('bogus'));
    const isMode = (v: unknown): v is 'a' | 'b' => v === 'a' || v === 'b';
    const { result } = renderHook(() => usePersistentState<'a' | 'b'>('k', 'a', { validate: isMode }));
    expect(result.current[0]).toBe('a');
  });

  it('revive가 있으면 저장값을 복원 변환해서 쓴다', () => {
    localStorage.setItem('k', JSON.stringify('2024-01-02T03:04:05.000Z'));
    const { result } = renderHook(() =>
      usePersistentState<Date>('k', new Date(0), {
        revive: (raw) => new Date(raw as string),
      }),
    );
    expect(result.current[0]).toEqual(new Date('2024-01-02T03:04:05.000Z'));
  });
});
