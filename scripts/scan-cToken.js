const hre = require("hardhat");
const Database = require("better-sqlite3");
const fs = require("fs/promises");
const path = require("path");


const { labelFromFuncSig } = require("./lib/cUSDC-labels"); //TODO make these labels

const finalBlock = 24537892;  //top block on feb 25 2026 - default block for this project
// TODO consider using: 24700000; - easier to check if done - march 20 2026 - https://etherscan.io/block/24700000


function getDeploymentBlock(token)
{
  switch(token) {
    case "cBRON":
      return 24096700;
    case "ctGBP":
      return 24117438;
    case "cUSDC":
      return 24096697;
    case "cUSDT":
      return 24096698;
    case "cWETH":
      return 24096699;
    case "cZAMA":
      return 24096701;
    default:
      throw new Error(`cToken not found: ${token}`);
  }
}

async function loadCheckpoint(checkpointFilename, token) {
  try {
    const text = await fs.readFile(checkpointFilename, "utf8");
    console.log("reading the file");
    const parsedVal = parseInt(text, 10);
    return parsedVal;
  } catch (err) {
    // If first run and file doesn't exist, start from startBlock (token deployment)
    if (err.code === "ENOENT") {
      return getDeploymentBlock(token);
    }
    throw err;
  }
}

// TODO: get rid of numItems
async function loadNumItems(numItemsFilename) {
  try {
    const text = await fs.readFile(numItemsFilename, "utf8");
    console.log("reading the file");
    const parsedVal = parseInt(text, 10); 
    return parsedVal;
  } catch (err) {
    // TODO: this is copied from loadCheckpoint, do we even need to return 0 here?
    if (err.code === "ENOENT") {
      return 0;
    }
    throw err;
  }
}

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1 || index + 1 >= process.argv.length) {
    return null;
  }
  return process.argv[index + 1];
}

// TODO: should we also return the deployment block number here?
function getAddressFromToken(token) {
  switch(token) {
    case "cBRON":
      return "0x85dE671c3bec1aDeD752c3Cea943521181C826bc";
    case "ctGBP":
      return "0xa873750ccbafd5ec7dd13bfd5237d7129832edd9";
    case "cUSDC":
      return "0xe978F22157048E5DB8E5d07971376e86671672B2";
    case "cUSDT":
      return "0xAe0207C757Aa2B4019Ad96edD0092ddc63EF0c50";
    case "cWETH":
      return "0xda9396b82634Ea99243cE51258B6A5Ae512D4893";
    case "cZAMA":
      return "0x80cb147fd86dc6dee3eee7e4cee33d1397d98071";
    default:
      throw new Error(`cToken not found: ${token}`);
  }
}
// TODO: make sure that each of the loads and writes is to a filename thats correct for this token
// TODO: implement a lookup table where given a token name, it will find the corresponding address and use it
// TODO: we will also need block numbers for each of the cTokens
// TODO: we will also need a "final" block number

async function main() {
  const token = getArg("--token");
  let sleepRate = getArg("--sleep");
  if(sleepRate == null)
  {
    sleepRate = 0;
  }

  let endBlock = getArg("--endBlock");
  if(endBlock == null || endBlock == 0)
  {
    endBlock = finalBlock;
  }

  
  const tokenAddress = getAddressFromToken(token);
  let checkpoint = await loadCheckpoint(path.join(__dirname, "checkpoints", `${token}_checkpoint.txt`), token);
  const numItems = await loadNumItems(path.join(__dirname, "checkpoints", `${token}_numItems.txt`));

  let startBlock = getArg("--startBlock");
  if(startBlock != null)
  {
    checkpoint = startBlock;
  }


  await addTransactions(checkpoint,endBlock,numItems,token,tokenAddress,sleepRate);
}


async function addTransactions(startingBlock,endBlock,numItems,token,tokenAddress,sleepRate) {  
    const db = new Database(`${token}_events.db`);

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
          topic1 TEXT,
          topic2 TEXT,
          topic3 TEXT,
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
          topic0, topic1, topic2, topic3,
          topics_json, data, removed, func_sig,
          label
        ) VALUES (
          @chain_id, @address, @block_number, @block_hash,
          @tx_hash, @tx_index, @log_index,
          @topic0, @topic1, @topic2, @topic3,
          @topics_json, @data, @removed, @func_sig,
          @label
        )
      `);

    const provider = hre.ethers.provider; 

    let currentItems = numItems;
    let currentBlock = Number(startingBlock);
    
    console.log(`currentBlock: ${currentBlock} --- finalBlock: ${endBlock} --- difference: ${endBlock - currentBlock}`);

    sleep(1500);

    try 
    {
      while(currentBlock < endBlock && !shuttingDown)
      {
        console.log(`scanning blocks ${currentBlock} to ${currentBlock + 9}`);

        // here's a good transaction: https://etherscan.io/tx/0x8034620e07155d0206c0c368681fad1e3d3567c140b1ac6a7dfd769ed84878a7#eventlog
          // this is in block 24480551, its an unwrap tx
        // also examples in: 24480532, 24482033, 24483005
        const logs = await provider.getLogs({
            address: tokenAddress,
            fromBlock: currentBlock,
            toBlock: currentBlock + 9,
            topics: ["0x67500e8d0ed826d2194f514dd0d8124f35648ab6e3fb5e6ed867134cffe661e9"], // This is the sig for "confidentialTransfer" - TODO: check for other logs that aren't this
              // TODO: we need to check for finalizeUnwrap transactions as well - these are sort of covered by "unwrap" calls already
          });

        for (const log of logs) {
          console.log(`txHash: ${log.transactionHash}`);
          currentItems++;
        }


        const insertLogsTx = db.transaction((rows) => {
            for (const row of rows) insertLog.run(row);
          });

        // TODO: How do we handle internal transactions here? What if someone wraps/unwraps via a contract, such that the original call isn't one of our expected function signautres
    
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
              topic1: (log.topics?.[1] || "").toLowerCase(),
              topic2: (log.topics?.[2] || "").toLowerCase(),
              topic3: (log.topics?.[3] || "").toLowerCase(),
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
        await fs.writeFile(path.join(__dirname, "checkpoints", `${token}_checkpoint.txt`), (currentBlock+9).toString(), (err) => { 
          if (err) throw err;
        })

        await fs.writeFile(path.join(__dirname, "checkpoints", `${token}_numItems.txt`), currentItems.toString(), (err) => {
          if(err) throw err;
        })

        // Increment block by 10 to do the next round 
        currentBlock += 10;

        await sleep(sleepRate); //add a crude sleep function to prevent alchemy api from timing out
        //@dev this is very handy when your scanner hits the auction and reveal - lots of activity on those days.
        //    I used 3000 to fight rate-limiting from alchemy
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