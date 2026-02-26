
/**
 * Backfill labels in events.db based on func_sig, but ONLY where label is NULL.
 *
 * Usage:
 *   node backfill_labels.js  //TODO is this true?
 *
 * Notes:
 * - Uses the same mapping as your labelFromFuncSig().
 * - Updates rows in-place.
 * - Optional: also fill empty-string labels if you want (see WHERE clause).
 */

const { labelFromFuncSig } = require("./lib/cUSDT-labels");
const Database = require("better-sqlite3");


function main() {
  const db = new Database("events.db");

  try {
    db.exec(`PRAGMA journal_mode = WAL;`);

    // Select only rows missing a label (NULL).
    // If you also want to treat empty-string as missing, change to:
    //   WHERE label IS NULL OR label = ''
    const selectMissing = db.prepare(`
      SELECT chain_id, block_number, tx_hash, log_index, func_sig
      FROM contract_logs
      WHERE label IS NULL
    `);

    const updateLabel = db.prepare(`
      UPDATE contract_logs
      SET label = @label
      WHERE chain_id = @chain_id
        AND block_number = @block_number
        AND tx_hash = @tx_hash
        AND log_index = @log_index
        AND label IS NULL
    `);

    const rows = selectMissing.all();

    const tx = db.transaction((rowsToUpdate) => {
      let updated = 0;
      let skipped = 0;

      for (const r of rowsToUpdate) {
        const sig = (r.func_sig || "").toLowerCase();
        const label = labelFromFuncSig(sig);

        if (!label) {
          skipped++;
          console.log(`skipped func sig ${sig} - no label exists`);
          continue;
        }

        const info = updateLabel.run({
          chain_id: r.chain_id,
          block_number: r.block_number,
          tx_hash: (r.tx_hash || "").toLowerCase(),
          log_index: r.log_index,
          label,
        });

        updated += info.changes || 0;
      }

      return { updated, skipped, total: rowsToUpdate.length };
    });

    const { updated, skipped, total } = tx(rows);

    console.log(`Scanned rows missing label: ${total}`);
    console.log(`Updated labels: ${updated}`);
    console.log(`Skipped (unknown/unsupported func_sig): ${skipped}`);
  } finally {
    db.close();
  }
}

main();