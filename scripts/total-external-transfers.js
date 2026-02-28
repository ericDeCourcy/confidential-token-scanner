// this script exists to tally the number of contracts which only interact with a few contracts like the auction and the multisenders, and zero address for mints and burns.
//  It will tally addresses with transfers outside of the norm, and it will tally addresses which have been transferred to a lot.

const Database = require("better-sqlite3");

// 1. tally addresses with transfers both "totally safe" and outside the norm
let safeOnlyTotal = 0;
let externalTransferTotal = 0;
let unknownTotal = 0;

async function main() {

    const input = process.argv[2];
    if (!input) {
      console.error("Usage: node total-external-transfers.js <0xAddress>");
      process.exit(1);
    }
    
    // open db
    const db = new Database("events.db", { readonly: true });

    try {
    // topic1 and topic2 are sender and receiver
    const stmt = db.prepare(`
        SELECT topic1, topic2   
        FROM contract_logs
        WHERE topic1 LIKE ?
           OR topic2 LIKE ?
      `);
      
    const term = "0x000000000000000000000000"+input.slice(-40);
    console.log(`term ${term}`);
    
    const rows = await stmt.iterate(term, term);

    const countsOfExternal = new Map();

    function add(item) {
      countsOfExternal.set(item, (countsOfExternal.get(item) || 0) + 1);
    }

    console.log("starting");

    for(const row of rows) {
        if(row.topic1 == "0x000000000000000000000000"+input.slice(-40))
        {
            console.log("abc");
            if
            ( 
                row.topic2 == "0x0000000000000000000000000000000000000000000000000000000000000000" //minter
                || row.topic2 == "0x00000000000000000000000004a5b8C32f9c38092B008A4939f1F91D550C4345" //auction address
            )
            {
                safeOnlyTotal++;
                console.log(`safeOnlyTotal ${safeOnlyTotal}`);
            }
            else
            {   
                add(row.topic2);
                externalTransferTotal++;
                console.log(`externalTransferTotal ${externalTransferTotal}`);
            }
        }
        else if(row.topic2 == "0x000000000000000000000000"+input.slice(-40))
        {
            console.log("def");

            if
            ( 
                row.topic1 == "0x0000000000000000000000000000000000000000000000000000000000000000" //minter
                || row.topic1 == "0x00000000000000000000000004a5b8C32f9c38092B008A4939f1F91D550C4345" //auction address
            )
            {
                safeOnlyTotal++;
                console.log(`safeOnlyTotal ${safeOnlyTotal}`);
            }
            else
            {   
                add(row.topic2);

                externalTransferTotal++;
                console.log(`externalTransferTotal ${externalTransferTotal}`);

            }
        }
        else
        {
            console.log("xyz");

            unknownTotal++;
            console.log(`unknownTotal ${unknownTotal}`)
        }

    }


    } 


     
    finally {

        db.close();
    } 

    console.log(`${safeOnlyTotal} ${externalTransferTotal}`);

}

main();