import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://uicqzvblfbcobvizpsjp.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'your-actual-supabase-anon-key-here';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Types for our database
export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardItem {
  id: string;
  user_id: string;
  title: string;
  content?: string;
  created_at: string;
  updated_at: string;
}
