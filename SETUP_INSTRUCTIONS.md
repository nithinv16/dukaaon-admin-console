# Admin Console Setup Instructions

## Database Setup

To complete the authentication system setup, you need to execute the SQL script in your Supabase dashboard:

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `sql/create_admin_credentials_table.sql`
4. Execute the SQL script

This will:
- Create the `admin_credentials` table
- Set up proper Row Level Security (RLS) policies
- Create the `validate_admin_credentials` function
- Insert default admin credentials

## Default Admin Credentials

After running the SQL script, you can log in with:
- **Email**: admin@dukaaon.com
- **Password**: admin123

## Testing the Application

1. Start the development server: `npm run dev`
2. Navigate to `http://localhost:3001`
3. You should be redirected to the login page
4. Use the default credentials to log in
5. You should be redirected to the dashboard

## Security Note

**Important**: Change the default admin password after your first login for security purposes.