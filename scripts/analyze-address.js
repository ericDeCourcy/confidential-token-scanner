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

const claimingPhaseBlock = 24369034;  //This is the block where we entered the claiming phase. After this block, we can do refunds. 
  // TODO: we may need to check that there aren't more bid submissions right before this or something. Like, within the same block


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

    const bids = new Map;

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

    let rangeHighDecimals = 0;
    let rangeLowDecimals = 0;


    let actionString = "";
    let bidString = "";
    let rangeHighString = "";
    let lastActionBlock = 0;

    //for all hashes
    for (const tx of txs) 
    {

      const [blockStr, txHashStr, labelStr] = tx.split(":").map(s => s.trim());

      const blockNumber = Number(blockStr);
      const txHash = txHashStr;
      let label = labelStr;

      actionString = "";

      // special case to detect end of auction
      // at end of auction, delete all bids which didn't hit. Those now get "refunded"
      // TODO: Technically this isn't perfect - it will remove bids and credit the user's account back
      //  Theoretically before getting refunded, a user can send or unwrap their balance which will be lower than if they had been refunded
      if(lastActionBlock < claimingPhaseBlock && blockNumber >= claimingPhaseBlock)
      {
        console.log("24369034:AUCTION ENTERED CLAIMING PHASE");

        // Delete bids which are "under" price and revert balance back
        for (const key of bids.keys()) {
          if(bids.get(key).bidPrice < 50000)
          {
            bids.delete(key);
          }
        }
        rangeLow = setRangeLowIfBidsEmpty(rangeLow, rangeHigh, bids);

      }

      switch(label){
        case "wrap":
        {

          // case wrap
          //    pull tx hash from alchemy - second input parameter is wrapped amount (6 decimals)
          //    double-check the "to" address, throw if it isn't this address
          //    Add exact amount to balance range either end

          const thisTx = await provider.getTransaction(txHash);
          const value = BigInt("0x" + thisTx.data.slice(-64));

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
          let maxPaidForBid = 0; 

          if(bidPrice > 50000)
          {
            // right now, if bidding under the settlement price then we can just assume they never recieved tokens for their bid, and the refund will be the full amount
            actionString = ` ⬆️ HIGH BID AT ${bidPrice}`;


            const highBidsMaxNumber = rangeHigh / bidPrice; //max number of high bids at price x
            highBidsMax += highBidsMaxNumber*bidPrice;
            maxPaidForBid = highBidsMaxNumber*bidPrice;
            // TODO implement a checker for zama token transfers from the auction

          }
          else if(bidPrice == 50000)
          {
            actionString = ` 🎯  TARGET BID AT ${bidPrice}`;

            const targetBidsMaxNumber = rangeHigh / bidPrice; //max number of high bids at price x
            targetBidsMax += targetBidsMaxNumber*bidPrice;
            maxPaidForBid = targetBidsMaxNumber*bidPrice;
          }
          else
          {
            actionString = ` ⬇️  LOW BID AT ${bidPrice}`;

            const lowBidsMaxNumber = rangeHigh / bidPrice; //max number of high bids at price x
            lowBidsMax += lowBidsMaxNumber*bidPrice;
            maxPaidForBid = lowBidsMaxNumber*bidPrice;
          }

          // decrease rangeLow down to the modulo of this value vs rangeHigh
          const newRangeLow = rangeHigh % bidPrice;
          maxRefund = rangeHigh - newRangeLow;
          rangeHighBeforeRefund = rangeHigh;
          

          rangeLow = newRangeLow; //TODO is the temp value even necessary here?

          //Now lets find the bidId just to track it for cancellations/reimbursements
          // first pull up the transaction, then filter for "bid submitted" log, then get the topic of the bid id

          const receipt = await provider.getTransactionReceipt(txHash);
          const bidId = BigInt(getTopic1FromReceipt(receipt));

          bids.set(bidId, {maxPaidForBid, bidPrice});

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

          if(receipt.logs[0].topics[0] = "0x38c3a63c4230de5b741f494ffb54e3087104030279bc7bccee8ad9ad31712b21")
          {
            //if first log is a FHE-GE
            // then get the data, compare first and second 32 bytes
            const logData = receipt.logs[0].data;
            const lhs = logData.slice(2,66);
            const rhs = logData.slice(66,130);


            // if the handle being unwrapped matches the current balance handle, thats a full unwrap!
            //  otherwise, we can't be sure exactly how much was unwrapped
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
          // check if there is chunk of the txdata that has your address and "0x72b38ab9" (for refund)
          // first get the tx data
          const tx = await provider.getTransaction(txHash);

          // look for this string: 72b38ab9000000000000000000000000 + <address>
            // This is for a sub-call to "refund user"
          const stringToSearch = `72b38ab9000000000000000000000000${targetTopic.slice(-40)}`;
          const found = JSON.stringify(tx.data).includes(stringToSearch);

          label = "aggregate_multicall (refund)";
    
          // if this isn't an aggregated "refund" call, this may be an aggregated "disburse" call
          if(!found)
          {
            // TODO: affect action string to signify this is a disbursal

            const receipt = await provider.getTransactionReceipt(txHash);
            const zamaDisbursed = BigInt(getZamaDisbursedFromReceipt(receipt, scannedAddress));
            const usdtPaid = Number(zamaDisbursed / BigInt(1000000000000000000)) * 50000;
            const usdtPaidDecimals = usdtPaid / 1000000;
            actionString = `\n\tUSDT PAID TOTAL: ${usdtPaidDecimals} for ${Number(zamaDisbursed / BigInt(1000000000000000000))} ZAMA`; 
  
            //console.log(`claim tx hash ${txHash}`);
            rangeHigh -= BigInt(usdtPaid);

            // Because this is a disburse, delete all bids that are at or above target price. They are now filled
            for (const key of bids.keys()) {
              if(bids.get(key).bidPrice > 49999)
              {
                bids.delete(key);
              }
            }
            rangeLow = setRangeLowIfBidsEmpty(rangeLow, rangeHigh, bids);


            label = "aggregate_multicall (disburse)";

            break;
          }

          // NOTE: We DON'T break here, so that it continues on to the refund user branch
        }

        case "refund_user":
        {
          //TODO: in this flow its pretty common that the bid is refunded 
          //increase range high by max refund
          //rangeHigh += maxRefund;

          //rangeHigh = rangeHighBeforeRefund;
          //rangeHighBeforeRefund = 0n;

          // reset maxRefund
//          maxRefund = 0n;

          // TODO: go through and delete all bids that apply to the user

          break;
        }

        case "finalize_refund":
        {
          // TODO: does anyhting need to happen here?
          break;
        }

        case "cancel_bid":
        {
          // TODO: I think if someone cancels a bid, then we can reduce their minimimum balance to their theoretical max minus all bids


          // Find the bid id of the bid being cancelled (within tx input data)
          const thisTx = await provider.getTransaction(txHash);
          const bidId = BigInt("0x" + thisTx.data.slice(-6));  //Conveniently the last and only piece of input data
          const bidIdToDisplay = Number(bidId);

          actionString = (` (BID_${bidIdToDisplay})`);

          //If bid exists, delete it
          if(bids.get(bidId))
          {
            bids.delete(bidId);
            rangeLow = setRangeLowIfBidsEmpty(rangeLow, rangeHigh, bids);
          }
          else
          {
            // This means somehow we missed the bid placement for this address
            console.log("🚨 UH OH - Attempting to delete a bid that doesn't exist 🚨");
          }

          break;
        }

        case "finalize_unwrap":
        {
          // go and find the number of USDT tokens transferred out

          const receipt = await provider.getTransactionReceipt(txHash);
          const unwrappedAmount = BigInt(getUnwrappedAmountFromReceipt(receipt));
          const unwrappedDecimals = Number(unwrappedAmount) / 1000000;

          label = label + ` (${unwrappedDecimals} USDT)`;

          // TODO: based on bids which hit and which did not hit, we can use this to guess about an account's state

          // An unwrap should always precede this,
          //  if the unwrap is a "full" unwrap, the balance will already be zero and we can skip this
          //  otherwise, we can subtract the "not full" unwrap now
          if(rangeHigh != 0)
          {
            if(rangeHigh >= unwrappedAmount)
            {
              rangeHigh -= unwrappedAmount;
            }
            else
            {
              console.log("🚨 UH OH! Somehow we have unwrapped more than the max balance");
            }
          }
          


          // if rangeHighDecimals - unwrapped > bidSize for any bid, lower that bid size
          // TODO: this doesn't work because we reduce range in the "unwrap" phase, not "finalize unwrap". We end up with negative numbers if we use this
          /*
          for (const key of bids.keys()) {
            if(bids.get(key).maxPaidForBid > rangeHigh)
            {
              bids.get(key).maxPaidForBid = rangeHigh;
            }
          }
          */
          

          break;
        }

        case "claim":
        {
          // Just going to keep it simple, probably there is more to it here
          // delete all bids that are at or above target price
          for (const key of bids.keys()) {
            if(bids.get(key).bidPrice > 49999)
            {
              bids.delete(key);
            }
          }
          rangeLow = setRangeLowIfBidsEmpty(rangeLow, rangeHigh, bids);

          // find zama tokens which are disbursed in this TX
          const receipt = await provider.getTransactionReceipt(txHash);
          const zamaDisbursed = BigInt(getZamaDisbursedFromReceipt(receipt, scannedAddress));
          const usdtPaid = Number(zamaDisbursed / BigInt(1000000000000000000)) * 50000;
          const usdtPaidDecimals = usdtPaid / 1000000;
          actionString = `\n\tUSDT PAID TOTAL: ${usdtPaidDecimals} for ${Number(zamaDisbursed / BigInt(1000000000000000000))} ZAMA`; 

          //console.log(`claim tx hash ${txHash}`);
          rangeHigh -= BigInt(usdtPaid);
          break;
        }

        default: { console.log(`🚨 UNKNOWN ACTION - this label (${label}) has not yet been accounted for! 🚨`); }
      }

      rangeLowDecimals = Number(rangeLow) / 1000000;
      rangeHighDecimals = Number(rangeHigh) / 1000000;

      // Construct the bids string
      bidString = "";

      // construct rangeHighString beginning
      rangeHighString = `${rangeHighDecimals}`;

      if(bids.size > 0) //if bids is not zero
      {
        
        for(const [key,value] of bids)
        {
          valueDecimals = Number(value.maxPaidForBid)/1000000;
          bidString = bidString + `\tBid_${key}: {0, ${valueDecimals}}`;

          // TODO: finish updating to using "range high string" everywhere, replaces bidString and rangeHighDecimals
          rangeHighString = rangeHighString + ` - BID_${key}`;
        }
      }

      if(rangeHigh == rangeLow)
      {
        console.log(`${blockNumber}:${label.toUpperCase()}${actionString}\n\tBalance = {${rangeLowDecimals}}`+bidString);
      }
      else
      {
        //console.log(`${blockNumber}:${label.toUpperCase()}${actionString}\n\tBalance = {${rangeLowDecimals}, ${rangeHighDecimals}}`+bidString);
        console.log(`${blockNumber}:${label.toUpperCase()}${actionString}\n\tBalance = {${rangeLowDecimals}, ${rangeHighString}}`);
      }

      if(bids.size > 0)
      {
        for(const [key,value] of bids)
          {
            valueDecimals = Number(value.maxPaidForBid)/1000000;
            console.log(`\tBID_${key}: {0, ${valueDecimals}} @Price: ${value.bidPrice}`);
          }
      }
  
      lastActionBlock = blockNumber;
     
      //    Does not change balance range
      //  case unwrap
      //    TODO if its possible, compare passed in handle and the handle of the user balance. Likely to be same
    }

    // TODO: is it possible to fork ethereum at that very moment and check the handle which stores user balance


}



/**
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

function getUnwrappedAmountFromReceipt(receipt) {
  
  const unwrapFinalizedTopic = "0x2d4edf3c2943002120f53dab3f8940043f34799f4a92ab90f2f81f7dd004a49e";
  
  for(const log of receipt.logs) {
    if(log.data && log.topics[0] === unwrapFinalizedTopic) {
      return ("0x" + log.data.slice(-64)) ?? null;
    }
  }
}

function getZamaDisbursedFromReceipt(receipt, address) {

  // Actually called "ZamaTokenDistributed"
  // TODO update all mentions of this in the code to say "distributed" and not "disbursed"
  const zamaDisbursedTopic = "0x63f3c1dfe868c93b4c1f789017d37f86d91f0df374cd4f16155c54dba820cb20";

  for(const log of receipt.logs) {
    if(log.data && log.topics[0] === zamaDisbursedTopic) {
      if(log.topics[1] === "0x000000000000000000000000"+address.slice(-40)) {
        return (log.data);
      }
    }
  }
}

function setRangeLowIfBidsEmpty(rangeLow, rangeHigh, bids) {
  if(bids.size == 0)
  {
    return rangeHigh; //sets rangeLow to rangeHigh if no more bids
  }
  else return rangeLow;

}

main();