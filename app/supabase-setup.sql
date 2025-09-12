-- Supabase SQL Setup Script for StayKo App
-- Run this script in your Supabase SQL Editor

-- Enable Row Level Security (RLS) for auth.users table
-- This is usually enabled by default, but let's make sure
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create a profiles table to store additional user information
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles table
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile when user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at on profile changes
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create a simple dashboard data table (example)
CREATE TABLE IF NOT EXISTS public.user_dashboard (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_dashboard table
ALTER TABLE public.user_dashboard ENABLE ROW LEVEL SECURITY;

-- Create policies for user_dashboard table
-- Users can view their own dashboard items
CREATE POLICY "Users can view own dashboard items" ON public.user_dashboard
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own dashboard items
CREATE POLICY "Users can insert own dashboard items" ON public.user_dashboard
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own dashboard items
CREATE POLICY "Users can update own dashboard items" ON public.user_dashboard
    FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own dashboard items
CREATE POLICY "Users can delete own dashboard items" ON public.user_dashboard
    FOR DELETE USING (auth.uid() = user_id);

-- Trigger to automatically update updated_at on dashboard changes
DROP TRIGGER IF EXISTS on_dashboard_updated ON public.user_dashboard;
CREATE TRIGGER on_dashboard_updated
    BEFORE UPDATE ON public.user_dashboard
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert some sample dashboard data (optional - remove if not needed)
-- This will only work after users are created
-- INSERT INTO public.user_dashboard (user_id, title, content) 
-- VALUES ('your-user-id-here', 'Welcome!', 'This is your dashboard. You can add more items here.');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL ON public.user_dashboard TO anon, authenticated;
