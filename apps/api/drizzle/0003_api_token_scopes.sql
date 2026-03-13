alter table api_tokens
  add column if not exists scopes jsonb;

update api_tokens
set scopes = coalesce(scopes, '[]'::jsonb)
where scopes is null;

alter table api_tokens
  alter column scopes set default '[]'::jsonb;

alter table api_tokens
  alter column scopes set not null;