/**
 * Find tx hashes where any topic in topics_json matches a given address.
 *
 * Usage:
 *   node find-address.js 0x1234....abcd
 *
 *
 * Notes:
 * - Indexed address topics in logs are encoded as 32 bytes:
 *   0x000000000000000000000000 + <20-byte address>
 * - This script normalizes your input into that 32-byte topic form and compares.
 */

const Database = require("better-sqlite3");

function normalizeHex0x(s) {
  if (!s) return null;
  s = s.trim().toLowerCase();
  if (!s.startsWith("0x")) s = "0x" + s;
  return s;
}

function isAddress(addr) {
  return /^0x[0-9a-f]{40}$/.test(addr);
}

function isTopic32(topic) {
  return /^0x[0-9a-f]{64}$/.test(topic);
}

function addressToTopic32(addr) {
  // addr is 0x + 40 hex chars
  const stripped = addr.slice(2);
  return "0x" + "0".repeat(24) + stripped; // 12 bytes (24 hex) of left padding
}

function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node find-address.js <0xAddress>");
    process.exit(1);
  }

  const norm = normalizeHex0x(input);

  let targetTopic;
  if (isAddress(norm)) {
    targetTopic = addressToTopic32(norm);
  } else if (isTopic32(norm)) {     //TODO: may be able to remove all code associated with "topics"
    targetTopic = norm;
  } else {
    console.error("Input must be a 20-byte address (0x + 40 hex) or 32-byte topic (0x + 64 hex).");
    process.exit(1);
  }

  const db = new Database("events.db", { readonly: true });

  try {
    // Pull only the columns we need.
    // If your DB is huge and you want to reduce JS parsing work,
    // consider adding additional WHERE filters (block range, address, topic0, etc.).
    const stmt = db.prepare(`
      SELECT tx_hash, topics_json, label, block_number
      FROM contract_logs
      WHERE topics_json IS NOT NULL
    `);

    const rows = stmt.iterate();

    const txs = new Set();
    const hashes = new Set();
    let scanned = 0;
    let matchedRows = 0;

    for (const row of rows) {
      scanned++;

      let topics;
      try {
        topics = JSON.parse(row.topics_json);
      } catch {
        continue; // skip malformed JSON
      }
      if (!Array.isArray(topics)) continue;

      // Normalize topics to lowercase for comparison
      const hasMatch = topics.some((t) => typeof t === "string" && t.toLowerCase() === targetTopic);
      if (hasMatch) {
        matchedRows++;
        txs.add((`${row.block_number} : ${row.tx_hash} : ${row.label}` || "").toLowerCase());
        hashes.add((row.tx_hash || "").toLowerCase());
      }
    }

    const out = Array.from(txs).sort();
    console.log(`Target topic: ${targetTopic}`);
    console.log(`Rows scanned: ${scanned}`);
    console.log(`Rows matched: ${matchedRows}`);
    console.log(`Unique tx_hash matched: ${out.length}\n`);

    for (const tx of out) console.log(tx);
    console.log("Nice etherscan links:");
    for (const hash of hashes) console.log(`https://etherscan.io/tx/${hash}`);

  } finally {
    db.close();
  }
}

main();