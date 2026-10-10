import dotenv from 'dotenv';
// Shell values win; .env.local takes precedence over .env.
dotenv.config({ path: ['.env.local', '.env'], quiet: true });
