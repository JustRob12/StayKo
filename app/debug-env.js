// Debug script to check environment variables
console.log('Environment Variables Debug:');
console.log('EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL);
console.log('EXPO_PUBLIC_SUPABASE_KEY:', process.env.EXPO_PUBLIC_SUPABASE_KEY);
console.log('Key length:', process.env.EXPO_PUBLIC_SUPABASE_KEY?.length);
console.log('Key starts with eyJ:', process.env.EXPO_PUBLIC_SUPABASE_KEY?.startsWith('eyJ'));
