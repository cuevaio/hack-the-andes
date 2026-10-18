import {readFileSync} from 'node:fs';
import {resolve4} from 'node:dns/promises';
const base='https://vps.cueva.io',hostname='vibe.hacktheandes.com',projectName='Typebattle';
const key=process.env.DOKPLOY_API_KEY,mode=process.env.DEPLOY_MODE||'inspect';
if(!key)throw Error('Saved Dokploy access is unavailable.');
async function api(endpoint,body,query){
 const url=new URL('/api/'+endpoint,base);for(const [k,v] of Object.entries(query||{}))url.searchParams.set(k,v);
 const form=body instanceof FormData;const r=await fetch(url,{method:body?'POST':'GET',headers:{'x-api-key':key,...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});
 if(!r.ok){let detail=await r.text();if(key)detail=detail.replaceAll(key,'[redacted]');if(process.env.TYPEBATTLE_ADMIN_KEY)detail=detail.replaceAll(process.env.TYPEBATTLE_ADMIN_KEY,'[redacted]');throw Error(endpoint+' returned '+r.status+': '+detail.slice(0,1500));}return r.json();
}
const ip=await api('settings.getIp');if(ip!=='85.239.246.19')throw Error('Unexpected deployment server IP.');
let projects=await api('project.all');let project=projects.find(p=>p.name===projectName);
console.log(JSON.stringify({server:base,ip,mode,projectExists:Boolean(project)}));
if(mode==='inspect'){
 if(project){for(const e of project.environments||[]){for(const a of e.applications||[]){console.log(JSON.stringify({applicationId:a.applicationId,name:a.name,status:a.applicationStatus}));const deployments=await api('deployment.all',null,{applicationId:a.applicationId});const latest=deployments[0];if(latest){console.log(JSON.stringify({deploymentId:latest.deploymentId,status:latest.status}));console.log(JSON.stringify(await api('deployment.readLogs',null,{deploymentId:latest.deploymentId,tail:'50'})));}console.log(JSON.stringify(await api('application.readLogs',null,{applicationId:a.applicationId,tail:'30'})));}}}
 process.exit(0);
}
if(!['deploy','https'].includes(mode))throw Error('Unknown operation.');
if(!project){await api('project.create',{name:projectName,description:'Standalone realtime typing battle for 100 players'});projects=await api('project.all');project=projects.find(p=>p.name===projectName);}
let environment=project.environments?.find(e=>e.name==='production');
if(!environment){await api('environment.create',{projectId:project.projectId,name:'production'});environment=(await api('environment.byProjectId',null,{projectId:project.projectId})).find(e=>e.name==='production');}
let app=environment.applications?.find(a=>a.name==='Typebattle');
if(!app)app=await api('application.create',{name:'Typebattle',appName:'typebattle',environmentId:environment.environmentId,sourceType:'drop'});
const applicationId=app.applicationId;
console.log(JSON.stringify({projectId:project.projectId,applicationId}));
const domains=await api('domain.byApplicationId',null,{applicationId});let domain=domains.find(d=>d.host===hostname);
let dnsReady=false;try{dnsReady=(await resolve4(hostname)).includes(ip);}catch{}
const route={host:hostname,port:3418,https:dnsReady,certificateType:dnsReady?'letsencrypt':'none',domainType:'application',stripPath:false};
if(!domain)domain=await api('domain.create',{...route,applicationId});else await api('domain.update',{...route,domainId:domain.domainId});
if(mode==='deploy'){
 if(!process.env.TYPEBATTLE_ADMIN_KEY)throw Error('Typebattle admin secret is unavailable.');
 await api('application.saveEnvironment',{applicationId,env:`ADMIN_KEY=${process.env.TYPEBATTLE_ADMIN_KEY}\nPORT=3418\nBIND_HOST=0.0.0.0\nPUBLIC_ORIGIN=https://${hostname}\nDATABASE_PATH=/app/data/battle.sqlite\nNODE_ENV=production\n`,buildArgs:null,buildSecrets:null,createEnvFile:false});
 await api('application.saveBuildType',{applicationId,buildType:'dockerfile',dockerfile:'Dockerfile',dockerContextPath:'.',dockerBuildStage:null,herokuVersion:null,railpackVersion:null});
 await api('application.update',{applicationId,replicas:1});
 const mounts=await api('mounts.listByServiceId',null,{serviceType:'application',serviceId:applicationId});
 if(!mounts.some(m=>m.mountPath==='/app/data'))await api('mounts.create',{type:'volume',volumeName:'typebattle-data',mountPath:'/app/data',serviceType:'application',serviceId:applicationId});
 const form=new FormData();form.set('applicationId',applicationId);form.set('zip',new Blob([readFileSync(new URL('./source.zip',import.meta.url))],{type:'application/zip'}),'source.zip');
 await api('application.dropDeployment',form);
}else await api('application.redeploy',{applicationId,title:'Enable Typebattle HTTPS'});
console.log(JSON.stringify({applicationId,host:hostname,dnsReady,operation:'deployment-requested'}));
let deployment;
for(let attempt=0;attempt<90;attempt++){
 await new Promise(r=>setTimeout(r,10000));const deployments=await api('deployment.all',null,{applicationId});deployment=deployments[0];
 console.log(JSON.stringify({deploymentId:deployment?.deploymentId,status:deployment?.status}));
 if(deployment?.status==='done')break;
 if(deployment?.status==='error'){console.log(JSON.stringify({deploymentId:deployment.deploymentId,logPath:deployment.logPath}));throw Error('Typebattle build failed.');}
}
if(deployment?.status!=='done')throw Error('Deployment did not finish within 15 minutes.');
console.log(JSON.stringify({applicationId,deploymentId:deployment.deploymentId,status:'done',url:'https://'+hostname}));
