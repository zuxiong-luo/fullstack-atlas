import type { ReactNode } from 'react';
import Link from 'next/link';
import Counter from './Counter';
export default function NotesLayout({children}:{children:ReactNode}) {
  return <section><h2>共享笔记布局</h2><Counter /><nav>
    <Link href="/notes/n1" prefetch={false}>第一篇</Link>{' | '}
    <Link href="/notes/n2" prefetch={false}>第二篇</Link>{' | '}
    <a href="/notes/n2">整页打开第二篇</a>
  </nav><article>{children}</article></section>;
}
