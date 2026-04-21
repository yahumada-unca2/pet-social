-- 1. Create Profiles table (Links to Supabase Auth)
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  breed text,
  bio text,
  avatar_url text,
  cover_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Posts table
create table public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  image_url text not null,
  caption text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Likes table
create table public.likes (
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (post_id, user_id)
);

-- 4. Create Comments table
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create Follows table
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (follower_id, following_id)
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;

-- Profiles: Anyone can view, but only the owner can update
create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can insert their own profile." on public.profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on public.profiles for update using (auth.uid() = id);

-- Posts: Anyone can view, only owner can create/update/delete
create policy "Posts are viewable by everyone." on public.posts for select using (true);
create policy "Users can create posts." on public.posts for insert with check (auth.uid() = user_id);
create policy "Users can update own posts." on public.posts for update using (auth.uid() = user_id);
create policy "Users can delete own posts." on public.posts for delete using (auth.uid() = user_id);

-- Likes: Anyone can view, only the user can like/unlike
create policy "Likes are viewable by everyone." on public.likes for select using (true);
create policy "Users can insert their own likes." on public.likes for insert with check (auth.uid() = user_id);
create policy "Users can delete their own likes." on public.likes for delete using (auth.uid() = user_id);

-- Comments: Anyone can view, only user can create/delete
create policy "Comments are viewable by everyone." on public.comments for select using (true);
create policy "Users can insert their own comments." on public.comments for insert with check (auth.uid() = user_id);
create policy "Users can update own comments." on public.comments for update using (auth.uid() = user_id);
create policy "Users can delete own comments." on public.comments for delete using (auth.uid() = user_id);

-- Follows: Anyone can view, only user can follow/unfollow
create policy "Follows are viewable by everyone." on public.follows for select using (true);
create policy "Users can follow others." on public.follows for insert with check (auth.uid() = follower_id);
create policy "Users can unfollow others." on public.follows for delete using (auth.uid() = follower_id);

-- =========================================================================
-- DATABASE FUNCTIONS & TRIGGERS
-- =========================================================================

-- Trigger to automatically create a profile entry when a new auth user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (new.id, split_part(new.email, '@', 1), 'https://ui-avatars.com/api/?name=' || split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();