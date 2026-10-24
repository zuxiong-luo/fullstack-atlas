import Link from 'next/link';
export default function Home() {
  return <><h1>笔记入口</h1><Link href="/notes/n1" prefetch={false}>进入第一篇笔记</Link></>;
}
