-- Add latitude and longitude to users table for precise location data
ALTER TABLE users
ADD COLUMN latitude DECIMAL(9, 6),
ADD COLUMN longitude DECIMAL(9, 6);

-- Create an index on the new columns for faster spatial queries
CREATE INDEX idx_users_lat_lon ON users(latitude, longitude);
