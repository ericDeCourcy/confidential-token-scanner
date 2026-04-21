// TODO incorporate this directly into the main scanner

// this file finds all "redeem-delegations" transactions in the .db, and determines what they "actually" were
// we use event detection to do this. For example events like "BidSubmitted" or "TokenRefunded"
    // because an ERC7702 transaction can include batches, we need to be extra careful and scan for all instances of all events
    // likely to be only 1 tho lol
        // perhaps this can be confirmed by looking at calldata (see how many independent transactions are happening)
// Then we can add a separate row for "redeem-delegation"s to the db, 
const Database = require("better-sqlite3");
const fs = require("fs/promises");
const path = require("path");
const { labelFromFuncSig } = require("./lib/funcSig-labels"); 
const hre = require("hardhat");


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

    // get all instances of redeem delegation
    const redeemDelegations = db.prepare(`
        SELECT topic3, tx_hash, block_number
        FROM contract_logs
        WHERE label = ?
      `).all('REDEEM_DELEGATIONS');

    
    

    let flaggedForRow = false;

    for(const row of redeemDelegations)
    {
        const receipt = await provider.getTransactionReceipt(row.tx_hash);
        //console.log(`\n\nTX: ${row.tx_hash}\n\n ${JSON.stringify(receipt.logs,null,2)}`);

        flaggedForRow = false;
        let newLabel;

        for(const log of receipt.logs)
        {
//            console.log(`log: ${log.topics}`);
            for(let i =0; i < log.topics.length; i++)
            {
                const topic = log.topics[i];
                //console.log(`${topic}`);

                switch(topic.toUpperCase())
                {
                    case "0x2d4edf3c2943002120f53dab3f8940043f34799f4a92ab90f2f81f7dd004a49e".toUpperCase():
                        
                        console.log(`FINALIZE_UNWRAP: ${row.tx_hash}`);
                        newLabel = `FINALIZE_UNWRAP`;

                        if(flaggedForRow) {
                            console.error(`found two events in one transaction, unhandled case`);
                            process.exit(1);
                        } else {  flaggedForRow = true; }
                        break;
                    case "0x77d02d353c5629272875d11f1b34ec4c65d7430b075575b78cd2502034c469ee".toUpperCase():
                        console.log(`UNWRAP: ${row.tx_hash}`);
                        newLabel = `UNWRAP` //TODO unwrap or unwrap w proof??

                        if(log.topics.includes("0xdc370db33589e73371dc3ee42c789c003d336eefcb7c3f56fe0f51ae5b1d9702"))
                        {
                            newLabel = "UNWRAP_W_PROOF";
                        }
                        else
                        {
                            newLabel = "UNWRAP";
                        }
                        
                        if(flaggedForRow) {
                            console.error(`found two events in one transaction, unhandled case`);
                            process.exit(1);
                        } else {  flaggedForRow = true; }
                        break;
                    case "0xbd8de31a25c2b7c2ddafffe72dab91b4ce5826cfd5664793eb206f572f732c27".toUpperCase():
                        console.log(`CANCEL_BID: ${row.tx_hash}`);
                        newLabel = `CANCEL_BID`;
                        
                        if(flaggedForRow) {
                            console.error(`found two events in one transaction, unhandled case`);
                            process.exit(1);
                        } else {  flaggedForRow = true; }
                        break;
                    case "0x5986d4da84b4e4719683f1ba6994a5bac9ff76c75db61b1a949e5b7d3424e892".toUpperCase():
                        console.log(`BID_W_PROOF: ${row.tx_hash}`);  
                        newLabel = `BID_W_PROOF`;

                        if(flaggedForRow) {
                            console.error(`found two events in one transaction, unhandled case`);
                            process.exit(1);
                        } else {  flaggedForRow = true; }
                        break;
                    case "0x8e79a06e8fa190d30622f1bd34864445aecf3656a9469472e05a204eadc2f4fe".toUpperCase():
                        console.log(`REFUND_USER: ${row.tx_hash}`);

                        // TODO This is a weird one, we can skip it for now
                        // do NOT set the newLabel to anything

                        // check if the funcsig for REFUND_USER (0x72b38ab9) or FINALIZE_REFUND (0x6db28804) is in there.
                        const tx = await provider.getTransaction(row.tx_hash);
                        if(tx.data.includes("72b38ab9"))
                        {
                            console.log("found REFUND USER")
                            newLabel = `REFUND_USER`;
                        }
                        else if(tx.data.includes("6db28804"))
                        {
                            console.log("found FINALIZE REFUND");
                            newLabel = `FINALIZE_REFUND`;
                        }

                        if(flaggedForRow) {
                            console.error(`found two events in one transaction, unhandled case`);
                            process.exit(1);
                        } else {  flaggedForRow = true; }
                        break;                    
                    case "0x67500e8d0ed826d2194f514dd0d8124f35648ab6e3fb5e6ed867134cffe661e9".toUpperCase():    //this is the signature for transfer, all have one instance of this
                        // we need to get the "from" to see if its a wrap
                        if(log.topics[i+1] == "0x0000000000000000000000000000000000000000000000000000000000000000") //if the "from" is `0x00` for a transfer, its a mint
                        {
                            console.log(`WRAP: ${row.tx_hash}`);
                            newLabel = `WRAP`;
                            flaggedForRow = true;
                        }
                        break;
                    case "0x63f3c1dfe868c93b4c1f789017d37f86d91f0df374cd4f16155c54dba820cb20".toUpperCase():
                        console.log(`ZAMA_TOKEN_DIST: ${row.tx_hash}`); 

                        // leaving this one blank for now 
                        newLabel = "";

                        flaggedForRow = true;
                        break;
                }
                // 0x2d4edf3c2943002120f53dab3f8940043f34799f4a92ab90f2f81f7dd004a49e unwrapFinalized
                // 0x77d02d353c5629272875d11f1b34ec4c65d7430b075575b78cd2502034c469ee unwrapRequested
                //                                                                    there is no specific event for wrap, but you can look for transfers in from the associated token
                // 0xbd8de31a25c2b7c2ddafffe72dab91b4ce5826cfd5664793eb206f572f732c27 bidCancelled
                // 0x5986d4da84b4e4719683f1ba6994a5bac9ff76c75db61b1a949e5b7d3424e892 bidSubmitted
                // 0x8e79a06e8fa190d30622f1bd34864445aecf3656a9469472e05a204eadc2f4fe tokenRefunded
            }
        }
        if(!flaggedForRow)
        {
            console.log(`nothing found: ${row.tx_hash}`);
        }
        else
        {
            if(newLabel != "")
            {
                console.log("got here");
                
              db.prepare(`
                    UPDATE contract_logs
                    SET ERC7702 = ?
                    WHERE tx_hash = ?
                `).run("TRUE", row.tx_hash);

                db.prepare(`
                    UPDATE contract_logs
                    SET label = ?
                    WHERE tx_hash = ?
                `).run(newLabel, row.tx_hash);
    

                // TODO: probably need to consider if other columns should be changed to, topics will be a bit messed up maybe??
            }
        }
        newLabel = "";
    }
    
    await db.close();
    console.log("closed db");

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });