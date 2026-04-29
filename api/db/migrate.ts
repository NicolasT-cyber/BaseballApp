import { Database as DB } from "sqlite";
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";

async function runMigrations() {
  console.log('Running migrations...');

  const db = new DB('./data/baseball.db');
  const migrationsFolder = './api/db/migrations';

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS __migrations (
        name TEXT PRIMARY KEY,
        executed_at TEXT NOT NULL
      );
    `);

    const executed = db.prepare("SELECT name FROM __migrations").values();
    const executedNames = new Set(executed.map((row) => row[0]));

    for await (const dirEntry of Deno.readDir(migrationsFolder)) {
      if (dirEntry.isFile && dirEntry.name.endsWith('.sql')) {
        const migrationName = dirEntry.name;
        if (!executedNames.has(migrationName)) {
          console.log(`Executing migration: ${migrationName}`);
          const sqlContent = await Deno.readTextFile(path.join(migrationsFolder, migrationName));
          const statements = sqlContent
            .split('--> statement-breakpoint')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          for (const stmt of statements) {
            db.exec(stmt);
          }
          db.prepare("INSERT INTO __migrations (name, executed_at) VALUES (?, ?)").run(
            migrationName,
            new Date().toISOString(),
          );
        } else {
          console.log(`Migration already executed: ${migrationName}`);
        }
      }
    }

    console.log('Migrations finished successfully.');
  } catch (error) {
    console.error('Failed to run migrations:', error);
    Deno.exit(1);
  } finally {
    db.close();
  }
}

runMigrations();
