import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
	throw new Error(
		'DATABASE_URL is not set. Gunakan connection string pooler Supabase (port 6543).'
	)
}

const adapter = new PrismaPg({ connectionString })

/**
 * Singleton Prisma Client (Postgres via driver adapter).
 * Semua service harus import dari sini agar berbagi satu connection pool.
 */
export const prisma = new PrismaClient({ adapter })
