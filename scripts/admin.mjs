const action=process.argv[2], id=process.argv[3];
if (!['setup','provision'].includes(action) || (action==='provision' && !id)) {
  console.error('Use npm run setup or npm run provision -- CONTACT_ID');process.exit(1);
}
const base=process.env.PUBLIC_BASE_URL, secret=process.env.WEBHOOK_SECRET;
if(!base || !secret) {console.error('Set PUBLIC_BASE_URL and WEBHOOK_SECRET in .env.local');process.exit(1);}
const u=new URL(base);
if (u.protocol!=='https:' && !(u.protocol==='http:' && u.hostname==='localhost')) {
  console.error('PUBLIC_BASE_URL must use HTTPS (or localhost for local development).');process.exit(1);
}
const r=await fetch(new URL('/api/'+action,u),{
  method:action==='setup'?'GET':'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
  ...(action==='provision'?{body:JSON.stringify({contactId:id})}:{}),signal:AbortSignal.timeout(30000)
});
if(!r.ok) {console.error('Request failed (HTTP '+r.status+'). Check configuration and sanitized Vercel logs.');process.exit(1);}
console.log(await r.text());
