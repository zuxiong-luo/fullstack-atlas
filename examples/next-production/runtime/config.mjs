export function loadConfig(env=process.env){
 const token=env.DEMO_API_TOKEN,region=env.DEMO_REGION;
 if(typeof token!=='string'||token.length<16||token.length>128)throw new Error('CONFIG_DEMO_API_TOKEN');
 if(typeof region!=='string'||!/^[a-z0-9-]{1,32}$/.test(region))throw new Error('CONFIG_DEMO_REGION');
 return {token,region};
}
