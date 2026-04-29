import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { Database as DB } from 'sqlite';
import * as schema from './schema.ts';

const sqlite = new DB('./data/baseball.db');

export const db = drizzle(
	async (sql, params, method) => {
		if (method === 'run') {
			sqlite.prepare(sql).run(params as unknown[]);
			return { rows: [] };
		}
		const stmt = sqlite.prepare(sql);
		const rows = stmt.values(params as unknown[]);
		return { rows };
	},
	{ schema },
);
