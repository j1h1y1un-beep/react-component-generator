// localStorage는 비활성화(프라이빗 모드 등)되거나 용량 초과로 실패할 수 있다.
// 저장소 문제로 앱이 멈추지 않도록 읽기는 fallback, 쓰기는 무시로 처리한다.
export function loadStored<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function saveStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패는 영속화만 포기하고 현재 세션 동작에는 영향을 주지 않는다.
  }
}
