// open database
// find everyone who called wrap
// add the wrapper address to txt file "wrappers"

const hre = require("hardhat");
const Database = require("better-sqlite3");
const fs = require("fs/promises");
const path = require('path');


async function main() {

    const provider = hre.ethers.provider; 
    const {chainId} = await provider.getNetwork();
    if(chainId != 1)
    {
      console.error(`Wrong network - configure hre default network to ethereum`);
      process.exit(1);
    }
  
    const db = new Database(`cUSDC_events.db`, { readonly: true });

    try {
        // Pull only the columns we need.
        const stmt = db.prepare(`
          SELECT topics_json, label, block_number
          FROM contract_logs
          WHERE topics_json IS NOT NULL
        `);
    
        const rows = stmt.iterate();
    
        const wrappers = new Set();
        //const hashes = new Set();
        let scanned = 0;
        let matchedRows = 0;
    
        for (const row of rows) {
          scanned++;
    
          let topics;
          try {
            topics = JSON.parse(row.topics_json);
          } catch {
            continue; // skip malformed JSON    
            // TODO do we need to worry about this? If not, also update analyze-address.js
          }
          if (!Array.isArray(topics)) continue;
    
          // Normalize topics to lowercase for comparison
          const hasMatch = row.label === `WRAP`;
          if (hasMatch) {
            matchedRows++
            console.log(`${row.block_number} : WRAP : ${topics[2]}`);
            wrappers.add((topics[2] || "").toLowerCase());
          }

          /*
          topics.some((t) => typeof t === "string" && t.toLowerCase() === targetTopic);
          if (hasMatch) {
            matchedRows++;
            txs.add((`${row.block_number} : ${row.tx_hash.slice(0,6)}...${row.tx_hash.slice(-4)} : https://etherscan.io/tx/${row.tx_hash} : ${row.label}` || "").toLowerCase());
            hashes.add((row.tx_hash || "").toLowerCase());
          }
            */
        }
    
        const out = Array.from(wrappers).sort();
       // console.log(`Target topic: ${targetTopic}`);
        console.log(`Rows scanned: ${scanned}`);
        console.log(`Wraps found: ${matchedRows}`);
        console.log(`Unique wrappers: ${out.length}\n`);
 
        /*
        for (const wrapper of out) 
        {
            console.log(wrapper);
        }
        */

        //const lines = out.map(w => JSON.stringify(w)).join('\n');
        const lines = out.join('\n');
        const outputPath = path.join(__dirname, 'cUSDC_wrappers.txt');
        await fs.writeFile(outputPath, lines, 'utf8');

        //TODO this will write to a file in the directory you run it in, it should instead always write to the same directory as this script

      } finally {
        db.close();
      }
}

main();