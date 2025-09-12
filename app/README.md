# StayKo App - Authentication & Dashboard

A React Native app with Supabase authentication and a simple dashboard.

## Features

- User registration and login
- Secure authentication with Supabase
- Personal dashboard with CRUD operations
- Modern UI with clean design
- Real-time data synchronization

## Setup Instructions

### 1. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to your project's SQL Editor
3. Copy and paste the contents of `supabase-setup.sql` into the SQL Editor
4. Run the script to create the necessary tables and policies
5. Go to Settings > API to get your project URL and anon key

### 2. Configure Environment Variables

1. Create a `.env` file in the app directory (already created)
2. Update the `.env` file with your Supabase credentials:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://uicqzvblfbcobvizpsjp.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key_here
   ```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the App

```bash
# Start the development server
npm start

# Run on specific platforms
npm run android
npm run ios
npm run web
```

## Project Structure

```
app/
├── lib/
│   └── supabase.ts          # Supabase configuration
├── contexts/
│   └── AuthContext.tsx      # Authentication context
├── screens/
│   ├── LoginScreen.tsx      # Login screen
│   ├── RegisterScreen.tsx   # Registration screen
│   └── DashboardScreen.tsx  # Dashboard screen
├── supabase-setup.sql       # Database setup script
├── .env                     # Environment variables
├── App.tsx                  # Main app component
└── package.json
```

## Database Schema

The app uses the following tables:

- `auth.users` - Supabase built-in user authentication
- `public.profiles` - Extended user profile information
- `public.user_dashboard` - User's personal dashboard items

## Authentication Flow

1. **Registration**: Users can create accounts with email, password, and full name
2. **Login**: Users can sign in with email and password
3. **Dashboard**: Authenticated users can view and manage their dashboard items
4. **Sign Out**: Users can securely sign out

## Features

### Authentication
- Email/password registration and login
- Automatic profile creation on registration
- Secure session management
- Email verification support

### Dashboard
- Add new dashboard items
- View all personal items
- Delete items
- Real-time updates
- Pull-to-refresh functionality

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Secure authentication with Supabase
- Input validation and error handling

## Environment Variables

The app uses the following environment variables:

- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**Note**: In Expo/React Native, environment variables must be prefixed with `EXPO_PUBLIC_` to be accessible in the client-side code.

## Customization

You can easily customize:
- UI colors and styling in the StyleSheet objects
- Dashboard functionality by modifying `DashboardScreen.tsx`
- Authentication flow by updating `AuthContext.tsx`
- Database schema by modifying `supabase-setup.sql`

## Troubleshooting

1. **Supabase connection issues**: 
   - Verify your URL and anon key in the `.env` file
   - Make sure environment variables are prefixed with `EXPO_PUBLIC_`

2. **Database errors**: 
   - Ensure you've run the SQL setup script
   - Check that RLS policies are properly configured

3. **Authentication issues**: 
   - Check your Supabase project settings
   - Verify email configuration in Supabase dashboard

4. **Build errors**: 
   - Make sure all dependencies are installed with `npm install`
   - Clear cache with `expo start -c`

## Next Steps

Consider adding:
- Email verification flow
- Password reset functionality
- User profile editing
- Push notifications
- Offline support
- Data export/import
- Advanced dashboard features
