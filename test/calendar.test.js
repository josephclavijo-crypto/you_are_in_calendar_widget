import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { issueToken, readToken, calendarICS, description, descriptionHTML, providerURL, zoomURL, NIGHTS, foldLine } from '../lib/core.js';
import { GET } from '../api/calendar.js';
import { POST } from '../api/provision.js';
import { GET as setup } from '../api/setup.js';

const join='https://us06web.zoom.us/w/123456789?tk=unique%2Bpersonal&pwd=a%26b';
const registration='https://us06web.zoom.us/webinar/register/WN_test?source=email&campaign=RYM';
const cid='contactABC123';
let stored, calls, fail, originalFetch;
beforeEach(()=>{
  Object.assign(process.env,{TOKEN_KEY:'a'.repeat(64),WEBHOOK_SECRET:'b'.repeat(40),GHL_API_TOKEN:'test-only',GHL_API_VERSION:'v3',GHL_LOCATION_ID:'loc',GHL_JOIN_FIELD_ID:'join',GHL_CALENDAR_TOKEN_FIELD_ID:'token',GHL_REGISTRATION_VALUE_KEY:'custom_values._rym_workflows__zoom_link_1st2nd_day',TOKEN_EXPIRES_AT:'2099-11-01T00:00:00Z'});
  delete process.env.ZOOM_REGISTRATION_URL; delete process.env.GHL_REGISTRATION_VALUE_ID;
  stored=undefined; calls=[]; fail=false; originalFetch=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{
    calls.push({url,opts});
    assert.equal(opts.headers.Authorization,'Bearer test-only');
    assert.equal(opts.headers.Version,'v3');
    if (fail) return new Response('{}',{status:429});
    if (url.endsWith('/contacts/'+cid)) {
      if (opts.method==='PUT') {const b=JSON.parse(opts.body);assert.deepEqual(Object.keys(b),['customFields']);assert.equal(b.customFields[0].id,'token');stored=b.customFields[0].fieldValue;}
      return Response.json({succeeded:true,contact:{id:cid,locationId:'loc',customFields:[{id:'join',value:join},{id:'token',value:stored}]}});
    }
    if(url.includes('/customFields')) return Response.json({customFields:[{id:'join',name:'Join',fieldKey:'contact.rym_live__join_url'}]});
    if(url.endsWith('/customValues')) return Response.json({customValues:[{id:'reg',fieldKey:'{{ custom_values._rym_workflows__zoom_link_1st2nd_day }}',value:registration}]});
    throw Error('Unexpected GHL request');
  };
});
afterEach(()=>{globalThis.fetch=originalFetch;});
const req=(p,extra='')=>new Request('https://calendar.example.com/api/calendar?p='+p+'&t='+stored+extra);
test('encrypted tokens authenticate and reject tampering, raw contact IDs, expiry and key rotation',()=>{
  const token=issueToken(cid);assert.equal(readToken(token),cid);assert.ok(!token.includes(cid));
  assert.throws(()=>readToken('contactABC123'));
  assert.throws(()=>readToken((token[0]==='A'?'B':'A')+token.slice(1)));
  const now=Date.now;Date.now=()=>Date.parse('2100-01-01');try {assert.throws(()=>readToken(token));}finally{Date.now=now;}
  process.env.TOKEN_KEY='c'.repeat(64);assert.throws(()=>readToken(token));
});
test('ICS contains exactly one recurring event, correct two-hour first night and intact full description',()=>{
  const ics=calendarICS(cid,join,registration), unfolded=ics.replace(/\r\n /g,'');
  assert.equal((unfolded.match(/BEGIN:VEVENT/g)||[]).length,1);
  assert.match(unfolded,/DTSTART:20261019T230000Z\r\nDTEND:20261020T010000Z\r\nRRULE:FREQ=DAILY;COUNT=2/);
  assert.ok(unfolded.includes('LOCATION:'+join));assert.ok(unfolded.includes(registration));
  assert.ok(unfolded.includes('BONUS: Live Q&A with Michael & Cody'));assert.ok(unfolded.includes("Don't miss this life-changing event"));
  assert.ok(ics.split('\r\n').every(l=>Buffer.byteLength(l)<=75));assert.ok(ics.endsWith('\r\n'));
  assert.ok(!ics.includes('\uFFFD')); assert.equal(foldLine('✅'.repeat(50)).replace(/\r\n /g,''),'✅'.repeat(50));
  assert.equal(new Date(NIGHTS[0].end)-new Date(NIGHTS[0].start),7200000);
  assert.equal(new Date(NIGHTS[1].start)-new Date(NIGHTS[0].start),86400000);
  const zone=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric',hour12:false});
  assert.equal(zone.format(new Date(NIGHTS[0].start)),'18');assert.equal(zone.format(new Date(NIGHTS[1].end)),'20');
});
test('provider parameters round-trip Zoom query strings, Unicode and full description',()=>{
  for(const p of ['google','outlook','office365','yahoo']) {
    const u=new URL(providerURL(p,join,registration,1));
    assert.equal(u.searchParams.get(p==='yahoo'?'in_loc':'location'),join);
    assert.equal(u.searchParams.get(p==='google'?'details':p==='yahoo'?'desc':'body'),p==='google'?descriptionHTML(join,registration):description(join,registration));
    assert.ok(u.search.includes('20261020') || u.search.includes('2026-10-20'));
  }
  assert.equal(new URL(providerURL('google',join,registration,0,true)).searchParams.get('recur'),'RRULE:FREQ=DAILY;COUNT=2');
});
test('Zoom validation rejects injected lines, wrong hosts and unsafe schemes',()=>{
  for (const s of ['javascript:alert(1)','https://zoom.us.evil.test/w/1','https://evilzoom.us/w/1','https://user:pass@zoom.us/w/1',join+'\r\nBEGIN:VEVENT','https://zoom.us:443/w/1\n']) assert.throws(()=>zoomURL(s));
  assert.equal(zoomURL(join),join);
});
test('provision is authenticated, saves only token, verifies write and reuses token on retries',async()=>{
  const unauth=await POST(new Request('https://test/api/provision',{method:'POST',body:JSON.stringify({contactId:cid})}));
  assert.equal(unauth.status,401);assert.equal(calls.length,0);
  const provision=()=>POST(new Request('https://test/api/provision',{method:'POST',headers:{Authorization:'Bearer '+process.env.WEBHOOK_SECRET},body:JSON.stringify({contactId:cid})}));
  assert.equal((await provision()).status,200);const first=stored;assert.equal(readToken(stored),cid);
  assert.equal((await provision()).status,200);assert.equal(stored,first);assert.equal(calls.filter(c=>c.opts.method==='PUT').length,1);
});
test('all five routes render or download; native redirects preserve data; GET never writes',async()=>{
  stored=issueToken(cid);
  for(const p of ['google','office365','outlook','yahoo','apple','ics']) {
    const r=await GET(req(p));assert.equal(r.status,p==='google'?302:200);assert.match(r.headers.get('Cache-Control'),/no-store/);
    assert.equal(r.headers.get('Referrer-Policy'),'no-referrer');
    if(p==='google') {
      const u=new URL(r.headers.get('Location'));
      assert.equal(u.origin,'https://calendar.google.com');
      assert.equal(u.searchParams.get('recur'),'RRULE:FREQ=DAILY;COUNT=2');
      assert.equal(u.searchParams.get('details'),descriptionHTML(join,registration));
      assert.equal(u.searchParams.get('location'),join);
      assert.equal(u.searchParams.get('dates'),'20261019T230000Z/20261020T010000Z');
    } else {
      const text=await r.text();assert.ok(text.includes(p==='apple'||p==='ics'?'BEGIN:VCALENDAR':'Download both nights'));
    }
  }
  for(const p of ['google','office365','outlook','yahoo']) {
    const r=await GET(req(p,'&action=night&n=2'));assert.equal(r.status,302);
    const u=new URL(r.headers.get('Location'));assert.equal(u.searchParams.get(p==='yahoo'?'in_loc':'location'),join);
  }
  assert.equal((await GET(req('google','&action=series'))).status,302);
  assert.equal((await GET(req('yahoo','&action=night&n=3'))).status,400);
  assert.ok(calls.every(c=>!c.opts.method));
});
test('bad token and revoked token fail without leaking Zoom; upstream errors are recoverable',async()=>{
  stored=issueToken(cid);
  let r=await GET(new Request('https://test/api/calendar?p=google&t=bad'));assert.equal(r.status,403);assert.equal(calls.length,0);
  const old=stored;stored=issueToken(cid);r=await GET(new Request('https://test/api/calendar?p=apple&t='+old));assert.equal(r.status,403);assert.ok(!(await r.text()).includes(join));
  fail=true;r=await GET(req('google'));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('test-only'));
});
test('setup requires authorization and returns IDs without personal URLs',async()=>{
  assert.equal((await setup(new Request('https://test/api/setup'))).status,401);
  const r=await setup(new Request('https://test/api/setup',{headers:{Authorization:'Bearer '+process.env.WEBHOOK_SECRET}}));
  assert.equal(r.status,200);const body=await r.text();assert.ok(body.includes('contact.rym_live__join_url'));assert.ok(!body.includes(registration));
});
test('oversized native links use ICS fallback without a long Location header',async()=>{
  stored=issueToken(cid);
  const stub=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{
    const r=await stub(url,opts);
    if(url.endsWith('/contacts/'+cid)) {const data=await r.json();data.contact.customFields[0].value='https://zoom.us/w/123?tk='+'a'.repeat(3000);return Response.json(data);}
    return r;
  };
  const r=await GET(req('google','&action=series'));
  assert.equal(r.status,200);assert.equal(r.headers.get('Location'),null);
  const body=await r.text();assert.ok(body.includes('too long'));assert.ok(body.includes('Download both nights'));assert.ok(!body.includes('action=night'));
  assert.equal((await GET(req('apple'))).status,200);
});
test('a contact in another subaccount is rejected before reading registration',async()=>{
  stored=issueToken(cid);
  const stub=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{const r=await stub(url,opts);const data=await r.json();if(data.contact)data.contact.locationId='other-location';return Response.json(data);};
  const r=await GET(req('apple'));assert.equal(r.status,403);assert.ok(!calls.some(c=>c.url.endsWith('/customValues')));
});
test('missing Join URL prevents provision from writing a token',async()=>{
  const stub=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{const r=await stub(url,opts);const data=await r.json();if(data.contact)data.contact.customFields[0].value='';return Response.json(data);};
  const r=await POST(new Request('https://test/api/provision',{method:'POST',headers:{Authorization:'Bearer '+process.env.WEBHOOK_SECRET},body:JSON.stringify({contactId:cid})}));
  assert.equal(r.status,409);assert.equal(stored,undefined);assert.ok(!calls.some(c=>c.opts.method==='PUT'));
});
test('failed token persistence is detected before provision returns success',async()=>{
  const stub=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{const r=await stub(url,opts);if(opts.method==='PUT')stored=undefined;return r;};
  const r=await POST(new Request('https://test/api/provision',{method:'POST',headers:{Authorization:'Bearer '+process.env.WEBHOOK_SECRET},body:JSON.stringify({contactId:cid})}));
  assert.equal(r.status,503);
});
