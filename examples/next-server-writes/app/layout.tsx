import type { ReactNode } from 'react';
export default function RootLayout({children}:{children:ReactNode}) {
  return <html lang="zh-CN"><body><header>知识笔记 · next-server-writes</header><main>{children}</main></body></html>;
}
