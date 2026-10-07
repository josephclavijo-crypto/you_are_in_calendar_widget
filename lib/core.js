import { createCipheriv, createDecipheriv, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export class AppError extends Error {
  constructor(status, message, code = 'request_error') { super(message); this.status = status; this.code = code; }
}
export const TITLE = 'Replace Your Mortgage LIVE: 2-Night Event';
export const EVENT_ID = 'rym-live-2026-10-19';
export const TZ = 'America/Chicago';
export const NIGHTS = [
  { start: '2026-10-19T23:00:00Z', end: '2026-10-20T01:00:00Z' },
  { start: '2026-10-20T23:00:00Z', end: '2026-10-21T01:00:00Z' }
];
export function required(name) {
  const v = process.env[name]?.trim();
  if (!v) throw new AppError(503, 'Calendar service is not configured. Please contact RYM.', 'configuration');
  return v;
}
export function contactId(v) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(v)) throw new AppError(400, 'Invalid contact ID.');
  return v;
}
function key() {
  const k = required('TOKEN_KEY');
  if (!/^[a-fA-F0-9]{64}$/.test(k)) throw new AppError(503, 'Calendar service is not configured.', 'configuration');
  return Buffer.from(k, 'hex');
}
export function issueToken(id) {
  contactId(id);
  const exp = Math.floor(Date.parse(process.env.TOKEN_EXPIRES_AT || '2026-11-01T00:00:00Z') / 1000);
  if (!Number.isFinite(exp) || exp <= Date.now()/1000) throw new AppError(503, 'This event is no longer available.', 'expired_event');
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(EVENT_ID));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify([id, exp])), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}
export function readToken(token) {
  const k = key();
  try {
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{40,300}$/.test(token)) throw Error();
    const buf = Buffer.from(token, 'base64url');
    if (buf.toString('base64url') !== token) throw Error();
    const d = createDecipheriv('aes-256-gcm', k, buf.subarray(0,12));
    d.setAAD(Buffer.from(EVENT_ID)); d.setAuthTag(buf.subarray(12,28));
    const [id, exp] = JSON.parse(Buffer.concat([d.update(buf.subarray(28)),d.final()]).toString());
    contactId(id);
    if (!Number.isInteger(exp) || exp <= Date.now()/1000) throw Error();
    return id;
  } catch { throw new AppError(403, 'This calendar link is invalid or expired. Please request a new email from RYM.'); }
}
export function authorize(request) {
  const secret = required('WEBHOOK_SECRET');
  if (secret.length < 32) throw new AppError(503, 'Calendar service is not configured.', 'configuration');
  const supplied = request.headers.get('authorization') || '';
  const a = createHash('sha256').update(supplied).digest();
  const b = createHash('sha256').update('Bearer '+secret).digest();
  if (!timingSafeEqual(a,b)) throw new AppError(401, 'Unauthorized.');
}
export function zoomURL(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\r\n\u0000-\u0020]/.test(value)) throw new AppError(409, 'Your Zoom link is not ready. Please contact RYM.');
  let u;
  try { u = new URL(value); } catch { throw new AppError(409, 'Your Zoom link is not ready. Please contact RYM.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || !(u.hostname === 'zoom.us' || u.hostname.endsWith('.zoom.us') || u.hostname === 'zoom.com' || u.hostname.endsWith('.zoom.com'))) {
    throw new AppError(409, 'Your Zoom link is not ready. Please contact RYM.');
  }
  return value;
}
export function description(join, registration) {
  return `Important: Your personal Zoom link to join Replace Your Mortgage LIVE is below:

Your Join Link HERE:
${join}

Event Date & Time:
October 19th - 20th, 2026 | 6-8 pm CT

Please save this event. You'll use your personal Zoom link to access the live event.

You should also receive an email from Zoom with all your registration details.

If your personal Zoom link does not work or you did not receive one:

Re-register HERE:
${registration}

Ready to take control of your financial future and pay off your home faster?

Join Replace Your Mortgage LIVE to discover the strategy that's helped 10,000+ families position themselves to save $100,000s in mortgage interest and pay off their homes in as little as 5-7 years—without changing their budget or lifestyle.

Here's what you'll learn:

✅ The Mortgage Trap – Why mortgages cost you more than you realize and how to break free.

✅ The Payoff Plan – See how quickly you can eliminate your mortgage and build wealth with our proven strategy.

✅ BONUS: Live Q&A with Michael & Cody to get your questions answered in real-time.

Don't miss this life-changing event that could save you years—and $100,000s—on your mortgage!`;
}
export const compactDate = value => value.replace(/[-:]/g, '');
export function descriptionHTML(join, registration) {
  let html=htmlEscape(description(join,registration));
  for (const label of [
    'Important:', 'Your Join Link HERE:', 'Event Date & Time:',
    'October 19th - 20th, 2026 | 6-8 pm CT', 'Re-register HERE:',
    "Here's what you'll learn:", 'The Mortgage Trap', 'The Payoff Plan',
    'BONUS: Live Q&A with Michael & Cody'
  ]) {
    const text=htmlEscape(label);
    html=html.replace(text,'<b>'+text+'</b>');
  }
  return html.replace(/\n/g,'<br>');
}
export const escapeICS = s => String(s).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
export function foldLine(line) {
  let result='', current='', bytes=0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    if (bytes+size > 75) { result += current+'\r\n'; current=' '; bytes=1; }
    current+=ch; bytes+=size;
  }
  return result+current;
}
export function calendarICS(id, join, registration) {
  const uid = createHash('sha256').update(EVENT_ID+':'+id).digest('hex')+'@rym.calendar';
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//RYM//RYM Live Calendar//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH',
    'X-WR-CALNAME:'+escapeICS(TITLE),'X-WR-TIMEZONE:'+TZ,'BEGIN:VEVENT','UID:'+uid,'SEQUENCE:0',
    'DTSTAMP:'+compactDate(new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')),
    'DTSTART:20261019T230000Z','DTEND:20261020T010000Z','RRULE:FREQ=DAILY;COUNT=2',
    'SUMMARY:'+escapeICS(TITLE),'DESCRIPTION:'+escapeICS(description(join, registration)),
    'LOCATION:'+escapeICS(join),'URL:'+join,'STATUS:CONFIRMED','TRANSP:OPAQUE',
    'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY','DESCRIPTION:RYM Live starts in 30 minutes','END:VALARM','END:VEVENT','END:VCALENDAR'];
  return lines.map(foldLine).join('\r\n')+'\r\n';
}
export function providerURL(provider, join, registration, night = 0, recurring = false) {
  const n = NIGHTS[night];
  if (!n) throw new AppError(400, 'Invalid night.');
  let base, params;
  if (provider === 'google') {
    base='https://calendar.google.com/calendar/render';
    params={action:'TEMPLATE',text:TITLE,dates:compactDate(n.start)+'/'+compactDate(n.end),ctz:TZ,location:join,details:descriptionHTML(join,registration)};
    if (recurring) params.recur='RRULE:FREQ=DAILY;COUNT=2';
  } else if (provider === 'outlook' || provider === 'office365') {
    base=provider==='outlook'?'https://outlook.live.com/calendar/0/deeplink/compose':'https://outlook.office.com/calendar/0/deeplink/compose';
    params={path:'/calendar/action/compose',rru:'addevent',subject:TITLE,startdt:n.start,enddt:n.end,location:join,body:description(join,registration)};
  } else if (provider === 'yahoo') {
    base='https://calendar.yahoo.com/';
    params={v:'60',title:TITLE,st:compactDate(n.start),et:compactDate(n.end),dur:'0200',in_loc:join,desc:description(join,registration)};
  } else throw new AppError(404, 'Calendar not found.');
  return base+'?'+new URLSearchParams(params).toString();
}
export const htmlEscape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function page(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(title)}</title><style>body{font:16px/1.6 Arial,sans-serif;color:#17233b;background:#f6f8fc;margin:0;padding:32px 16px}main{max-width:620px;margin:20px auto;background:white;padding:32px;border-radius:16px}h1{font-size:25px;line-height:1.3}a.button{display:block;padding:12px 18px;background:#1465db;color:white;text-decoration:none;border-radius:8px;margin:12px 0}small{color:#526078}details{margin-top:24px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 Arial}footer{margin-top:30px;color:#777}</style></head><body><main>${content}<footer>Powered by <b style="color:#1686e8">RYM</b></footer></main></body></html>`;
}
export function landing(provider, token, join, registration, native = true) {
  const names={google:'Google Calendar',outlook:'Outlook',office365:'Office 365',yahoo:'Yahoo Calendar'};
  const q = '?t='+encodeURIComponent(token);
  const instructions={google:'On a computer: Google Calendar → Settings → Import & export → Import the downloaded file.',outlook:'Outlook Calendar → Add calendar → Upload from file → select the downloaded file and your calendar → Import.',office365:'Office 365 Calendar → Add calendar → Upload from file → select the downloaded file and your calendar → Import.',yahoo:'Yahoo Calendar on a computer → calendar actions/menu → Import → select the downloaded file.'};
  const actions = !native ? '<p>Your personal Zoom link is too long for a browser calendar link. Use the file above to preserve all event details.</p>' : `<p>Choose one method to avoid duplicate events.</p>${provider==='google'?`<a class="button" href="/google${q}&amp;action=series" target="_blank" rel="noreferrer">Open both nights in Google Calendar</a><small>Before saving, check that the event says “Daily, 2 times”. If it does not, use the .ics file above.</small>`:''}<h3>Or save each night separately</h3><p>Open and save both buttons below. These create two individual events.</p><a class="button" href="/${provider}${q}&amp;action=night&amp;n=1" target="_blank" rel="noreferrer">Save October 19 · 6–8 PM Central</a><a class="button" href="/${provider}${q}&amp;action=night&amp;n=2" target="_blank" rel="noreferrer">Save October 20 · 6–8 PM Central</a>`;
  return page(TITLE, `<h1>${TITLE}</h1><p>October 19–20, 2026 · 6–8 PM Central<br>Two nights, two hours each.</p><h2>Add to ${names[provider]}</h2><a class="button" href="/event.ics${q}">Download both nights (.ics recurring event)</a><p>${instructions[provider]}</p>${actions}<details><summary>Event details and your personal Zoom link</summary><pre>${htmlEscape(description(join,registration))}</pre></details>`);
}
export function respond(body, status=200, headers={}) {
  return new Response(body,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store, max-age=0','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",...headers}});
}
export function failure(error) {
  const expected = error instanceof AppError;
  if (!expected || error.status >= 500) console.error('rym_calendar_error', {code:expected?error.code:'unexpected'});
  return respond(page('RYM Calendar', '<h1>RYM Calendar</h1><p>'+htmlEscape(expected?error.message:'Calendar service is temporarily unavailable. Please try again later.')+'</p>'),expected?error.status:503);
}
