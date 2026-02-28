const hre = require("hardhat");
const Database = require("better-sqlite3");
const fs = require("fs/promises");

const { labelFromFuncSig } = require("./lib/cUSDT-labels");


/*
const startBlock = 24480501;    //This is the block where the example transaction is
const finalBlock = 24490000;
*/

const CHECKPOINT_FILENAME = "cUSDT_checkpoint.txt";
const NUM_ITEMS_FILENAME = "cUSDT_numItems.txt";

const cUSDTDeploymentBlock = 24096698;
const startBlock = 24125000;
const finalBlock = 24537892;  //top block on feb 25 2026


// cUSDT was deployed in this tx: 
// https://etherscan.io/tx/0x2eeb06d478ab37699ab18bc2cd90248eaf67f3a05c9995808ca5e949b4d1f606
//  block 24096698

const sendersByRecipient = {};

async function loadCheckpoint() {
  try {
    const text = await fs.readFile(CHECKPOINT_FILENAME, "utf8");
    console.log("reading the file");
    const parsedVal = parseInt(text, 10) + 1;
    return parsedVal;
  } catch (err) {
    // If first run and file doesn't exist, start from startBlock
    if (err.code === "ENOENT") {
      return startBlock;
    }
    throw err;
  }
}

async function loadNumItems() {
  try {
    const text = await fs.readFile(NUM_ITEMS_FILENAME, "utf8");
    console.log("reading the file");
    const parsedVal = parseInt(text, 10) + 1; //add 1 because the last recorded block is the one recorded
    return parsedVal;
  } catch (err) {
    // If first run and file doesn't exist, start from startBlock
    if (err.code === "ENOENT") {
      return startBlock;
    }
    throw err;
  }
}



async function main() {
  const checkpoint = await loadCheckpoint();
  const numItems = await loadNumItems();
  await addTransactions(checkpoint,numItems);
}

async function addTransactions(startingBlock,numItems) {  
    const db = new Database("events.db");

    // TODO what does `removed` mean? its a feature of the logs - maybe re-orgs?
    // TODO: is it a good idea to shrink primary keys to just be `tx_hash` and `log_index`?
    db.exec(`
        PRAGMA journal_mode = WAL;
      
        CREATE TABLE IF NOT EXISTS contract_logs (
          chain_id INTEGER NOT NULL,
          address TEXT NOT NULL,
          block_number INTEGER NOT NULL,
          block_hash TEXT NOT NULL,
          tx_hash TEXT NOT NULL,
          tx_index INTEGER NOT NULL,
          log_index INTEGER NOT NULL,
          topic0 TEXT NOT NULL,
          topics_json TEXT NOT NULL,
          data TEXT NOT NULL,
          removed INTEGER NOT NULL, 
          func_sig TEXT,
          label TEXT,
          PRIMARY KEY (chain_id, block_number, tx_hash, log_index)
        );
      `);
    
      const insertLog = db.prepare(`
        INSERT OR IGNORE INTO contract_logs (
          chain_id, address, block_number, block_hash,
          tx_hash, tx_index, log_index,
          topic0, topics_json, data, removed, func_sig,
          label
        ) VALUES (
          @chain_id, @address, @block_number, @block_hash,
          @tx_hash, @tx_index, @log_index,
          @topic0, @topics_json, @data, @removed, @func_sig,
          @label
        )
      `);

    const provider = hre.ethers.provider; 

    let currentItems = numItems;
    let currentBlock = startingBlock;

    console.log("Got here");
    
    console.log(`currentBlock: ${currentBlock} --- finalBlock: ${finalBlock} --- difference: ${finalBlock - currentBlock}`);


    try 
    {
      while(currentBlock < finalBlock && !shuttingDown)
      {
        console.log(`scanning blocks ${currentBlock} to ${currentBlock + 5}`);

        // here's a good transaction: https://etherscan.io/tx/0x8034620e07155d0206c0c368681fad1e3d3567c140b1ac6a7dfd769ed84878a7#eventlog
          // this is in block 24480551, its an unwrap tx
        // also examples in: 24480532, 24482033, 24483005
        const logs = await provider.getLogs({
            address: "0xAe0207C757Aa2B4019Ad96edD0092ddc63EF0c50",
            fromBlock: currentBlock,
            toBlock: currentBlock + 9,
            topics: ["0x67500e8d0ed826d2194f514dd0d8124f35648ab6e3fb5e6ed867134cffe661e9"], // This is the sig for "confidentialTransfer" - TODO: check for other logs that aren't this
          });

        for (const log of logs) {
          console.log(`txHash: ${log.transactionHash}`);
          currentItems++;
        }


        const insertLogsTx = db.transaction((rows) => {
            for (const row of rows) insertLog.run(row);
          });

        // TODO: Log the transaction signature to understand what action is being taken (wrap, unwrap, transfer, etc)
          // TODO: How do we handle internal transactions here? What if someone wraps/unwraps via a contract, such that the original call isn't one of our expected function signautres


        // TODO: for each of the different types of transaction, create a rule on how the balance is affected
          // ???? Do we want to do this in a separate file actually?
          



        const { chainId } = await provider.getNetwork();

        // TODO: understand why this is down here while the insertLogsTx thing is up there
        const rows = await Promise.all(
          logs.map(async (log) => {
            const tx = await provider.getTransaction(log.transactionHash);
            const funcSig = tx?.data?.slice(0,10) || null;
            const label = labelFromFuncSig(funcSig);

            return {
              chain_id: Number(chainId),
              address: log.address.toLowerCase(),
              block_number: Number(log.blockNumber),
              block_hash: log.blockHash,
              tx_hash: log.transactionHash.toLowerCase(),
              tx_index: Number(log.transactionIndex),
              log_index: Number(log.index), 
              topic0: (log.topics?.[0] || "").toLowerCase(),
              topics_json: JSON.stringify(log.topics || []),
              data: log.data, //TODO: I don't think this field is anything, consider removing it
              removed: log.removed ? 1 : 0,
              func_sig: funcSig,
              label: label,
            };
          })
        );

        insertLogsTx(rows);

        //records last block scanned so +9
          // TODO updating this to run faster - change it back later
        await fs.writeFile(CHECKPOINT_FILENAME, (currentBlock+5).toString(), (err) => { 
          if (err) throw err;
        })

        await fs.writeFile(NUM_ITEMS_FILENAME, currentItems.toString(), (err) => {
          if(err) throw err;
        })

        currentBlock += 10;

        await sleep(0); //add a crude sleep function to prevent alchemy api from timing out
                            // this isn't needed until it starts timing out around the auction time
      }

    }
    finally {
      await db.close();
      console.log("closed db");

      console.log(`checkpoint block = ${currentBlock+9}`);
      console.log(`count of db items = ${currentItems}`);
      console.log(`\nPress CTRL+C`);  //TODO idk why this needs to be pressed again
    }
}


// Handle shutdown
let shuttingDown = false;

process.on("SIGINT", async () => {
  console.log("\nGracefully shutting down...");
  shuttingDown = true;
});

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });