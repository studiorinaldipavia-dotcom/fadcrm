import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function query(text: string, params: any[] = []) {
  return await sql(text, params);
}