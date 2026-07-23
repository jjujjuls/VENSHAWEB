import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setup() {
  /* Create 'media' storage bucket */
  const { data, error } = await supabase.storage.createBucket('media', {
    public: true,
    fileSizeLimit: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'image/webp', 'image/svg+xml', 'application/pdf',
      'video/mp4', 'video/quicktime'
    ],
  });

  if (error) {
    if (error.message?.includes('already exists')) {
      console.log('✅ Storage bucket "media" already exists.');
    } else {
      console.error('❌ Failed to create bucket:', error.message);
    }
  } else {
    console.log('✅ Storage bucket "media" created successfully.');
  }
}

setup();
