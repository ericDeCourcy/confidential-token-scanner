const Database = require("better-sqlite3");
const fs = require("fs/promises");
const path = require("path");
const { labelFromFuncSig } = require("./lib/funcSig-labels"); 
const hre = require("hardhat");


// 1. Find the input token
//  revert if invalid token
// 2. if table doesn't exist for this token handles, create it
//      table columns:
//          handle              String
//          min                 String         min possible value for this handle (must be string because may exceed signed-int64)
//          max                 String         max possible value for this handle
//          known               Bool
//          linked              JSON        list of associated handles
//          Alg_min             String      Algebraic representation of handle min value
//          Alg_max             String      Algebraic representation of handle max value
//          label_prefix        String      "label" for this handle, like "BID" or "TRANSFER"
//          label_id            String      For BID, its a number. For TRANSFER its like 4 bytes of the hash or something. Whatever is used in `analyze-address.js`
//          tx                  String      tx hash where handle was created
//          linked_addresses    JSON        list of associated onchain addresses
//          block               Int         Block where handle originated
// 3. create "skipped" and "updated" counters
// 3. for each row in the token table
//      switch(label)
//          case BID_W_PROOF
//              create entry with "handle" == confidential transfer topic 3
//              find bid id
//              write to label_prefix and label_id
//              TODO: Do the rest of these columns
//              updated++;
//          TODO: do all other cases
//          default:
//              skipped ++;

async function main() {
    
    // get the cToken to process and check it is valid
    const cToken = process.argv[2];

    if (!cToken) {
        console.error("Usage: node update-handle-table.js <cToken>");
        process.exit(1);
      }
      if (cToken != "cBRON" &&
          cToken != "ctGBP" && 
          cToken != "cUSDC" &&
          cToken != "cUSDT" &&
          cToken != "cWETH" &&
          cToken != "cZAMA" )
      {
        console.error(`Invalid cToken: ${cToken}`);
        console.error("Usage: node update-handle-table.js <cToken>");
        process.exit(1);
    }

    // open the db
    const db = new Database(`${cToken}_events.db`);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS handles (
            handle TEXT PRIMARY KEY,
            min TEXT,
            max TEXT,
            alg_min TEXT,
            alg_max TEXT,
            known INTEGER NOT NULL DEFAULT 0,
            linked_handles TEXT NOT NULL DEFAULT '[]',
            label_prefix TEXT,
            label_id TEXT,
            tx TEXT NOT NULL,
            linked_addresses TEXT NOT NULL DEFAULT '[]',
            block INTEGER NOT NULL,
            label_prefix, 
            label_id
        )
    `);

    const provider = hre.ethers.provider; 


    let updated = 0;
    let skipped = 0;

  
    const insertHandle = db.prepare(`
        INSERT OR IGNORE INTO handles (
          handle,
          min,
          max,
          alg_min,
          alg_max,
          known,
          linked_handles,
          label_prefix,
          label_id,
          tx,
          linked_addresses,
          block
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateLabelId = db.prepare(`
        UPDATE handles
        SET label_id = ?
        WHERE handle = ? AND label_id IS NULL
    `);
  
    const bids = db.prepare(`
        SELECT topic3, tx_hash, block_number
        FROM contract_logs
        WHERE label = ?
      `).all('BID_W_PROOF');

    const wraps = db.prepare(`
        SELECT topic3, tx_hash, block_number
        FROM contract_logs
        WHERE label = ?
    `).all('WRAP');

    const nullLabelIds = db.prepare(`
        SELECT tx
        FROM handles
        WHERE label_id IS NULL
    `).all();

    const deleteHandle = db.prepare(`
        DELETE FROM handles
        WHERE tx = ?
    `);

    // selects all where "min" field is NULL
    // TODO: ought to update this in the contract_logs table too
    const zeroMins = db.prepare(`
        SELECT tx
        FROM handles
        WHERE min = '0.0'`
    ).all();

    console.log(
        db.prepare(`SELECT COUNT(*) AS n FROM handles WHERE min IS NULL`).get()
    );

/*    
    for(const row of zeroMins)
    {     
        deleteHandle.run(row.tx);
        console.log(`deleted ${row.tx}`);
    }
*/  



/*
    for(const row of bids)
    {
        // for bids, we can get the bid id by 
        const receipt = await provider.getTransactionReceipt(row.tx_hash);
        const bidId = BigInt(getTopic1FromReceipt(receipt));

        let actualTopic3 = row.topic3;

        if(!row.topic3)
        {
            actualTopic3 = getTopic3FromReceipt(receipt)
            console.log(`topic3 gotten: ${actualTopic3}`);
        }

        //console.log(`BidID: ${bidId}\t txHash: ${row.tx_hash}`);
        
        insertHandle.run(
            actualTopic3,   // handle
            null,            // min
            null,            // max
            null,         // alg_min
            null,         // alg_max
            0,            // known
            '[]',         // linked_handles
            "BID",         // label_prefix
            `${bidId}`,         // label_id
            row.tx_hash,       // tx
            '[]',         // linked_addresses
            row.block_number             // block
        );

        

        //console.log(`bidId ${bidId} \nrow.topic3 ${row.topic3}`);
        //updateLabelId.run(`${bidId}`, row.topic3);

        updated++;
        if(updated % 50 == 0)
        {
            console.log(`Running... (${updated} updated)`);
        }
    }
    */


    wrapsSliced = wraps.slice(1900,);

   for(const row of wrapsSliced)
   {
        // for bids, we can get the bid id by 
        const receipt = await provider.getTransactionReceipt(row.tx_hash);
        const wrapId = row.tx_hash.slice(2,34);

        let actualTopic3 = row.topic3;

        if(!row.topic3)
        {
            actualTopic3 = getTopic3FromReceipt(receipt)
            console.log(`topic3 gotten: ${actualTopic3}`);
        }

        // lets see if this exists in the table already!
        const {n} = db.prepare(`SELECT COUNT(*) AS n FROM handles WHERE handle = ? AND label_prefix != 'WRAP'`).get(`${actualTopic3}`);
        if(n != 0)
        {
            console.log(`n: ${n}`);
            console.log(`Need to update table! ${actualTopic3} duplicated!`)

        }

        // since this is WRAP we can know exactly what is val is
        const wrappedAmount = BigInt(getWrappedAmount(receipt));

        insertHandle.run(
            actualTopic3,   // handle
            `${wrappedAmount}`,            // min
            `${wrappedAmount}`,            // max
            `${wrappedAmount}`,         // alg_min
            `${wrappedAmount}`,         // alg_max
            1,            // known
            '[]',         // linked_handles
            "WRAP",         // label_prefix
            `${wrapId}`,         // label_id
            row.tx_hash,       // tx
            '[]',         // linked_addresses
            row.block_number             // block
        );
   }
   
    

    // TODO: consider implementing try/finally with a while in the try
    await db.close();
    console.log("closed db");

    console.log(`updated: ${updated}`);
}

/**
 * @dev Function to get "bidID" from a given transaction receipt. Needs to be specifically a "bid submitted" event emission
 * @param {Object} receipt - Transaction receipt
 * @param {string} eventSignature - e.g. "Transfer(address,address,uint256)"
 * @returns {string|null} topic[1] as hex string or null
 */
function getTopic1FromReceipt(receipt) {
    if (!receipt?.logs) return null;
  
    const bidSubmittedTopic = "0x5986d4da84b4e4719683f1ba6994a5bac9ff76c75db61b1a949e5b7d3424e892";  //"bidSubmitted" event
  
    for (const log of receipt.logs) {
      if (log.topics && log.topics[0] === bidSubmittedTopic) {
        return ("0x" + log.topics[1].slice(-6)) ?? null;  //We can use 6 chars for now because i don't think the number of bids exceeded the max val there
      }
    }
  
    return null;
}

function getTopic3FromReceipt(receipt) {
    if (!receipt?.logs) return null;
  
    const confidentialTransferTopic = "0x67500e8d0ed826d2194f514dd0d8124f35648ab6e3fb5e6ed867134cffe661e9";  //"bidSubmitted" event
  
    for (const log of receipt.logs) {
      if (log.topics && log.topics[0] === confidentialTransferTopic) {
        return ("0x" + log.topics[3]) ?? null;  //We can use 6 chars for now because i don't think the number of bids exceeded the max val there
      }
    }
  
    return null;
}

function getWrappedAmount(receipt) {
    if(!receipt?.logs) return null;

    // codes for transfer from a regular ERC-20
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

    for (const log of receipt.logs) {
        if (log.topics && log.topics[0] === transferTopic) {
          return (log.data) ?? null;  //We can use 6 chars for now because i don't think the number of bids exceeded the max val there
        }
      }
    
      return null;
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });