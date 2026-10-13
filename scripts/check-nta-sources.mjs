import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const store=resolve(root,'validation/nta-2026/source-watch');
const config=JSON.parse(await readFile(resolve(root,'scripts/nta-source-watch.json'),'utf8'));
const initialize=process.argv.includes('--initialize');
const baselinePath=resolve(store,'baseline.json');
async function optionalJson(path){try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
const baseline=await optionalJson(baselinePath),previous=await optionalJson(resolve(store,'last-check.json'));
if(initialize&&baseline)throw Error('Existing baseline retained; review revisions before changing it.');
if(!initialize&&!baseline)throw Error('Run --initialize once to record observed source hashes.');
const checkedAt=new Date().toISOString(),stamp=checkedAt.replace(/[:.]/g,'-');
await mkdir(store,{recursive:true});
await mkdir(resolve(store,'versions'),{recursive:true});
const documents=await Promise.all(config.map(async source=>{
 try{
  const url=new URL(source.url);
  if(url.protocol!=='https:'||url.hostname!=='www.nta.go.jp')throw Error('Only official NTA HTTPS sources are permitted.');
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const data=Buffer.from(await response.arrayBuffer());
  if(data.subarray(0,5).toString()!=='%PDF-')throw Error('Response is not a PDF.');
  const sha256=createHash('sha256').update(data).digest('hex');
  const old=baseline?.documents.find(d=>d.id===source.id),last=previous?.documents.find(d=>d.id===source.id);
  const changed=Boolean(old&&old.sha256!==sha256);
  const newSincePreviousCheck=Boolean(changed&&last?.sha256!==sha256);
  // One snapshot per content hash: unchanged weekly checks do not duplicate PDFs.
  const savedPath='validation/nta-2026/source-watch/versions/'+sha256+'.pdf';
  try{await writeFile(resolve(root,savedPath),data,{flag:'wx'});}catch(error){if(error.code!=='EEXIST')throw error;}
  const baselinePath=old?'validation/nta-2026/source-watch/versions/'+old.sha256+'.pdf':savedPath;
  return {...source,bytes:data.length,sha256,baselineSha256:old?.sha256||null,baselinePath,lastModified:response.headers.get('last-modified'),changed,newSincePreviousCheck,savedPath};
 }catch(error){return {...source,error:error.message};}
}));
const report={checkedAt,baselinePurpose:'Observed hashes; content review is a separate record.',documents};
if(initialize){
 if(documents.some(d=>d.error))throw Error('Initialization failed; no baseline was written: '+JSON.stringify(report));
 await writeFile(baselinePath,JSON.stringify(report,null,2)+'\n','utf8');
}
await writeFile(resolve(store,'last-check.json'),JSON.stringify(report,null,2)+'\n','utf8');
await writeFile(resolve(store,'check-'+stamp+'.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
if(documents.some(d=>d.error))process.exitCode=1;
