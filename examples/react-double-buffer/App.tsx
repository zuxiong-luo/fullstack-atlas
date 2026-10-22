import React, { useRef, useState } from "react";
export const STATIC = 4,
  UPDATE = 1; // 教学位值，不是React真实常量。
export type Node = {
  id: string;
  alternate: Node | null;
  pendingProps: { title: string };
  memoizedProps: { title: string };
  memoizedState: { selected: boolean };
  updateQueue: object;
  child: object;
  dependencies: { firstContext: object } | null;
  flags: number;
  subtreeFlags: number;
  deletions: string[] | null;
};
export type Model = {
  current: Node;
  work: Node | null;
  visible: string;
  completed: boolean;
  created: number;
};
export function createModel(): Model {
  const props = { title: "任务 A" };
  const current: Node = {
    id: "F1",
    alternate: null,
    pendingProps: props,
    memoizedProps: props,
    memoizedState: { selected: false },
    updateQueue: {},
    child: { id: "Host-1" },
    dependencies: { firstContext: { name: "Theme" } },
    flags: STATIC,
    subtreeFlags: 0,
    deletions: null,
  };
  return {
    current,
    work: null,
    visible: props.title,
    completed: false,
    created: 1,
  };
}
export function prepare(model: Model, title: string) {
  const current = model.current;
  let work = current.alternate;
  if (!work) {
    work = { ...current, id: `F${++model.created}`, alternate: current };
    current.alternate = work;
  }
  work.pendingProps = { title };
  work.flags = current.flags & STATIC;
  work.subtreeFlags = 0;
  work.deletions = null;
  work.memoizedProps = current.memoizedProps;
  work.memoizedState = current.memoizedState;
  work.updateQueue = current.updateQueue;
  work.child = current.child;
  work.dependencies = current.dependencies ? { ...current.dependencies } : null;
  model.work = work;
  model.completed = false;
}
export function complete(model: Model) {
  if (!model.work) throw new Error("请先准备工作");
  model.work.memoizedProps = model.work.pendingProps;
  model.work.memoizedState = { selected: true };
  model.work.flags |= UPDATE;
  model.completed = true;
}
export function commit(model: Model) {
  if (!model.work || !model.completed) throw new Error("未完成工作不能提交");
  model.visible = model.work.memoizedProps.title;
  model.current = model.work;
  model.work = null;
  model.completed = false;
}
export function abandon(model: Model) {
  model.work = null;
  model.completed = false;
}
export default function App() {
  const model = useRef<Model>(createModel());
  const [tick, setTick] = useState(0);
  const [title, setTitle] = useState("任务 A · 编辑后");
  const m = model.current;
  const run = (fn: () => void) => {
    fn();
    setTick((n) => n + 1);
  };
  return (
    <main
      style={{
        fontFamily: "system-ui",
        padding: 24,
        maxWidth: 800,
        margin: "auto",
        lineHeight: 1.7,
      }}
    >
      <h2>教学模型：两份工作节点怎样轮换</h2>
      <p>
        从已挂载任务 F1 开始。F1/F2 是模型对象标识，不读取 React 内部
        Fiber。模型没有调度器、Hook 队列或真实宿主提交。
      </p>
      <label>
        下一版标题{" "}
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <p>
        <button onClick={() => run(() => prepare(m, title))}>准备工作</button>{" "}
        <button disabled={!m.work} onClick={() => run(() => complete(m))}>
          完成计算
        </button>{" "}
        <button disabled={!m.completed} onClick={() => run(() => commit(m))}>
          提交
        </button>{" "}
        <button disabled={!m.work} onClick={() => run(() => abandon(m))}>
          放弃本轮
        </button>{" "}
        <button
          onClick={() => {
            model.current = createModel();
            setTick((n) => n + 1);
          }}
        >
          重置
        </button>
      </p>
      <p role="status">
        模型可见标题：{m.visible}；current={m.current.id}；已创建节点数=
        {m.created}；操作数={tick}
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>观测</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["工作节点", m.work?.id ?? "无"],
            ["current.alternate", m.current.alternate?.id ?? "null"],
            ["工作已完成", String(m.completed)],
            [
              "child沿用引用",
              m.work ? String(m.work.child === m.current.child) : "—",
            ],
            [
              "queue沿用引用",
              m.work
                ? String(m.work.updateQueue === m.current.updateQueue)
                : "—",
            ],
            [
              "dependencies外壳相同",
              m.work
                ? String(m.work.dependencies === m.current.dependencies)
                : "—",
            ],
            ["工作flags", m.work ? String(m.work.flags) : "—"],
          ].map(([a, b]) => (
            <tr key={a}>
              <td style={{ borderBottom: "1px solid #ccc" }}>{a}</td>
              <td>{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        仅准备或完成不会改变模型可见标题。放弃后 current
        不变；下一次准备复用另一节点，并重置本轮临时标记。模型 flags=4
        为静态标记，1 为更新标记。
      </p>
    </main>
  );
}
