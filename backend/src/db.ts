/**
 * Prisma Database Client
 * 
 * Configured for Prisma 7 with pg adapter for PostgreSQL
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// Create PostgreSQL pool
const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/zerolink',
});

// Create Prisma adapter
const adapter = new PrismaPg(pool);

// Create Prisma client with adapter
export const prisma = new PrismaClient({ adapter });

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
    await pool.end();
});

export default prisma;
