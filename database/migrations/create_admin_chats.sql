-- Create admin_chats table and RLS policies for admin-only group chat
create table if not exists public.admin_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) > 0),
  created_at timestamptz not null default now()
);

create index if not exists admin_chats_created_at_idx on public.admin_chats(created_at desc);
create index if not exists admin_chats_user_id_idx on public.admin_chats(user_id);

alter table public.admin_chats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'admin_chats' and policyname = 'Admins can read admin chats'
  ) then
    create policy "Admins can read admin chats"
      on public.admin_chats for select
      using (
        exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.admin_role = true
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' and tablename = 'admin_chats' and policyname = 'Admins can insert their own admin chats'
  ) then
    create policy "Admins can insert their own admin chats"
      on public.admin_chats for insert
      with check (
        user_id = auth.uid() and exists (
          select 1 from public.profiles p
          where p.id = auth.uid() and p.admin_role = true
        )
      );
  end if;
end $$;


