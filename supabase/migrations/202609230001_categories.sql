create function public.save_categories(categories jsonb) returns void language plpgsql security definer set search_path='' as $$
declare mapping jsonb; names jsonb;
begin
 if not public.is_owner() then raise exception 'Owner access required';end if;
 if jsonb_typeof(categories) is distinct from 'array' or jsonb_array_length(categories)>100 then raise exception 'Invalid categories';end if;
 if exists(select 1 from jsonb_array_elements(categories) c where length(trim(c->>'name')) not between 1 and 80) then raise exception 'Category names must be 1–80 characters';end if;
 if (select count(*)<>count(distinct c->>'name') from jsonb_array_elements(categories) c) then raise exception 'Use unique category names';end if;
 select coalesce(jsonb_object_agg(c->>'original',c->>'name') filter(where coalesce(c->>'original','')<>''),'{}'::jsonb),coalesce(jsonb_agg(c->>'name'),'[]'::jsonb) into mapping,names from jsonb_array_elements(categories) c;
 update public.entries set content=jsonb_set(content,'{category}',coalesce(mapping->(content->>'category'),'""'::jsonb)),updated_at=now() where coalesce(content->>'category','')<>'';
 update public.published_entries set content=jsonb_set(content,'{category}',coalesce(mapping->(content->>'category'),'""'::jsonb)),updated_at=now() where coalesce(content->>'category','')<>'';
 update public.site_settings set content=jsonb_set(content,'{categories}',names) where id=1;
end $$;
revoke all on function public.save_categories(jsonb) from public;
grant execute on function public.save_categories(jsonb) to authenticated;
