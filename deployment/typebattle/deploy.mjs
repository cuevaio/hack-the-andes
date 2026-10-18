import {writeFileSync} from 'node:fs';
const base='https://vps.cueva.io';
const key=process.env.DOKPLOY_API_KEY;
if(!key)throw Error('Saved Dokploy access is unavailable.');
async function api(endpoint,body,query){const url=new URL('/api/'+endpoint,base);for(const [k,v] of Object.entries(query||{}))url.searchParams.set(k,v);const r=await fetch(url,{method:body?'POST':'GET',headers:{'x-api-key':key,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(endpoint+' returned '+r.status);return r.json();}
const version=await api('settings.getDokployVersion');const ip=await api('settings.getIp');const projects=await api('project.all');
console.log(JSON.stringify({version,ip,projects:projects.map(p=>({id:p.projectId,name:p.name,environments:p.environments?.map(e=>({id:e.environmentId,name:e.name,applications:e.applications?.map(a=>({id:a.applicationId,name:a.name,appName:a.appName,sourceType:a.sourceType,buildType:a.buildType,status:a.applicationStatus}))}))}))},null,2));
const schema=await api('openapi.json');const paths=schema.paths||{};for(const [path,methods] of Object.entries(paths)){if(/(dropDeployment|saveBuildType|mount.create|mount.all|domain.create|application.create)/.test(path)){console.log(JSON.stringify({path,methods},null,2));}}
