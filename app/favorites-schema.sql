-- Create favorites table for user property favorites
CREATE TABLE user_favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, property_id) -- Prevent duplicate favorites
);

-- Add indexes for performance
CREATE INDEX idx_user_favorites_user_id ON user_favorites (user_id);
CREATE INDEX idx_user_favorites_property_id ON user_favorites (property_id);

-- Enable Row Level Security (RLS)
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;

-- Policies for user_favorites table
-- Users can only see their own favorites
CREATE POLICY "Users can view their own favorites."
ON user_favorites FOR SELECT
USING (auth.uid() = user_id);

-- Users can only add their own favorites
CREATE POLICY "Users can add their own favorites."
ON user_favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own favorites
CREATE POLICY "Users can delete their own favorites."
ON user_favorites FOR DELETE
USING (auth.uid() = user_id);
