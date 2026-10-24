import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function temporaryCertificates({expired=false}={}) {
  const directory=await mkdtemp(join(tmpdir(),'atlas-tls-lab-'));
  const openssl=process.env.OPENSSL_BIN || 'openssl';
  const run=args=>execFileSync(openssl,args,{cwd:directory,stdio:'pipe',timeout:10000});
  try {
    await writeFile(join(directory,'ca.cnf'),`[req]
prompt=no
distinguished_name=dn
x509_extensions=ca
[dn]
CN=Atlas Loopback Teaching CA
[ca]
basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
`);
    await writeFile(join(directory,'leaf.ext'),`basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,IP:127.0.0.1
`);
    for(const name of ['ca','server']) {
      run(['ecparam','-name','prime256v1','-genkey','-noout','-out',name+'.key']);
      await chmod(join(directory,name+'.key'),0o600);
    }
    run(['req','-new','-x509','-key','ca.key','-sha256','-days','1','-config','ca.cnf','-out','ca.pem']);
    run(['req','-new','-key','server.key','-subj','/CN=localhost','-out','server.csr']);
    run(['x509','-req','-in','server.csr','-CA','ca.pem','-CAkey','ca.key','-CAcreateserial',...(expired?['-not_before','20240101000000Z','-not_after','20240102000000Z']:['-days','1']),'-sha256','-extfile','leaf.ext','-out','server.pem']);
    return {
      key:await readFile(join(directory,'server.key')),
      cert:await readFile(join(directory,'server.pem')),
      ca:await readFile(join(directory,'ca.pem')),
      async dispose(){await rm(directory,{recursive:true,force:true});},
    };
  } catch(error) { await rm(directory,{recursive:true,force:true});throw error; }
}
