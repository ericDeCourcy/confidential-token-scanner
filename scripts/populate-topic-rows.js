
/**
 * Adds 3 rows to the table, which are "topic1", "topic2" and "topic3"
 * Populates these rows with the values for event logs 
 */

const Database = require("better-sqlite3");


function main() {
  const db = new Database("events.db");

  try {
    db.exec(`PRAGMA journal_mode = WAL;`);

    // Select only rows missing a topic1 (NULL).
    const selectMissing = db.prepare(`
      SELECT chain_id, block_number, tx_hash, log_index, func_sig, topics_json
      FROM contract_logs
      WHERE topic1 IS NULL
    `);

    const updateLabel = db.prepare(`
      UPDATE contract_logs
      SET topic1 = @topic1,
          topic2 = @topic2,
          topic3 = @topic3
      WHERE chain_id = @chain_id
        AND block_number = @block_number
        AND tx_hash = @tx_hash
        AND log_index = @log_index
    `);

    const rows = selectMissing.all();

    const tx = db.transaction((rowsToUpdate) => {
      let updated = 0;

      for (const r of rowsToUpdate) {

        try {
          topics = JSON.parse(r.topics_json);
        } catch {
          continue; // skip malformed JSON
        }
        if (!Array.isArray(topics)) continue;

        const info = updateLabel.run({
          chain_id: r.chain_id,
          block_number: r.block_number,
          tx_hash: (r.tx_hash || "").toLowerCase(),
          log_index: r.log_index,
          topic1: topics[1],
          topic2: topics[2],
          topic3: topics[3]
        });

        updated++;
      }


      return { updated, total: rowsToUpdate.length };
    });

    const { updated, total } = tx(rows);

    console.log(`Populated topics 1-3: ${updated}`);
  } finally {
    db.close();
  }
}

main();