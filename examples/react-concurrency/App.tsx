import React, {
  memo,
  useState,
  useTransition,
  useLayoutEffect,
  useRef,
} from "react";
type Mode = "sync" | "transition" | "reduced" | "blocking";
const modes: { id: Mode; label: string }[] = [
  { id: "sync", label: "普通更新" },
  { id: "transition", label: "Transition" },
  { id: "reduced", label: "减少工作量" },
  { id: "blocking", label: "同步计算反例" },
];
// 确定性 CPU 工作，模拟单行计算，不在 render 内读写时钟或外部状态。
export function score(seed: number, rounds: number): number {
  let n = seed | 0;
  for (let i = 0; i < rounds; i++)
    n = (Math.imul(n ^ i, 1664525) + 1013904223) | 0;
  return n >>> 0;
}
function Row({
  index,
  query,
  rounds,
}: {
  index: number;
  query: string;
  rounds: number;
}) {
  const value = score(index + query.length, rounds);
  return (
    <div data-result-row={index} style={{ padding: "3px 8px", borderBottom: "1px solid #eee" }}>
      {index + 1}. {query || "全部"} · {value}
    </div>
  );
}
const Results = memo(function Results({
  query,
  count,
  rounds,
}: {
  query: string;
  count: number;
  rounds: number;
}) {
  return (
    <div>
      {Array.from({ length: count }, (_, index) => (
        <Row key={index} index={index} query={query} rounds={rounds} />
      ))}
    </div>
  );
});
export default function App() {
  const [mode, setMode] = useState<Mode>("sync");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [count, setCount] = useState(800);
  const [rounds, setRounds] = useState(16000);
  const [pending, startTransition] = useTransition();
  const lastInput = useRef<{ text: string; at: number } | null>(null);
  const visibleCount = mode === "reduced" ? Math.min(count, 40) : count;
  useLayoutEffect(() => {
    const sample = lastInput.current;
    if (!sample || sample.text !== text) return;
    console.log("[输入提交代理指标 ms]", {
      mode,
      text,
      elapsed: +(performance.now() - sample.at).toFixed(2),
    });
    lastInput.current = null;
  }, [text, mode]);
  function change(next: string) {
    lastInput.current = { text: next, at: performance.now() };
    setText(next);
    if (mode === "transition" || mode === "blocking")
      startTransition(() => {
        if (mode === "blocking")
          console.log("[同步计算校验值]", score(next.length, count * rounds));
        setQuery(next);
      });
    else setQuery(next);
  }
  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: 20,
        maxWidth: 760,
        margin: "auto",
      }}
    >
      <h2>同一个输入框，四种工作安排</h2>
      <p>
        连续输入 abcdef，观察输入、列表标题、pending
        和控制台。先用默认规模，再按机器能力调整。
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            style={{
              padding: 8,
              background: mode === m.id ? "#cce6db" : "#fff",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p>
        <label>
          行数{" "}
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          >
            {[200, 800, 1600].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>{" "}
        <label>
          每行迭代{" "}
          <select
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          >
            {[4000, 16000, 48000].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </p>
      <input
        aria-label="实验输入"
        value={text}
        onChange={(e) => change(e.target.value)}
        placeholder="连续输入 abcdef"
        style={{ width: "100%", boxSizing: "border-box", padding: 10 }}
      />
      <p role="status">
        输入：{text || "空"} ｜ 列表参数：{query || "空"} ｜{" "}
        {pending ? "pending：正在准备列表" : "已提交"}
      </p>
      <p>
        当前渲染 {visibleCount} 行；减少工作量只显示前 40
        行，是分页的简化示意，不是完整虚拟列表。
      </p>
      <div
        style={{
          height: 280,
          overflow: "auto",
          opacity: pending ? 0.6 : 1,
          border: "1px solid #bbb",
        }}
      >
        <Results query={query} count={visibleCount} rounds={rounds} />
      </div>
    </main>
  );
}
