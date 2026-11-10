import { useEffect, useRef } from 'react';

interface StreamingCardProps {
  code: string;
}

// 생성 중인 코드를 실시간으로 보여주는 카드. 완료되면 사라지고 미리보기 탭이 기본인 ComponentCard로 대체된다.
export function StreamingCard({ code }: StreamingCardProps) {
  const blockRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const block = blockRef.current;
    if (block) block.scrollTop = block.scrollHeight;
  }, [code]);

  return (
    <div className="window component-card streaming-card" role="status" aria-live="polite">
      <div className="titlebar">
        <span className="titlebar-title">생성 중</span>
      </div>
      <div className="card-tabs">
        <button className="tab" disabled>
          미리보기
        </button>
        <button className="tab tab--active" disabled>
          코드
        </button>
      </div>
      <div className="card-content">
        <div className="code-panel">
          <div className="panel-header">
            <h3>코드</h3>
            <span className="streaming-status">
              {code ? '코드를 작성하고 있습니다...' : '응답을 기다리고 있습니다...'}
            </span>
          </div>
          <div className="progress" aria-hidden="true">
            <div className="progress-bar" />
          </div>
          <pre className="code-block" ref={blockRef}>
            <code>{code}</code>
            <span className="streaming-caret" aria-hidden="true" />
          </pre>
        </div>
      </div>
    </div>
  );
}
