
/**
 * Adds 3 rows to the table, which are "topic1", "topic2" and "topic3"
 * Populates these rows with the values for event logs 
 */

const Database = require("better-sqlite3");


function main() {
  const db = new Database("events.db");

  try {
    db.exec(`PRAGMA journal_mode = WAL;`);

    db.exec(`
      ALTER TABLE contract_logs ADD COLUMN topic1 TEXT;
      ALTER TABLE contract_logs ADD COLUMN topic2 TEXT;
      ALTER TABLE contract_logs ADD COLUMN topic3 TEXT;
    `);

  } finally {
    db.close();
  }
}

main();