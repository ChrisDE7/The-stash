-- Run once in the owner's Supabase project. No owner is granted by this migration.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.owners(user_id uuid primary key references auth.users(id));
create function public.is_owner() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from private.owners where user_id=auth.uid()) $$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon,authenticated,service_role;
create table public.entries(id uuid primary key,content jsonb not null,updated_at timestamptz not null default now());
create table public.published_entries(id uuid primary key references public.entries(id) on delete cascade,content jsonb not null,updated_at timestamptz not null default now());
create table public.media(id uuid primary key default gen_random_uuid(),name text not null,mime text not null,size bigint not null,variants jsonb not null,created_at timestamptz not null default now());
create table public.published_media(entry_id uuid references public.published_entries(id) on delete cascade,media_id uuid references public.media(id) on delete restrict,primary key(entry_id,media_id));
create table public.site_settings(id integer primary key check(id=1),content jsonb not null);
alter table public.entries enable row level security;
alter table public.published_entries enable row level security;
alter table public.media enable row level security;
alter table public.published_media enable row level security;
alter table public.site_settings enable row level security;
create policy owner_entries on public.entries for select to authenticated using(public.is_owner());
create policy owner_media on public.media for select to authenticated using(public.is_owner());
create policy public_entries on public.published_entries for select to anon,authenticated using(true);
create policy public_settings on public.site_settings for select to anon,authenticated using(true);
create policy owner_settings on public.site_settings for all to authenticated using(public.is_owner()) with check(public.is_owner());
grant select on public.entries,public.media to authenticated;
grant select on public.published_entries,public.site_settings to anon,authenticated;
grant insert,update on public.site_settings to authenticated;
-- Mutations use checked functions; no direct draft/public write grants.
revoke insert,update,delete on public.entries,public.published_entries,public.media,public.published_media from anon,authenticated;
create function public.save_entry(entry jsonb,publish_now boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare eid uuid; m jsonb; l jsonb; aid uuid;
begin
 if not public.is_owner() then raise exception 'Owner access required'; end if;
 lock table public.entries in row exclusive mode;
 eid := (entry->>'id')::uuid;
 if coalesce(length(trim(entry->>'title')),0) not between 1 and 160 or coalesce(entry->>'kind','') not in ('project','plugin') then raise exception 'Enter a title (up to 160 characters) and valid type';end if;
 if octet_length(entry::text)>262144 then raise exception 'Entry is too large';end if;
 if jsonb_typeof(entry->'media') is distinct from 'array' or jsonb_array_length(entry->'media')>100 then raise exception 'Use at most 100 gallery items';end if;
 if jsonb_typeof(entry->'links') is distinct from 'array' or jsonb_array_length(entry->'links')>50 then raise exception 'Invalid links';end if;
 for l in select value from jsonb_array_elements(entry->'links') loop
  if coalesce(length(trim(l->>'label')),0)=0 or coalesce(l->>'url','') !~ '^(https://[^[:space:]]+|mailto:[^[:space:]]+)$' then raise exception 'Check link labels and URLs';end if;
 end loop;
 for m in select value from jsonb_array_elements(entry->'media') loop
  if coalesce(m->>'kind','') not in ('image','video','link') then raise exception 'Invalid media';end if;
  if m->>'kind'='link' then
   if coalesce(m->>'url','') !~ '^https://(www\.youtube\.com/watch\?v=[A-Za-z0-9_-]{11}|(www\.)?vimeo\.com/[0-9]+([/?][A-Za-z0-9_?=&%-]+)?|player\.vimeo\.com/video/[0-9]+(\?h=[A-Za-z0-9]+)?)$' then raise exception 'Unsupported video link';end if;
  else
   if not exists(select 1 from public.media where id=(m->>'asset')::uuid) then raise exception 'Finish uploading all media before saving';end if;
  end if;
  if coalesce(m->>'poster','')<>'' and not exists(select 1 from public.media where id=(m->>'poster')::uuid and (mime like 'image/%' or variants ? 'thumb')) then raise exception 'Invalid poster';end if;
 end loop;
 insert into public.entries(id,content) values(eid,entry) on conflict(id) do update set content=excluded.content,updated_at=now();
 if publish_now then
  insert into public.published_entries(id,content) values(eid,entry) on conflict(id) do update set content=excluded.content,updated_at=now();
  delete from public.published_media where entry_id=eid;
  for m in select value from jsonb_array_elements(entry->'media') loop
   foreach aid in array array[nullif(m->>'asset','')::uuid,nullif(m->>'poster','')::uuid] loop
    if aid is not null then insert into public.published_media values(eid,aid) on conflict do nothing;end if;
   end loop;
  end loop;
 end if;
end $$;
create function public.unpublish_entry(entry_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_owner() then raise exception 'Owner access required';end if;delete from public.published_entries where id=entry_id;end $$;
create function public.delete_entry(entry_id uuid) returns void language plpgsql security definer set search_path='' as $$ begin if not public.is_owner() then raise exception 'Owner access required';end if;delete from public.entries where id=entry_id;end $$;
create function public.delete_media(asset_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare paths jsonb;begin
 if not public.is_owner() then raise exception 'Owner access required';end if;
 -- Lock against publication; protect references in BOTH working drafts and published snapshots.
 lock table public.entries,public.published_entries,public.published_media in share row exclusive mode;
 if exists(select 1 from public.entries e, lateral jsonb_array_elements(e.content->'media') m where m->>'asset'=asset_id::text or m->>'poster'=asset_id::text) or exists(select 1 from public.published_media where media_id=asset_id) then raise exception 'This file is still used. Remove it from every draft and published entry first.';end if;
 delete from public.media where id=asset_id returning variants into paths;return paths;
end $$;
revoke all on function public.save_entry(jsonb,boolean),public.unpublish_entry(uuid),public.delete_entry(uuid),public.delete_media(uuid) from public;
grant execute on function public.save_entry(jsonb,boolean),public.unpublish_entry(uuid),public.delete_entry(uuid),public.delete_media(uuid) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('portfolio','portfolio',false,41943040,array['image/jpeg','image/png','image/webp','video/mp4','video/webm']);
create policy owner_download on storage.objects for select to authenticated using(bucket_id='portfolio' and public.is_owner());
-- Uploads and permanent removal ONLY through the validated Edge Function.
insert into public.site_settings values(1,'{"title":"The Stash","intro":"Unturned maps, plugins & creative work by Chris.","about":"Websites, game maps, experiments, and creative tech work.","contactIntro":"Reach out for project and server work.","discord":"_7bush7","links":[{"label":"Email Chris","url":"mailto:chrisdesigningenterprises@gmail.com"},{"label":"GitHub","url":"https://github.com/ChrisDE7"}],"categories":["Unturned","Websites"],"featured":[],"description":"The Stash — Unturned maps, plugins and creative work by Chris."}');
