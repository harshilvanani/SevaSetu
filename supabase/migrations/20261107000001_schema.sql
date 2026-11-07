-- SevaSetu core schema
-- Tables, enums, denormalized counters and helper functions used by RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.serve_mode as enum ('onsite', 'virtual', 'either');
create type public.participation_mode as enum ('onsite', 'virtual', 'hybrid');
create type public.visibility as enum ('public', 'private');
create type public.day_period as enum ('morning', 'afternoon', 'evening');
create type public.org_status as enum ('pending', 'approved', 'rejected');
create type public.org_role as enum ('owner', 'organizer');
create type public.event_status as enum ('draft', 'published', 'completed', 'cancelled');
create type public.task_type as enum ('quantity', 'role');
create type public.task_status as enum ('draft', 'open', 'full', 'closed', 'completed');
create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'expired', 'revoked');
create type public.assignment_status as enum ('active', 'completed', 'cancelled');
create type public.report_status as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text,
  avatar_url text,
  city text,
  latitude double precision,
  longitude double precision,
  radius_km integer not null default 10 check (radius_km between 1 and 500),
  interests text[] not null default '{}',
  skills text[] not null default '{}',
  serve_mode public.serve_mode not null default 'either',
  hours_per_week text check (hours_per_week in ('1-2', '3-5', '6+')),
  locale text not null default 'en' check (locale in ('en', 'hi', 'fr')),
  is_platform_admin boolean not null default false,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

create table public.availability_slots (
  user_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Monday
  period public.day_period not null,
  primary key (user_id, weekday, period)
);

-- ---------------------------------------------------------------------------
-- Organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  city text,
  description text,
  logo_url text,
  status public.org_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);

create table public.org_members (
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'organizer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '' check (char_length(description) <= 1000),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  mode public.participation_mode not null default 'onsite',
  venue_name text,
  address text,
  city text,
  latitude double precision,
  longitude double precision,
  visibility public.visibility not null default 'public',
  status public.event_status not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_time_order check (ends_at > starts_at)
);
create index events_org_idx on public.events (org_id);
create index events_status_idx on public.events (status, starts_at);

-- Details shared only with organizers and volunteers who joined a task in the event.
create table public.event_private_details (
  event_id uuid primary key references public.events (id) on delete cascade,
  online_details text,
  contact_info text
);

-- ---------------------------------------------------------------------------
-- Seva tasks
-- ---------------------------------------------------------------------------
create table public.seva_tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  title text not null check (char_length(title) between 2 and 140),
  description text not null default '',
  instructions text not null default '',
  steps text[] not null default '{}',
  category text,
  type public.task_type not null,
  -- quantity tasks
  target_qty integer check (target_qty > 0),
  unit text,
  max_per_volunteer integer check (max_per_volunteer > 0),
  max_volunteers integer check (max_volunteers > 0),
  minutes_per_unit integer check (minutes_per_unit >= 0),
  -- role tasks
  positions integer check (positions > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  signup_deadline timestamptz,
  mode public.participation_mode not null default 'onsite',
  visibility public.visibility not null default 'public',
  status public.task_status not null default 'draft',
  -- denormalized counters maintained by triggers (readable by anyone who can see the task)
  claimed_total integer not null default 0,
  volunteers_count integer not null default 0,
  verified_total integer not null default 0,
  pending_total integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seva_tasks_type_fields check (
    (type = 'quantity' and target_qty is not null and unit is not null)
    or (type = 'role' and positions is not null)
  ),
  constraint seva_tasks_time_order check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index seva_tasks_event_idx on public.seva_tasks (event_id);
create index seva_tasks_status_idx on public.seva_tasks (status);

-- ---------------------------------------------------------------------------
-- Invitations (existing users only)
-- ---------------------------------------------------------------------------
create table public.task_invitations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.seva_tasks (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (task_id, invitee_id)
);
create index task_invitations_invitee_idx on public.task_invitations (invitee_id);

-- ---------------------------------------------------------------------------
-- Assignments & progress
-- ---------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.seva_tasks (id) on delete cascade,
  volunteer_id uuid not null references public.profiles (id) on delete cascade,
  claimed_qty integer not null check (claimed_qty > 0),
  status public.assignment_status not null default 'active',
  joined_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  unique (task_id, volunteer_id)
);
create index assignments_volunteer_idx on public.assignments (volunteer_id);

create table public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  reported_qty integer not null check (reported_qty > 0),
  note text check (char_length(note) <= 500),
  status public.report_status not null default 'pending',
  verified_qty integer check (verified_qty >= 0),
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint progress_verified_le_reported check (verified_qty is null or verified_qty <= reported_qty)
);
create index progress_reports_assignment_idx on public.progress_reports (assignment_id);
create index progress_reports_pending_idx on public.progress_reports (status) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();
create trigger seva_tasks_touch before update on public.seva_tasks
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on sign-up
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Helper predicates (security definer so RLS policies don't recurse)
-- ---------------------------------------------------------------------------
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from profiles where id = auth.uid()), false)
$$;

create function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members where org_id = p_org and user_id = auth.uid())
$$;

-- Organizer of an *approved* org: allowed to manage events/tasks.
create function public.can_manage_org(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from org_members m join organizations o on o.id = m.org_id
    where m.org_id = p_org and m.user_id = auth.uid() and o.status = 'approved'
  )
$$;

create function public.task_org(p_task uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select e.org_id from seva_tasks t join events e on e.id = t.event_id where t.id = p_task
$$;

create function public.has_task_access(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from task_invitations i
    where i.task_id = p_task and i.invitee_id = auth.uid()
      and (i.status = 'accepted' or (i.status = 'pending' and i.expires_at > now()))
  ) or exists (
    select 1 from assignments a where a.task_id = p_task and a.volunteer_id = auth.uid()
  )
$$;

create function public.can_view_task(p_task uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from seva_tasks t join events e on e.id = t.event_id
    where t.id = p_task and (
      is_org_member(e.org_id)
      or (
        e.status in ('published', 'completed') and t.status <> 'draft'
        and (
          (e.visibility = 'public' and t.visibility = 'public')
          or has_task_access(t.id)
        )
      )
    )
  )
$$;

create function public.can_view_event(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e
    where e.id = p_event and (
      is_org_member(e.org_id)
      or (e.status in ('published', 'completed') and (
        e.visibility = 'public'
        or exists (select 1 from seva_tasks t where t.event_id = e.id and has_task_access(t.id))
      ))
    )
  )
$$;

create function public.is_event_participant(p_event uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from assignments a join seva_tasks t on t.id = a.task_id
    where t.event_id = p_event and a.volunteer_id = auth.uid() and a.status <> 'cancelled'
  )
$$;
