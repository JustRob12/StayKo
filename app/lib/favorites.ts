import { supabase } from './supabase';

export interface UserFavorite {
  id: string;
  user_id: string;
  property_id: string;
  created_at: string;
}

export const favoritesService = {
  // Add property to favorites
  async addToFavorites(propertyId: string): Promise<{ data: UserFavorite | null; error: any }> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { data: null, error: { message: 'User not authenticated' } };
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .insert({ 
        user_id: user.user.id, 
        property_id: propertyId 
      })
      .select()
      .single();

    return { data, error };
  },

  // Remove property from favorites
  async removeFromFavorites(propertyId: string): Promise<{ error: any }> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { error: { message: 'User not authenticated' } };
    }

    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.user.id)
      .eq('property_id', propertyId);

    return { error };
  },

  // Get user's favorite property IDs
  async getUserFavorites(): Promise<string[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .select('property_id')
      .eq('user_id', user.user.id);

    if (error) {
      console.error('Error fetching user favorites:', error);
      return [];
    }

    return data?.map(fav => fav.property_id) || [];
  },

  // Get user's favorite properties with full property data
  async getUserFavoriteProperties(): Promise<any[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        property_id,
        properties (
          id,
          user_id,
          type,
          title,
          description,
          price,
          location,
          latitude,
          longitude,
          contact_name,
          contact_number,
          contact_email,
          status,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', user.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching favorite properties:', error);
      return [];
    }

    return data?.map(fav => fav.properties).filter(Boolean) || [];
  },

  // Check if property is favorited by user
  async isPropertyFavorited(propertyId: string): Promise<boolean> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return false;
    }

    const { data, error } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', user.user.id)
      .eq('property_id', propertyId)
      .single();

    if (error) {
      return false;
    }

    return !!data;
  }
};
