import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

// Configure WebBrowser for better UX
WebBrowser.maybeCompleteAuthSession();

export const GoogleAuth = {
  async signIn() {
    try {
      console.log('Starting Google OAuth flow...');
      
      // Get the Google OAuth URL from Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'stayko://auth/callback',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      console.log('OAuth response:', { data, error });

      if (error) {
        console.error('OAuth Error:', error);
        throw error;
      }

      // If we have a URL, open it in WebBrowser
      if (data?.url) {
        console.log('Opening browser with URL:', data.url);
        
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          'stayko://auth/callback',
          {
            showInRecents: true,
            showTitle: true,
            enableBarCollapsing: false,
            ephemeralWebSession: false,
          }
        );

        console.log('WebBrowser result:', result);

        if (result.type === 'success' && result.url) {
          console.log('OAuth completed successfully');
          // The session should be automatically handled by Supabase
          return { data: { url: result.url }, error: null };
        } else if (result.type === 'cancel') {
          console.log('OAuth cancelled by user');
          return { data: null, error: new Error('Authentication cancelled') };
        } else {
          console.log('OAuth failed:', result);
          return { data: null, error: new Error('Authentication failed') };
        }
      } else {
        console.log('No URL returned from OAuth');
        return { data: null, error: new Error('No OAuth URL received') };
      }
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      return { data: null, error };
    }
  },
};
