-- Anonymous callers may record a constrained event, never read individual visits.
create table private.activity (
 day date not null default (now() at time zone 'UTC')::date,
 session_id uuid not null,
 event text not null check(event in ('visit','project','download')),
 target text not null,
 primary key(day,session_id,event,target)
);
alter table private.activity enable row level security;
revoke all on private.activity from public,anon,authenticated;
create function public.record_activity(session_id uuid,event text,target text default '')
returns void language plpgsql security definer set search_path='' as $$
begin
 if session_id is null or event is null or target is null then return; end if;
 if public.is_owner() then return; end if;
 if event='visit' then
  if target<>'' then return; end if;
 elsif event in ('project','download') then
  if not exists(select 1 from public.published_entries p where p.id::text=target
    and (event='project' or exists(select 1 from jsonb_array_elements(p.content->'links') l where l->>'type'='Download')))
  then return; end if;
 else return;
 end if;
 insert into private.activity(session_id,event,target) values(session_id,event,target) on conflict do nothing;
end $$;
create function public.activity_totals() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'visits',count(*) filter(where event='visit'),
 'projectViews',count(*) filter(where event='project'),
 'downloadClicks',count(*) filter(where event='download'),
 'since',min(day)) from private.activity
$$;
create function public.owner_activity() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_owner() then raise exception 'Owner access required'; end if;
 return jsonb_build_object('totals',public.activity_totals(),'days',coalesce((select jsonb_agg(d order by day desc) from (
 select day,count(*) filter(where event='visit') as visits,count(*) filter(where event='project') as project_views,count(*) filter(where event='download') as download_clicks
 from private.activity where day>=(now() at time zone 'UTC')::date-29 group by day
 ) d),'[]'::jsonb));
end $$;
revoke all on function public.record_activity(uuid,text,text),public.activity_totals(),public.owner_activity() from public;
grant execute on function public.record_activity(uuid,text,text),public.activity_totals() to anon,authenticated;
grant execute on function public.owner_activity() to authenticated;
