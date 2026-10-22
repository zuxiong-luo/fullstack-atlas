import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
// 教学观测：render 日志有意属于诊断副作用，业务 render 不应依赖它。
function trace(phase: string, detail: unknown) {
  console.log("[commit-lab]", phase, JSON.stringify(detail));
}
function Probe({ value, slow }: { value: number; slow: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const attach = useCallback((node: HTMLSpanElement | null) => {
    ref.current = node;
    trace(node ? "ref attach" : "ref detach", {
      dom: node?.textContent ?? null,
    });
  }, []);
  trace("render attempt", { value });
  useLayoutEffect(() => {
    trace("layout setup", { value, dom: ref.current?.textContent ?? null });
    if (slow) {
      const until = performance.now() + 40;
      while (performance.now() < until) {
        /* 有界反例：阻塞布局Effect */
      }
    }
    return () =>
      trace("layout cleanup", {
        capturedValue: value,
        dom: ref.current?.textContent ?? null,
      });
  }, [value, slow]);
  useEffect(() => {
    trace("passive setup", { value, dom: ref.current?.textContent ?? null });
    return () =>
      trace("passive cleanup", {
        capturedValue: value,
        dom: ref.current?.textContent ?? null,
      });
  }, [value, slow]);
  return (
    <span ref={attach} data-testid="value">
      数值 {value}
    </span>
  );
}
export default function App() {
  const [value, setValue] = useState(0);
  const [visible, setVisible] = useState(true);
  const [identity, setIdentity] = useState(0);
  const [slow, setSlow] = useState(false);
  function update() {
    trace("event start", { value });
    setValue((v) => v + 1);
    trace("event end", { value });
    requestAnimationFrame(() =>
      trace("rAF callback", { note: "这是绘制前回调，不是已完成绘制的证据" }),
    );
  }
  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui",
        lineHeight: 1.7,
        maxWidth: 760,
        margin: "auto",
      }}
    >
      <h2>一次更新，哪些工作真的提交了？</h2>
      <p>
        打开控制台，依次尝试更新、替换身份、卸载。日志是教学诊断，render
        次数不代表提交次数。
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={update}>更新数值</button>
        <button onClick={() => setIdentity((k) => k + 1)}>替换 key</button>
        <button onClick={() => setVisible((v) => !v)}>
          {visible ? "卸载" : "挂载"}
        </button>
      </div>
      <p>
        <label>
          <input
            type="checkbox"
            checked={slow}
            onChange={(e) => setSlow(e.target.checked)}
          />{" "}
          布局 Effect 阻塞约 40ms（反例）
        </label>
      </p>
      <div style={{ border: "1px solid #91aa9b", padding: 16 }}>
        {visible ? (
          <Probe key={identity} value={value} slow={slow} />
        ) : (
          <span>已卸载</span>
        )}
      </div>
      <p>
        稳定 ref 回调不会仅因为 value 更新就重新 attach。Effect 清理里的
        capturedValue 是创建该清理函数时的状态；DOM
        读数则是执行清理当下的实际内容。
      </p>
    </main>
  );
}
