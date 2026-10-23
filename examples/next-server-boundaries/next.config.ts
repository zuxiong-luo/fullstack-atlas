import type {NextConfig} from 'next';
const config:NextConfig={poweredByHeader:false,outputFileTracingRoot:process.cwd()};
// cacheComponents 保持关闭；显式使用 Data Cache 的 unstable_cache。
export default config;
