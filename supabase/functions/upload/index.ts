import {admin,cors,json,owner} from '../_shared/access.ts';
import {sniff,limits} from '../../../src/validation.js';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 let client;try{client=await owner(req);}catch{return json({error:'Owner access required'},403);}
 if(req.method==='DELETE'){
  const id=new URL(req.url).searchParams.get('id');if(!id)return json({error:'Missing file'},400);
  const {data,error}=await client.rpc('delete_media',{asset_id:id});if(error)return json({error:error.message},409);
  if(data){const removed=await admin.storage.from('portfolio').remove(Object.values(data));if(removed.error)return json({error:'Library entry removed; storage cleanup needs administrator attention.'},500);}
  return json({ok:true});
 }
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(Number(req.headers.get('Content-Length')||0)>70*1024*1024)return json({error:'Upload is too large. Use a video link for larger files.'},413);
 const stored:string[]=[];
 try{
  const form=await req.formData(),file=form.get('file');if(!(file instanceof File))throw new Error('Choose a file');
  const mime=sniff(new Uint8Array(await file.slice(0,256).arrayBuffer()));
  if(!mime||file.type!==mime)throw new Error('Supported files: JPEG, PNG, WebP, MP4 and WebM. The file contents must match its format.');
  if(file.size>(mime.startsWith('image')?limits.image:limits.video))throw new Error('Images: 12 MB maximum. Videos: 40 MB maximum. Use a YouTube or Vimeo link for larger videos.');
  const id=crypto.randomUUID(),variants:Record<string,string>={};
  for(const variant of ['original','display','thumb']){
   const part=variant==='original'?file:form.get(variant);if(!(part instanceof File))continue;
   const type=sniff(new Uint8Array(await part.slice(0,256).arrayBuffer()));if(variant!=='original' && (type!=='image/webp'||part.size>limits.image))throw new Error('Invalid image preview');
   const path=`${id}/${variant}`;const {error}=await admin.storage.from('portfolio').upload(path,part,{contentType:type!,cacheControl:'0',upsert:false});if(error)throw error;stored.push(path);variants[variant]=path;
  }
  const {data,error}=await admin.from('media').insert({id,name:file.name.slice(0,180),mime,size:file.size,variants}).select().single();if(error)throw error;return json(data);
 }catch(e){if(stored.length)await admin.storage.from('portfolio').remove(stored);return json({error:e instanceof Error?e.message:'Upload failed. Retry.'},400);}
});
