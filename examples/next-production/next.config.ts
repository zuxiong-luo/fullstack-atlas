import type {NextConfig} from 'next';
const config:NextConfig={cacheComponents:false,output:'standalone',poweredByHeader:false,outputFileTracingRoot:process.cwd(),outputFileTracingIncludes:{'/api/report':['./assets/build-info.json']},experimental:{cpus:1}};
export default config;
