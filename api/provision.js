import { AppError, authorize, contactId, issueToken, readToken, required, zoomURL, respond, failure } from '../lib/core.js';
import { getContact, field, ghl, registrationURL } from '../lib/ghl.js';
export async function POST(request) {
  try {
    authorize(request);
    const raw=await request.text();
    if (Buffer.byteLength(raw)>2048) throw new AppError(413,'Request too large.');
    let data; try {data=JSON.parse(raw);} catch {throw new AppError(400,'Invalid JSON.');}
    const id=contactId(data?.contactId), c=await getContact(id);
    zoomURL(field(c,required('GHL_JOIN_FIELD_ID')));
    await registrationURL();
    const fieldId=required('GHL_CALENDAR_TOKEN_FIELD_ID');
    const existing=field(c,fieldId);
    let token;
    // Workflow retries reuse a valid token so already sent emails remain usable.
    try {if (readToken(existing)===id) token=existing;} catch(e) {if(e.status!==403) throw e;}
    if (!token) {
      token=issueToken(id);
      const result=await ghl('/contacts/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify({customFields:[{id:fieldId,fieldValue:token}]})});
      if (result.succeeded===false) throw new AppError(503,'Could not save calendar link.','ghl_update_failed');
      const saved=await getContact(id);
      if (field(saved,fieldId)!==token) throw new AppError(503,'Calendar link was not saved. Retry before sending the email.','ghl_verify_failed');
    }
    return respond(JSON.stringify({ok:true}),200,{'Content-Type':'application/json; charset=utf-8'});
  } catch(e) {return failure(e);}
}
