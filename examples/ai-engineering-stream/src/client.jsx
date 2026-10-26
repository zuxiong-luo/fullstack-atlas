import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import { applyEvent } from "./client-state.mjs";
function App() {
  const [question, setQuestion] = useState("账号没有权限怎么办？");
  const [view, setView] = useState({
    id: "",
    lastId: 0,
    text: "",
    status: "idle",
  });
  const cursor = useRef(0);
  const { id: runId, status } = view;
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (
      !runId ||
      paused ||
      ["completed", "cancelled", "failed"].includes(status)
    )
      return;
    const source = new EventSource(
      `/runs/${runId}/events?after=${cursor.current}`,
    );
    let lastSeen = cursor.current;
    let disposed = false;
    for (const type of ["started", "delta", "completed", "cancelled", "failed"])
      source.addEventListener(type, (event) => {
        if (disposed) return;
        const message = {
          id: Number(event.lastEventId),
          type,
          data: JSON.parse(event.data),
        };
        if (message.id <= lastSeen) return;
        if (message.id !== lastSeen + 1) {
          source.close();
          setError("事件有缺口，请重新开始");
          setView((current) => ({ ...current, status: "failed" }));
          return;
        }
        lastSeen = message.id;
        cursor.current = message.id;
        setView((current) =>
          current.id === runId ? applyEvent(current, message) : current,
        );
        if (["completed", "cancelled", "failed"].includes(type)) source.close();
      });
    source.onerror = () =>
      setError("连接异常；临时断线会尝试续接。若本地服务已重启，请刷新页面重新创建任务。");
    source.onopen = () => setError("");
    return () => {
      disposed = true;
      source.close();
    };
  }, [runId, paused, status]);
  async function start() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!response.ok) throw new Error("创建失败：" + response.status);
      const { id } = await response.json();
      cursor.current = 0;
      setPaused(false);
      setView({ id, lastId: 0, text: "", status: "running" });
    } catch (error) {
      setError(error.message);
    } finally {
      setCreating(false);
    }
  }
  async function cancel() {
    try {
      const response = await fetch(`/runs/${view.id}/cancel`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("取消失败");
      setPaused(false);
    } catch (error) {
      setError(error.message);
    }
  }
  return (
    <main>
      <h1>内部知识助手 · 流式交互实验</h1>
      <p>本地确定性文本生成器，不调用真实模型。</p>
      <label htmlFor="question">问题</label>
      <textarea
        id="question"
        value={question}
        maxLength={2000}
        onChange={(e) => setQuestion(e.target.value)}
      />
      <div className="actions">
        <button
          disabled={creating || view.status === "running"}
          onClick={start}
        >
          开始
        </button>
        <button
          disabled={view.status !== "running"}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "继续接收" : "暂停接收"}
        </button>
        <button disabled={view.status !== "running"} onClick={cancel}>
          取消任务
        </button>
      </div>
      <p role="status">
        状态：{view.status} · 已接收事件：{view.lastId}
        {paused ? " · 接收已暂停" : ""}
      </p>
      <output>{view.text || "等待输出…"}</output>
      <p role="alert">{error}</p>
      <p>
        暂停只关闭订阅，后台继续。取消会向后台发出取消请求。本例事件仅保留在进程内，重启不恢复。
      </p>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
