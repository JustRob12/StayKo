-- StayKo Real Estate App Database Schema
-- Properties and Property Photos Tables

-- 1. Create properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('rent', 'sale', 'boarding')),
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL,
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    contact_name TEXT,
    contact_number TEXT,
    contact_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create property_photos table
CREATE TABLE IF NOT EXISTS property_photos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    photo_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_photos ENABLE ROW LEVEL SECURITY;

-- 4. Create policies for properties table
-- Anyone can view properties
CREATE POLICY "Anyone can view properties" ON properties
    FOR SELECT USING (true);

-- Only property owners can insert their own properties
CREATE POLICY "Users can insert their own properties" ON properties
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only property owners can update their own properties
CREATE POLICY "Users can update their own properties" ON properties
    FOR UPDATE USING (auth.uid() = user_id);

-- Only property owners can delete their own properties
CREATE POLICY "Users can delete their own properties" ON properties
    FOR DELETE USING (auth.uid() = user_id);

-- 5. Create policies for property_photos table
-- Anyone can view property photos
CREATE POLICY "Anyone can view property photos" ON property_photos
    FOR SELECT USING (true);

-- Only property owners can insert photos for their properties
CREATE POLICY "Users can insert photos for their own properties" ON property_photos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM properties 
            WHERE properties.id = property_photos.property_id 
            AND properties.user_id = auth.uid()
        )
    );

-- Only property owners can update photos for their properties
CREATE POLICY "Users can update photos for their own properties" ON property_photos
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM properties 
            WHERE properties.id = property_photos.property_id 
            AND properties.user_id = auth.uid()
        )
    );

-- Only property owners can delete photos for their properties
CREATE POLICY "Users can delete photos for their own properties" ON property_photos
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM properties 
            WHERE properties.id = property_photos.property_id 
            AND properties.user_id = auth.uid()
        )
    );

-- 6. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Create trigger to automatically update updated_at
CREATE TRIGGER update_properties_updated_at 
    BEFORE UPDATE ON properties 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_user_id ON properties(user_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_location ON properties(location);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at);
CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON property_photos(property_id);

-- 9. Add some sample data (optional - remove if not needed)
-- INSERT INTO properties (user_id, type, title, description, price, location, latitude, longitude, contact_name, contact_number, contact_email) 
-- VALUES 
--     ('your-user-id-here', 'rent', 'Beautiful 2BR Apartment', 'Modern apartment in the city center', 25000.00, 'Makati City', 14.5547, 121.0244, 'John Doe', '+639123456789', 'john@example.com'),
--     ('your-user-id-here', 'sale', 'Luxury House', 'Spacious 3BR house with garden', 5000000.00, 'Quezon City', 14.6760, 121.0437, 'Jane Smith', '+639987654321', 'jane@example.com');

-- 10. Grant necessary permissions
GRANT ALL ON properties TO authenticated;
GRANT ALL ON property_photos TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
