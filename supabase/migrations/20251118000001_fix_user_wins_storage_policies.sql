-- Fix storage policies for user-wins bucket
-- Update policies to use correct path parsing

-- Drop and recreate upload policy
DROP POLICY IF EXISTS "Authenticated users can upload user-wins" ON storage.objects;
CREATE POLICY "Authenticated users can upload user-wins"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( 
  bucket_id = 'user-wins' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Drop and recreate update policy
DROP POLICY IF EXISTS "Users can update their own user-wins images" ON storage.objects;
CREATE POLICY "Users can update their own user-wins images"
ON storage.objects FOR UPDATE
TO authenticated
USING ( 
  bucket_id = 'user-wins' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

-- Drop and recreate delete policy
DROP POLICY IF EXISTS "Users can delete their own user-wins images" ON storage.objects;
CREATE POLICY "Users can delete their own user-wins images"
ON storage.objects FOR DELETE
TO authenticated
USING ( 
  bucket_id = 'user-wins' AND 
  auth.uid()::text = (string_to_array(name, '/'))[1]
);

