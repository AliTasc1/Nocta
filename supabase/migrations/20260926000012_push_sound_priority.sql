-- Push bildirimleri: ses + yüksek öncelik + Android 'default' kanalı
create or replace function public.push_to_user(uid uuid, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare tok text; enabled boolean;
begin
  select expo_push_token, coalesce((settings->>'notifications')::boolean, true)
    into tok, enabled from profiles where id = uid;
  if tok is null or not enabled then return; end if;
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object('to', tok, 'title', p_title, 'body', p_body, 'data', p_data,
                                 'sound', 'default', 'priority', 'high', 'channelId', 'default'),
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb
    );
  exception when others then
    null;
  end;
end $$;
revoke execute on function public.push_to_user(uuid, text, text, jsonb) from public, anon, authenticated;
