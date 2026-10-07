import { authorize, required, respond, failure } from '../lib/core.js';
import { ghl } from '../lib/ghl.js';
export async function GET(request) {
  try {
    authorize(request);
    const location=encodeURIComponent(required('GHL_LOCATION_ID'));
    const [fields,values]=await Promise.all([ghl('/locations/'+location+'/customFields?model=contact'),ghl('/locations/'+location+'/customValues')]);
    return respond(JSON.stringify({customFields:fields.customFields?.map(({id,name,fieldKey})=>({id,name,fieldKey})),customValues:values.customValues?.map(({id,name,fieldKey})=>({id,name,fieldKey}))},null,2),200,{'Content-Type':'application/json; charset=utf-8'});
  } catch(e) {return failure(e);}
}
