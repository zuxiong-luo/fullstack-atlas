import Title from './Title';
import {runtimeConfig} from '@/lib/config';
export const dynamic='force-dynamic';
export default function Page(){const {region}=runtimeConfig();return <main><h1>独立生产部署</h1><p>运行时区域：{region}</p><Title/><p>公开构建变量固化在客户端包中；私有token仅在服务端读取。</p><a href="/api/report">查看请求追踪JSON</a></main>;}
