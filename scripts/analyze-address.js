/**
 * Builds off of `find-address.js` - this will step by step break down what occurred at each point in an address's history
 *
 * Usage:
 *   node analyze-address.js 0x1234....abcd
 *
 *
 * Notes:
 * - Indexed address topics in logs are encoded as 32 bytes:
 *   0x000000000000000000000000 + <20-byte address>
 * - This script normalizes your input into that 32-byte topic form and compares.
 */

const hre = require("hardhat");
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

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: node find-address.js <0xAddress>");
    process.exit(1);
  }

  const provider = hre.ethers.provider; 
  const {chainId} = await provider.getNetwork();
  if(chainId != 1)
  {
    console.error(`Wrong network - configure hre default network to ethereum`);
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

    console.log("\nADDRESS ACTIONS:\n")

    analyzeActions(out, db, targetTopic);

  } finally {
    db.close();
  }
}

async function analyzeActions(txs, db, targetTopic)
{
    const provider = hre.ethers.provider; 

    let rangeHigh =0n;
    let rangeLow =0n;
    let bidPrice =0n; //TODO change this to array, possibly with block numbers too 
    let maxRefund =0n;
    let rangeHighBeforeRefund=0n; //TODO implement this better
      // We can imagine range high, after bidding, as "actual balance range high + committedBid"
      // This stores the total when a bid is placed, and then when the bid is released, we know we don't have to increase range high
    let lowBidsMax = 0n; // these are the amounts possible for bids that are either "low" (below 50000), at 50k, or above 50k, as those bids fill or don't
    let targetBidsMax = 0n; 
    let highBidsMax = 0n;
    const scannedAddress = "0x" + targetTopic.slice(-40);
    console.log(`THIS IS THE ADDRESS: ${scannedAddress}`);



    let refundString = "";
    let actionString = "";

    //for all hashes
    for (const tx of txs) 
    {

      const [blockStr, txHashStr, labelStr] = tx.split(":").map(s => s.trim());

      const blockNumber = Number(blockStr);
      const txHash = txHashStr;
      const label = labelStr;

      actionString = "";

      switch(label){
        case "wrap":
        {

          // case wrap
          //    pull tx hash from alchemy - second input parameter is wrapped amount (6 decimals)
          //    double-check the "to" address, throw if it isn't this address
          //    Add exact amount to balance range either end

          const thisTx = await provider.getTransaction(txHash);
          const value = BigInt("0x" + thisTx.data.slice(-64));
          //console.log(`value = ${value}`);

          rangeHigh += value;
          rangeLow += value;

          break;
        }

        case "bid_w_proof":
        {
          // case bid w proof
          //    pull tx hash from alchemy, record bid price based on input
          //      bid price is first parameter
          //    Note if above or below clearing price of 0.05 USD
          //      if above clearing price, bid hits
          //      if below, bid doesn't hit
          //      if at, idk need to check the contract for behavior, i think its pro rata

          
          const thisTx = await provider.getTransaction(txHash);
          bidPrice = BigInt("0x" + thisTx.data.slice(10,74));

          if(bidPrice > 50000)
          {
            console.log("🚨 Bid above settlement price! - This case has not yet been accounted for! 🚨");
            // right now, if bidding under the settlement price then we can just assume they never recieved tokens for their bid, and the refund will be the full amount
            actionString = ` ⬆️ HIGH BID AT ${bidPrice}`;

            const highBidsMaxNumber = rangeHigh % bidPrice; //max number of high bids at price x
            highBidsMax += highBidsMaxNumber*bidPrice;

            // TODO implement a checker for zama token transfers from the auction

          }
          else if(bidPrice == 50000)
          {
            actionString = ` 🎯  TARGET BID AT ${bidPrice}`;

            const targetBidsMaxNumber = rangeHigh % bidPrice; //max number of high bids at price x
            targetBidsMax += lowBidsMaxNumber*bidPrice;
          }
          else
          {
            actionString = ` ⬇️  LOW BID AT ${bidPrice}`;

            const lowBidsMaxNumber = rangeHigh % bidPrice; //max number of high bids at price x
            lowBidsMax += lowBidsMaxNumber*bidPrice;
          }

          // decrease rangeLow down to the modulo of this value vs rangeHigh
          const newRangeLow = rangeHigh % bidPrice;
          maxRefund = rangeHigh - newRangeLow;
          rangeHighBeforeRefund = rangeHigh;
          

          rangeLow = newRangeLow; //TODO is the temp value even necessary here?


          break;
        }

        case "unwrap":
        {
          //for unwrap
          //  to detect unwrap of whole balance
          //  get event logs
          //  if first event is FHEGe and the first two topics are the same, then that means they're unwrapping their whole balance
          //    This should have more confirmation but for now its fine

          const receipt = await provider.getTransactionReceipt(txHash);

          //console.log(`tx reciept logs: ${JSON.stringify(receipt.logs[0], null, 2)}`)
          //console.log(`${receipt.logs[0].topics[0]}`);
          if(receipt.logs[0].topics[0] = "0x38c3a63c4230de5b741f494ffb54e3087104030279bc7bccee8ad9ad31712b21")
          {
            //if first log is a FHE-GE
            // then get the data, compare first and second 32 bytes
            const logData = receipt.logs[0].data;
            const lhs = logData.slice(2,66);
            const rhs = logData.slice(66,130);

            //console.log(`lhs: ${lhs}`);
            //console.log(`rhs: ${rhs}`);

            if(lhs == rhs)
            {
              actionString = "\t✅ TOTAL BALANCE UNWRAPPED";
              rangeLow = 0n;
              rangeHigh = 0n;
            }
          }

          break;
        }

        

        case "aggregate_multicall":
        {
          // check if there is chunk of the txdata that has your address and "0x72b38ab9" 

          // first get the tx data
          const tx = await provider.getTransaction(txHash);

          // look for this string: 72b38ab9000000000000000000000000 + <address>
          const stringToSearch = `72b38ab9000000000000000000000000${targetTopic.slice(-40)}`;
          const found = JSON.stringify(tx.data).includes(stringToSearch);

    
          // shouldn't happen - but in case it do
          if(!found)
          {
            // TODO: upgrade this to account for weird possibility same address is used in multicall and its unaccounted for
              // basically, detect if found or detect if address is found

            console.log("🚨 MULTICALL - refund call not found for address! 🚨");
            break;
          }
        }

        case "refund_user":
        {
          //TODO: in this flow its pretty common that the bid is refunded 
          //increase range high by max refund
          //rangeHigh += maxRefund;

          rangeHigh = rangeHighBeforeRefund;
          rangeHighBeforeRefund = 0n;

          // reset maxRefund
          maxRefund = 0n;
          console.log("got to refund user");
          break;
        }

        default: { console.log("🚨 UNKNOWN ACTION - this func sig has not yet been accounted for! 🚨"); }
      }




      if(maxRefund != 0)
      {
        refundString = `\tBids = {0,${maxRefund}}`;
        // TODO improve these so its clear what prices the bids are at
      }
      else
      {   //This is empty when there is no bid awaiting fill/refunding
        refundString = "";
      }

      if(rangeHigh == rangeLow)
      {
        console.log(`${blockNumber}:${label.toUpperCase()}${actionString}\n\tBalance = {${rangeLow}}${refundString}`);
      }
      else
      {
        console.log(`${blockNumber}:${label.toUpperCase()}${actionString}\n\tBalance = {${rangeLow}, ${rangeHigh}}${refundString}`);

      }
  
     
      //    Does not change balance range
      //  case unwrap
      //    TODO if its possible, compare passed in handle and the handle of the user balance. Likely to be same
    }

    // TODO: is it possible to fork ethereum at that very moment and check the handle which stores user balance
}

main();