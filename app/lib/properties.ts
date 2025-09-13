import { supabase } from './supabase';

export interface Property {
  id: string;
  user_id: string;
  type: 'rent' | 'sale' | 'boarding';
  title: string;
  description?: string;
  price: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  contact_name?: string;
  contact_number?: string;
  contact_email?: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyPhoto {
  id: string;
  property_id: string;
  photo_url: string;
  created_at: string;
}

export interface CreatePropertyData {
  type: 'rent' | 'sale' | 'boarding';
  title: string;
  description?: string;
  price: number;
  location?: string;
  latitude?: number;
  longitude?: number;
  contact_name?: string;
  contact_number?: string;
  contact_email?: string;
}

export interface UpdatePropertyData extends Partial<CreatePropertyData> {}

export const propertiesService = {
  // Get all properties
  async getAllProperties(): Promise<Property[]> {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching properties:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching properties:', error);
      throw error;
    }
  },

  // Get properties by user
  async getPropertiesByUser(userId: string): Promise<Property[]> {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user properties:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching user properties:', error);
      throw error;
    }
  },

  // Get single property by ID
  async getProperty(propertyId: string): Promise<Property | null> {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (error) {
        console.error('Error fetching property:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching property:', error);
      return null;
    }
  },

  // Create new property
  async createProperty(propertyData: CreatePropertyData): Promise<{ data: Property | null; error: any }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('properties')
        .insert({
          ...propertyData,
          user_id: user.id
        })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error creating property:', error);
      return { data: null, error };
    }
  },

  // Update property
  async updateProperty(propertyId: string, updates: UpdatePropertyData): Promise<{ data: Property | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('properties')
        .update(updates)
        .eq('id', propertyId)
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error updating property:', error);
      return { data: null, error };
    }
  },

  // Delete property
  async deleteProperty(propertyId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyId);

      return { error };
    } catch (error) {
      console.error('Error deleting property:', error);
      return { error };
    }
  },

  // Search properties
  async searchProperties(query: string, filters?: {
    type?: 'rent' | 'sale' | 'boarding';
    minPrice?: number;
    maxPrice?: number;
    location?: string;
  }): Promise<Property[]> {
    try {
      let queryBuilder = supabase
        .from('properties')
        .select('*');

      // Text search
      if (query) {
        queryBuilder = queryBuilder.or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`);
      }

      // Apply filters
      if (filters?.type) {
        queryBuilder = queryBuilder.eq('type', filters.type);
      }

      if (filters?.minPrice) {
        queryBuilder = queryBuilder.gte('price', filters.minPrice);
      }

      if (filters?.maxPrice) {
        queryBuilder = queryBuilder.lte('price', filters.maxPrice);
      }

      if (filters?.location) {
        queryBuilder = queryBuilder.ilike('location', `%${filters.location}%`);
      }

      const { data, error } = await queryBuilder.order('created_at', { ascending: false });

      if (error) {
        console.error('Error searching properties:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error searching properties:', error);
      throw error;
    }
  }
};

export const propertyPhotosService = {
  // Get photos for a property
  async getPropertyPhotos(propertyId: string): Promise<PropertyPhoto[]> {
    try {
      const { data, error } = await supabase
        .from('property_photos')
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching property photos:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching property photos:', error);
      throw error;
    }
  },

  // Add photo to property
  async addPropertyPhoto(propertyId: string, photoUrl: string): Promise<{ data: PropertyPhoto | null; error: any }> {
    try {
      const { data, error } = await supabase
        .from('property_photos')
        .insert({
          property_id: propertyId,
          photo_url: photoUrl
        })
        .select()
        .single();

      return { data, error };
    } catch (error) {
      console.error('Error adding property photo:', error);
      return { data: null, error };
    }
  },

  // Delete property photo
  async deletePropertyPhoto(photoId: string): Promise<{ error: any }> {
    try {
      const { error } = await supabase
        .from('property_photos')
        .delete()
        .eq('id', photoId);

      return { error };
    } catch (error) {
      console.error('Error deleting property photo:', error);
      return { error };
    }
  }
};
