import type {NextConfig} from 'next';
const config:NextConfig={cacheComponents:false,poweredByHeader:false,outputFileTracingRoot:process.cwd(),experimental:{cpus:1}};
export default config;
