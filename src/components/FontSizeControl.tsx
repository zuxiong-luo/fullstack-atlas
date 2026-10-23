import {useEffect, useState} from 'react';

const choices = [{value:'small', label:'小'}, {value:'medium', label:'中'}, {value:'large', label:'大'}] as const;
type FontSize = typeof choices[number]['value'];
const storageKey = 'atlas:font-size';
function readPreference(): FontSize {
  try {
    const value = localStorage.getItem(storageKey);
    return choices.some(choice => choice.value === value) ? value as FontSize : 'medium';
  } catch { return 'medium'; }
}

export default function FontSizeControl() {
  const [size, setSize] = useState<FontSize>(readPreference);
  useEffect(() => {
    document.documentElement.dataset.fontSize = size;
    try { localStorage.setItem(storageKey, size); } catch { /* 当前页面仍可调整字号。 */ }
  }, [size]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setSize(readPreference());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return <div className="font-size-control" role="group" aria-label="全站字号">
    {choices.map(choice => <button key={choice.value} type="button" aria-label={`字号：${choice.label}`} aria-pressed={size === choice.value} title={`全站字号：${choice.label}`} onClick={() => setSize(choice.value)}>{choice.label}</button>)}
  </div>;
}
