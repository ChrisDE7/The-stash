import {admin,cors,json} from '../_shared/access.ts';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='GET')return json({error:'Method not allowed'},405);
 const url=new URL(req.url),id=url.searchParams.get('id'),variant=url.searchParams.get('variant')||'display';
 if(!id||!/^[0-9a-f-]{36}$/.test(id)||!['original','display','thumb'].includes(variant))return json({error:'Not found'},404);
 const ref=await admin.from('published_media').select('entry_id').eq('media_id',id).limit(1);
 if(ref.error||!ref.data?.length)return json({error:'Not found'},404);
 const {data:asset}=await admin.from('media').select('*').eq('id',id).single();if(!asset)return json({error:'Not found'},404);
 const path=asset.variants[variant]||asset.variants.original;
 const storageHeaders:Record<string,string>={Authorization:`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`};
 const range=req.headers.get('Range');
 if(range){if(!/^bytes=\d+-\d*$/.test(range))return new Response(null,{status:416,headers:cors});storageHeaders.Range=range;}
 const upstream=await fetch(`${Deno.env.get('SUPABASE_URL')!}/storage/v1/object/authenticated/portfolio/${path}`,{headers:storageHeaders});
 if(!upstream.ok){await upstream.body?.cancel();return json({error:'Media unavailable'},upstream.status===416?416:503);}
 // Recheck before starting the stream. Every subsequent range request checks publication again.
 const check=await admin.from('published_media').select('entry_id').eq('media_id',id).limit(1);if(!check.data?.length){await upstream.body?.cancel();return json({error:'Not found'},404);}
 const headers:Record<string,string>={...cors,'Content-Type':path===asset.variants.original?asset.mime:'image/webp','Accept-Ranges':'bytes','Content-Disposition':'inline'};
 for(const name of ['Content-Range','Content-Length']){const value=upstream.headers.get(name);if(value)headers[name]=value;}
 return new Response(upstream.body,{status:upstream.status,headers});
});
