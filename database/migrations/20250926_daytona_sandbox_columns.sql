-- Daytona sandbox persistence for each user
-- Adds sandbox id and VNC password fields to profiles and an index for fast lookups

alter table if exists profiles
  add column if not exists daytona_sandbox_id text,
  add column if not exists daytona_vnc_password text;

create index if not exists idx_profiles_daytona_sandbox_id
  on profiles (daytona_sandbox_id);
