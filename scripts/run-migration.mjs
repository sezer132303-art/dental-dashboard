import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Supabase connection string format
// postgres://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error('Missing DATABASE_URL environment variable')
  console.error('Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres')
  process.exit(1)
}

const migrationPath = join(__dirname, '../supabase/migrations/008_whatsapp_booking.sql')
const migrationSql = readFileSync(migrationPath, 'utf-8')

async function runMigration() {
  const client = new pg.Client({ connectionString })

  try {
    console.log('Connecting to database...')
    await client.connect()
    console.log('Connected!')

    console.log('Running migration...')
    await client.query(migrationSql)
    console.log('Migration completed successfully!')

  } catch (error) {
    console.error('Migration error:', error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

runMigration()
