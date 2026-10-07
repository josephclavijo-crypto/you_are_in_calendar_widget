import { AppError, calendarICS, providerURL, landing, respond, failure } from '../lib/core.js';
import { eventForToken } from '../lib/ghl.js';
export async function GET(request) {
  try {
    const u=new URL(request.url);
    // Vercel rewrites supply p. Local development supplies the same query.
    const provider=u.searchParams.get('p');
    if (!['google','outlook','office365','yahoo','apple','ics'].includes(provider)) throw new AppError(404,'Calendar not found.');
    const token=u.searchParams.get('t');
    const {id,join,registration}=await eventForToken(token);
    if (provider==='apple' || provider==='ics') return respond(calendarICS(id,join,registration),200,{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="rym-live-october-19-20-2026.ics"'});
    // Conservative application limit: protect Location headers and provider/browser URL handling.
    if (Buffer.byteLength(providerURL(provider,join,registration,0,provider==='google')) > 6000) return respond(landing(provider,token,join,registration,false));
    const action=u.searchParams.get('action');
    if (provider==='google' && (!action || action==='series')) return respond(null,302,{Location:providerURL(provider,join,registration,0,true)});
    if (action==='night') {
      const n=u.searchParams.get('n');
      if (!['1','2'].includes(n)) throw new AppError(400,'Invalid night.');
      return respond(null,302,{Location:providerURL(provider,join,registration,Number(n)-1)});
    }
    if (action) throw new AppError(400,'Invalid action.');
    return respond(landing(provider,token,join,registration));
  } catch(e) { return failure(e); }
}
