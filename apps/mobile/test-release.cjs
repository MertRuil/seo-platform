const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const records = new Map();
const Storage = {getItem:async k=>records.get(k)||null,setItem:async(k,v)=>records.set(k,v),removeItem:async k=>records.delete(k)};
function load(file,requireMock) {
  const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',js)(requireMock,module,module.exports);
  return module.exports;
}
const api=load('src/services/api.ts',name=>name==='./storage'?{Storage}:require(name));
const originalFetch=global.fetch;
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}
async function main(){
  records.set('seo_auth_token','real-jwt');records.set('seo_auth_user',JSON.stringify({id:'real-user',email:'real@example.com'}));
  global.fetch=async()=>{throw new Error('offline');};
  await assert.rejects(api.fetchSites(),/Sunucuya/);
  await assert.rejects(api.executeSelfHeal('site-real',{target_url:'https://release.example'}));
  assert.deepEqual(await api.fetchNotifications(),[]);
  assert.deepEqual(await api.fetchReports('site-real'),[]);
  let calls=[];
  global.fetch=async(url,options)=>{
    calls.push({url,options});
    assert.equal(options.headers.Authorization,'Bearer real-jwt');
    if(url.endsWith('/organizations'))return json([{id:'org-real'}]);
    if(url.endsWith('/sites'))return json([{id:'site-real',organization_id:'org-real',domain:'release.example',primary_url:'https://release.example',name:'Real Site',execution_mode:'REVIEW_ALL'}]);
    if(url.endsWith('/recommendations')||url.endsWith('/leads'))return json([]);
    return json({detail:'Connector not configured'},503);
  };
  const sites=await api.fetchSites();
  assert.equal(sites[0].id,'site-real');
  assert.equal(sites[0].has_completed_crawl,false);
  assert.deepEqual(await api.fetchRecommendations('site-real'),[]);
  assert.deepEqual(await api.fetchLeads('site-real'),[]);
  await assert.rejects(api.executeSelfHeal('site-real',{target_url:'https://release.example'}),/Connector not configured/);
  assert(calls.some(c=>c.url.includes('/organizations/org-real/sites/site-real/')));
  records.set('seo_auth_token','guest-token');
  global.fetch=async()=>{throw new Error('offline');};
  assert.equal((await api.fetchSites())[0].id,'site-1');
  // Exercise the provider's actual methods with a minimal hook host.
  records.clear();
  let states=[],index=0;
  const React={createContext:()=>({Provider:'Provider'}),useState:initial=>{let i=index++;if(!(i in states))states[i]=initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},useEffect:()=>{},createElement:(_type,props)=>props};
  const auth=load('src/context/AuthContext.tsx',name=>{
    if(name==='react')return React;
    if(name==='../services/storage')return {Storage};
    if(name==='../services/api')return api;
    if(name==='react-native')return {Platform:{OS:'ios'}};
    if(name==='expo-local-authentication')return {hasHardwareAsync:async()=>false,isEnrolledAsync:async()=>false};
    return require(name);
  });
  index=0;let context=auth.AuthProvider({children:null}).value;
  assert.equal((await context.login('real@example.com','WrongPassword1!')).success,false);
  assert.equal(await Storage.getItem('seo_auth_token'),null);
  assert.equal((await context.register('real@example.com','Password123!','Real User')).success,false);
  await assert.rejects(context.loginWithBiometrics(),/kullanılamıyor/);
  await assert.rejects(context.loginWithSocial('Google'),/yapılandırılmadı/);
  global.fetch=async(url,options)=>{
    if(url.endsWith('/auth/register')){assert.equal(JSON.parse(options.body).full_name,'Real User');return json({id:'real-user'},201);}
    if(url.endsWith('/auth/login'))return json({access_token:'verified-jwt'});
    if(url.endsWith('/auth/me'))return json({id:'real-user',email:'real@example.com',full_name:'Real User',is_active:true});
    throw new Error('Unexpected request');
  };
  assert.equal((await context.register('real@example.com','Password123!','Real User')).success,true);
  index=0;context=auth.AuthProvider({children:null}).value;
  assert.equal(context.user.id,'real-user');assert.equal(context.user.role,undefined);
  await context.logout();assert.equal(await Storage.getItem('seo_auth_token'),null);
  console.log('PASS: mobile offline auth, verified profiles, real site scopes, empty data, failed mutations and explicit demo isolation');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.fetch=originalFetch;});
