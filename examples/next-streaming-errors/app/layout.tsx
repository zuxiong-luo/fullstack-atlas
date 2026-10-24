import type {ReactNode} from 'react';
import Controls from './Controls';
export default function RootLayout({children}:{children:ReactNode}){
 return <html lang="zh-CN"><body style={{fontFamily:'system-ui',maxWidth:850,margin:'auto',padding:20}}><header><h1>STREAM_SHELL · 报告工作台</h1><Controls/></header><main>{children}</main></body></html>;
}
