import { createServer } from 'node:http';
import { GET as calendar } from './api/calendar.js';
import { POST as provision } from './api/provision.js';
import { GET as setup } from './api/setup.js';
const providers=['google','outlook','office365','yahoo','apple'];
createServer(async(req,res)=>{
  try {
    const u=new URL(req.url,'http://localhost:3000');
    let handler;
    if (providers.includes(u.pathname.slice(1))) {u.searchParams.set('p',u.pathname.slice(1));handler=calendar;}
    if (u.pathname==='/event.ics') {u.searchParams.set('p','ics');handler=calendar;}
    if (u.pathname==='/api/calendar') handler=calendar;
    if (u.pathname==='/api/provision' && req.method==='POST') handler=provision;
    if (u.pathname==='/api/setup' && req.method==='GET') handler=setup;
    if (!handler || !['GET','POST'].includes(req.method) || (handler===calendar && req.method!=='GET')) {res.writeHead(404);res.end('Not found');return;}
    let body=''; for await (const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>2048){res.writeHead(413);res.end();return;}}
    const r=await handler(new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}:{})}));
    res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
  } catch {res.writeHead(500);res.end('Server error');}
}).listen(3000,()=>console.log('RYM Calendar: http://localhost:3000'));
