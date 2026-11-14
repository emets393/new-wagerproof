import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from '../node_modules/typescript/lib/typescript.js';
// Exercise the actual HTTP handler, with deterministic external tool/database boundaries.
let calls = [], failRecording = false;
globalThis.__achievementTest = {
  rpc: async (...args) => { calls.push(args); if (failRecording) throw Error('offline'); return {error:null}; },
};
let source = await readFile(new URL('../src/mcp-handler.ts', import.meta.url), 'utf8');
source = source.replace(/import \{[\s\S]*?\} from "@wagerproof\/tool-core";/, `
const buildTools = () => [{name:'research',execute:async()=>({answer:42})},{name:'fails',execute:async()=>{throw Error('tool failed')}}];
const indexByName = tools => new Map(tools.map(t=>[t.name,t]));
const getTodayInET = () => '2026-09-10';`)
.replace(/import \{ INSTRUCTIONS, serverInfo \} from "\.\/instructions";/, `const INSTRUCTIONS=''; const serverInfo=()=>({name:'test',version:'1'});`)
.replace(/import \{[\s\S]*?\} from "\.\/supabase";/, `
const createServiceMainClient=()=>({rpc:globalThis.__achievementTest.rpc});
const createCfbClient=()=>({}); const createCfbServiceClient=()=>({});
const createUserMainClient=()=>({}); const getUserAccessToken=async()=>({});`);
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {mcpApiHandler} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const env={ALLOWED_ORIGINS:'',MAIN_SERVICE_ROLE_KEY:'test-only'};
async function request(name, options={}) {
 const pending=[];
 const ctx={props:{grantId:'grant',userId:'verified-owner'},waitUntil:p=>pending.push(p)};
 const response=await mcpApiHandler.fetch(new Request('https://example.test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:{userId:'attacker',achievement_id:'number-one'}}})}),{...env,...options},ctx);
 await Promise.all(pending);
 return response.json();
}
assert.equal((await request('research')).result.isError,false);
assert.deepEqual(calls,[['record_achievement_service_activity',{p_user_id:'verified-owner',activity:'mcp_tool_success'}]]);
await request('fails'); await request('unknown'); await request('research',{MAIN_SERVICE_ROLE_KEY:undefined});
assert.equal(calls.length,1,'Failed/unknown tools and missing service credentials never record');
failRecording=true;
assert.equal((await request('research')).result.isError,false,'Achievement failure preserves successful tool response');
console.log('PASS MCP success attribution, failures, credential gate, and response isolation');
