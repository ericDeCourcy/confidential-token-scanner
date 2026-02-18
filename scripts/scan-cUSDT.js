const hre = require("hardhat");
const Database = require("better-sqlite3");



//const fs = require('fs');

const startBlock = 24480551;    //This is the block where the example transaction is

// cUSDT was deployed in this tx: 
// https://etherscan.io/tx/0x2eeb06d478ab37699ab18bc2cd90248eaf67f3a05c9995808ca5e949b4d1f606
//  block 24096698

const sendersByRecipient = {};


async function main() {
    const db = new Database("events.db");

    // TODO what does `removed` do?
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
          PRIMARY KEY (chain_id, block_number, tx_hash, log_index)
        );
      `);
    
      const insertLog = db.prepare(`
        INSERT OR IGNORE INTO contract_logs (
          chain_id, address, block_number, block_hash,
          tx_hash, tx_index, log_index,
          topic0, topics_json, data, removed
        ) VALUES (
          @chain_id, @address, @block_number, @block_hash,
          @tx_hash, @tx_index, @log_index,
          @topic0, @topics_json, @data, @removed
        )
      `);

    const provider = hre.ethers.provider; 


    // here's a good transaction: https://etherscan.io/tx/0x8034620e07155d0206c0c368681fad1e3d3567c140b1ac6a7dfd769ed84878a7#eventlog
    const logs = await provider.getLogs({
        address: "0xAe0207C757Aa2B4019Ad96edD0092ddc63EF0c50",
        fromBlock: startBlock,
        toBlock: startBlock + 9,
        topics: ["0x67500e8d0ed826d2194f514dd0d8124f35648ab6e3fb5e6ed867134cffe661e9"], //TODO add logs for unwrap, wrap, anything else which affects token balances
      });

    for (const log of logs)
            console.log(`txHash: ${log.transactionHash}`);


    const insertLogsTx = db.transaction((rows) => {
        for (const row of rows) insertLog.run(row);
      });

      



    const { chainId } = await provider.getNetwork();

    const rows = logs.map((log) => ({
        chain_id: Number(chainId),
        address: log.address.toLowerCase(),
        block_number: Number(log.blockNumber),
        block_hash: log.blockHash,
        tx_hash: log.transactionHash.toLowerCase(),
        tx_index: Number(log.transactionIndex),
        log_index: Number(log.index), // ethers v6; if undefined, use log.logIndex
        topic0: (log.topics?.[0] || "").toLowerCase(),
        topics_json: JSON.stringify(log.topics || []),
        data: log.data,
        removed: log.removed ? 1 : 0,
    }));

    insertLogsTx(rows);





    db.close();
}





main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });