import { supabase } from './supabase';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  contactnumber: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export const profilesService = {
  // Get user profile
  async getProfile(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      // Return the first profile if it exists, otherwise null
      return data && data.length > 0 ? data[0] : null;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  },

  // Create or update profile
  async upsertProfile(profileData: Partial<Profile>): Promise<{ data: Profile | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
        .select();

      if (error) {
        return { data: null, error };
      }

      return { data: data && data.length > 0 ? data[0] : null, error: null };
    } catch (error) {
      console.error('Error upserting profile:', error);
      return { data: null, error };
    }
  },

  // Update profile
  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ data: Profile | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select();

      if (error) {
        return { data: null, error };
      }

      return { data: data && data.length > 0 ? data[0] : null, error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { data: null, error };
    }
  },

  // Create profile
  async createProfile(profileData: Profile): Promise<{ data: Profile | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert(profileData)
        .select();

      if (error) {
        return { data: null, error };
      }

      return { data: data && data.length > 0 ? data[0] : null, error: null };
    } catch (error) {
      console.error('Error creating profile:', error);
      return { data: null, error };
    }
  },

  // Create profile if it doesn't exist
  async createProfileIfNotExists(userId: string, email: string, fullName?: string): Promise<{ data: Profile | null; error: any }> {
    try {
      // First check if profile exists
      const existingProfile = await this.getProfile(userId);
      if (existingProfile) {
        return { data: existingProfile, error: null };
      }

      // Create new profile
      const profileData: Partial<Profile> = {
        id: userId,
        full_name: fullName || null,
        contactnumber: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      return await this.createProfile(profileData as Profile);
    } catch (error) {
      console.error('Error creating profile if not exists:', error);
      return { data: null, error };
    }
  }
};
