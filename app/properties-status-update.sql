-- Add status column to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Unavailable'));

-- Update existing properties to have 'Available' status
UPDATE properties SET status = 'Available' WHERE status IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties (status);
