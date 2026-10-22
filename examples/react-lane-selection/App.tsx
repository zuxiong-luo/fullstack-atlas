import React, { useState } from 'react';

// 教学模型：只有 6 种 lane，位值沿用 React 18.3.1；不是 React 调度器。
export const LANES = [
  { name: 'Sync', bit: 1 }, { name: 'Continuous', bit: 4 },
  { name: 'Default', bit: 16 }, { name: 'Transition A', bit: 64 },
  { name: 'Transition B', bit: 128 }, { name: 'Idle', bit: 536870912 },
];
const TRANSITIONS = 64 | 128;
const NON_IDLE = 1 | 4 | 16 | TRANSITIONS;
export const label = (mask: number) => LANES.filter(l => mask & l.bit).map(l => l.name).join(' + ') || '∅';
export const highest = (mask: number) => mask & -mask;
function group(mask: number) { return (highest(mask) & TRANSITIONS) ? mask & TRANSITIONS : highest(mask); }
export type Snapshot = { pending: number; suspended: number; pinged: number; wip: number; expired: number; entangle: boolean; didTimeout: boolean };
export function select(snapshot: Snapshot) {
  const { pending, suspended, pinged, wip, expired, entangle, didTimeout } = snapshot;
  const steps: string[] = [];
  let selected = 0;
  let keptWip = false;
  if (!pending) steps.push('没有 pending，返回空集合。');
  else {
    const pool = (pending & NON_IDLE) || pending;
    steps.push((pending & NON_IDLE) ? '存在非 idle 工作，候选池暂不包含 Idle。' : '只有 Idle 工作。');
    const available = pool & ~suspended;
    const ready = available || (pool & pinged);
    steps.push(available ? `先取未挂起集合：${label(available)}` : `未挂起集合为空，尝试已 ping 集合：${label(ready)}`);
    selected = group(ready);
    steps.push(`按最高类别取组：${label(selected)}`);
    if (selected && wip && wip !== selected && !(wip & suspended)) {
      if (highest(selected) >= highest(wip) || (highest(selected) === 16 && !!(highest(wip) & TRANSITIONS))) {
        selected = wip; keptWip = true;
        steps.push('候选不足以打断现有工作，提前返回 WIP（后面的合批不执行）。');
      } else steps.push('候选优先级足以打断当前 WIP。');
    }
    if (selected && !keptWip) {
      if (selected & 4) { selected |= pending & 16; steps.push('稳定版默认分支：Continuous 带上 pending Default。'); }
      if (entangle && (selected & TRANSITIONS)) {
        selected |= pending & TRANSITIONS;
        steps.push('应用预先建立的 A ↔ B 纠缠关系。');
      }
    }
  }
  // 选择集合和选择渲染路径是两件事。Sync 在根调度处走同步队列。
  const blocking = !!(selected & (4 | 16));
  const hasExpired = !!(selected & expired);
  const route = !selected ? '没有可安排的工作' : (selected & 1) ? 'Sync 内部队列 → 同步 render' : (blocking || hasExpired || didTimeout) ? 'Scheduler 回调 → 同步 render' : 'Scheduler 回调 → 并发 render（允许让出）';
  const scheduler = !selected ? '无' : (selected & 1) ? 'Sync 内部队列（非普通 Scheduler 回调）' : (highest(selected) === 4) ? 'UserBlocking' : (selected & NON_IDLE) ? 'Normal' : 'Idle';
  return { selected, steps, route, scheduler, blocking, hasExpired };
}
export const PRESETS: { name: string; snapshot: Snapshot }[] = [
  { name: '初始：输入和列表', snapshot: { pending: 1 | 64, suspended: 0, pinged: 0, wip: 0, expired: 0, entangle: false, didTimeout: false } },
  { name: '全部挂起也不选Idle', snapshot: { pending: 64 | 536870912, suspended: 64, pinged: 0, wip: 0, expired: 0, entangle: false, didTimeout: false } },
  { name: 'Default不打断Transition', snapshot: { pending: 16 | 64, suspended: 0, pinged: 0, wip: 64, expired: 0, entangle: false, didTimeout: false } },
  { name: '连续事件带上Default', snapshot: { pending: 4 | 16 | 64, suspended: 0, pinged: 0, wip: 64, expired: 0, entangle: false, didTimeout: false } },
  { name: '纠缠扩展候选', snapshot: { pending: 64 | 128, suspended: 64, pinged: 0, wip: 0, expired: 0, entangle: true, didTimeout: false } },
  { name: 'WIP提前返回', snapshot: { pending: 64 | 128, suspended: 0, pinged: 0, wip: 64, expired: 0, entangle: true, didTimeout: false } },
  { name: '过期改变render路径', snapshot: { pending: 64, suspended: 0, pinged: 0, wip: 0, expired: 64, entangle: false, didTimeout: false } },
];
export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(PRESETS[0].snapshot);
  const result = select(snapshot);
  function toggle(key: 'pending' | 'suspended' | 'pinged' | 'wip' | 'expired', bit: number) {
    setSnapshot(prev => {
      const next = { ...prev, [key]: prev[key] ^ bit };
      // 保持集合的基本约束；这是状态编辑器，不模拟生命周期事件。
      next.suspended &= next.pending; next.pinged &= next.suspended;
      next.wip &= next.pending; next.expired &= next.pending;
      return next;
    });
  }
  return <main style={{ fontFamily: 'system-ui', maxWidth: 900, margin: 'auto', padding: 20, lineHeight: 1.7, color: '#193d34' }}>
    <h1>Lane 选择：先手算，再拨开关</h1>
    <p>React 18.3.1 的六类位集合教学模型。这里只编辑根状态快照，不调用 React 私有 API，不模拟耗时或 Fiber。</p>
    <label>案例 <select value={PRESETS.findIndex(p => JSON.stringify(p.snapshot) === JSON.stringify(snapshot))} onChange={e => { const p = PRESETS[Number(e.target.value)]; if (p) setSnapshot(p.snapshot); }}><option value={-1}>自定义</option>{PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}</select></label>
    <div style={{ overflowX: 'auto', margin: '18px 0' }}><table style={{ borderCollapse: 'collapse', minWidth: 620, width: '100%' }}><thead><tr><th>Lane / 位值</th>{['pending','suspended','pinged','wip','expired'].map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{LANES.map(l => <tr key={l.bit}><th style={{ textAlign: 'left' }}>{l.name} / {l.bit}</th>{(['pending','suspended','pinged','wip','expired'] as const).map(key => <td key={key} style={{ textAlign:'center', borderTop: '1px solid #bfd3cb' }}><input type="checkbox" aria-label={`${l.name} ${key}`} checked={!!(snapshot[key] & l.bit)} disabled={key !== 'pending' && !(snapshot.pending & l.bit) || key === 'pinged' && !(snapshot.suspended & l.bit)} onChange={() => toggle(key, l.bit)} /></td>)}</tr>)}</tbody></table></div>
    <label><input type="checkbox" checked={snapshot.entangle} onChange={e => setSnapshot({ ...snapshot, entangle: e.target.checked })} />A/B 纠缠（仅对 pending 的 A/B 建立关系）</label><br/>
    <label><input type="checkbox" checked={snapshot.didTimeout} onChange={e => setSnapshot({ ...snapshot, didTimeout: e.target.checked })} />Scheduler 回调 didTimeout</label>
    <section aria-live="polite" style={{ background: '#eaf3ee', padding: 16, marginTop: 20 }}><h2>选中 {label(result.selected)}</h2><p>mask = {result.selected} · 二进制 {result.selected.toString(2)}</p><ol>{result.steps.map((s,i) => <li key={i}>{s}</li>)}</ol><p>安排：{result.scheduler}</p><p>执行：{result.route}</p><p>blocking={String(result.blocking)}；选中集合含 expired={String(result.hasExpired)}</p></section>
    <p>未覆盖 Hydration、Retry、Offscreen、Lane 分配和清理；WIP 与纠缠只建模本文分支。允许并发 render 不代表一定发生中断，也不代表每 5ms 必定切片。</p>
  </main>;
}
