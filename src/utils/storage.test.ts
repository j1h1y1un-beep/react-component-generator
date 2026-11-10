import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadStored, saveStored } from './storage';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('저장된 값이 없으면 fallback을 반환한다', () => {
    expect(loadStored('k', 'fallback')).toBe('fallback');
  });

  it('저장한 값을 같은 형태로 읽어온다', () => {
    saveStored('k', { a: [1, 2] });
    expect(loadStored('k', null)).toEqual({ a: [1, 2] });
  });

  it('JSON이 깨져 있으면 fallback을 반환한다', () => {
    localStorage.setItem('k', '{not json');
    expect(loadStored('k', 'fallback')).toBe('fallback');
  });

  it('validate를 통과하지 못한 값이면 fallback을 반환한다', () => {
    saveStored('k', 'unknown');
    const isNumber = (v: unknown): v is number => typeof v === 'number';
    expect(loadStored('k', 0, isNumber)).toBe(0);
  });

  it('localStorage 접근이 실패해도 읽기는 fallback을 반환한다', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadStored('k', 'fallback')).toBe('fallback');
  });

  it('localStorage 쓰기가 실패해도 예외를 던지지 않는다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveStored('k', 'v')).not.toThrow();
  });
});
