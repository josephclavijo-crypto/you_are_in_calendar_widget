import { AppError, required, contactId, zoomURL, readToken } from './core.js';
export async function ghl(path, options={}) {
  const response=await fetch('https://services.leadconnectorhq.com'+path,{
    ...options,headers:{Authorization:'Bearer '+required('GHL_API_TOKEN'),Version:process.env.GHL_API_VERSION || 'v3','Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new AppError(503,'Unable to load your registration. Please try again later.','ghl_'+response.status);
  return response.json();
}
export async function getContact(id) {
  contactId(id);
  const {contact}=await ghl('/contacts/'+encodeURIComponent(id));
  if (!contact || contact.id !== id || contact.locationId !== required('GHL_LOCATION_ID')) throw new AppError(403,'This calendar link is not available.');
  return contact;
}
export function field(contact, id) {
  const f=contact.customFields?.find(f=>f.id===id);
  return f?.value ?? f?.fieldValue;
}
export async function registrationURL() {
  if (process.env.ZOOM_REGISTRATION_URL?.trim()) return zoomURL(process.env.ZOOM_REGISTRATION_URL.trim());
  const {customValues}=await ghl('/locations/'+encodeURIComponent(required('GHL_LOCATION_ID'))+'/customValues');
  const normalize=v=>String(v||'').replace(/[{}\s]/g,'');
  const value=customValues?.find(v=>process.env.GHL_REGISTRATION_VALUE_ID?.trim()?v.id===process.env.GHL_REGISTRATION_VALUE_ID.trim():normalize(v.fieldKey)===normalize(process.env.GHL_REGISTRATION_VALUE_KEY || 'custom_values._rym_workflows__zoom_link_1st2nd_day'));
  return zoomURL(value?.value);
}
export async function eventForToken(token) {
  const id=readToken(token), c=await getContact(id);
  // Matching the saved token supports revocation and prevents use of uncommitted tokens.
  if (field(c,required('GHL_CALENDAR_TOKEN_FIELD_ID')) !== token) throw new AppError(403,'This calendar link has been replaced. Please use your latest email.');
  const join=zoomURL(field(c,required('GHL_JOIN_FIELD_ID')));
  return {id,join,registration:await registrationURL()};
}
