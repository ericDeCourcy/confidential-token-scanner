const hre = require("hardhat");

//const txHash = "0x39ce07836ca11d25d51051c58c40311622e83831524373c0e1731ac59ba474a3";
const fromBlock = 25772497; // deployment of cUSDC
//const fromBlock = 26666602; //right before a known shielded transfer
//const fromBlock = 26788395; //should be 100 blocks before a double-transfer to 0x4275 addy
transfer_funcsig = "0x29723511";
//const cUSDC_address = "0xA449bc031fA0b815cA14fAFD0c5EdB75ccD9c80f";
const cUSDC_event_emitter = "0xeBAFF6D578733E4603b99CBdbb221482F29a78E1"
const abi =[ 
    "event NewInput(bytes32 result, address contractAddress, address user, uint8 inputType, bytes ciphertext, uint256 eventId)"
];
const fs = require('fs');

const sendersByRecipient = {};

// Add a sender
function addSender(recipient, sender) {
  if (!sendersByRecipient[recipient]) {
    sendersByRecipient[recipient] = new Set();
  }
  sendersByRecipient[recipient].add(sender);
}

// Check if recipient exists
function hasRecipient(recipient) {
  return recipient in sendersByRecipient;
}


async function main() {
    
    let combined_sender_count = 0;
    let single_send_count = 0;

    //clear the output file
    fs.writeFile("scanOutput.txt", "", (err) => {
        // In case of a error throw err.
        if (err) throw err;
    })

    fs.writeFile("multisends.txt", "", (err) => {
        // In case of a error throw err.
        if (err) throw err;
    })

    const provider = hre.ethers.provider; //await ethers.provider.JsonRpcProvider(baseSepolia.url);

    //console.log("ping");
   // console.log(tx.data.slice(0,10));
    console.log("ding");

    const latestBlock = await provider.getBlock("latest");
    const contract = new hre.ethers.Contract(cUSDC_event_emitter, abi, provider);

    let counter = 5;

    for (let blockNumber = fromBlock; blockNumber <= /*fromBlock+2 latestBlock.number*/ fromBlock + 100_000; blockNumber = blockNumber + 500)
    {
        if(counter == 5)
        { 
            console.log(`Scanning Block: ${blockNumber}`); 
            counter = 0;
        }
        else {counter++;}
        const events = await contract.queryFilter(["0xebefdc81a19926c3d7478ba60eeeb24bc2b9132d18ac57281acac1932afc6b2f"], blockNumber, blockNumber + 499); //alchemy limit of 500

        for (thisEvent of events)
        {
            //console.log("ping");
            //console.log(thisEvent.transactionHash);
                
            let thisTx = await provider.getTransaction(thisEvent.transactionHash);
            //console.log(thisTx.data);

            // add transfers to map
            // 1. confirm they are transfers
            if(thisTx.data.slice(0,10) == transfer_funcsig)
            {
             
                //console.log(thisEvent.transactionHash);

                fs.appendFile("scanOutput.txt", thisEvent.transactionHash + "\n", (err) => {
                    // In case of a error throw err.
                    if (err) throw err;
                })
                // 2. detect sender and recipient
                thisSender = thisTx.from;
                thisRecipient = ("0x") + thisTx.data.slice(34,74);
                //console.log(thisSender);
                //console.log(thisRecipient);

                // 3. IF: recipient has 0 senders, set sender in mapping for recipient
                //    ELSE: recipient has 1 sender, set sender to 0xAAAAA.... to indicate that they have two senders
                addSender(thisRecipient, thisSender);
                //console.log(sendersByRecipient[thisRecipient]);

                if(sendersByRecipient[thisRecipient].size > 1)
                {
                    console.log(sendersByRecipient[thisRecipient]);
                    combined_sender_count++;
                    
                    fs.appendFile("multisends.txt", thisEvent.transactionHash + "\n", (err) => {
                        // In case of a error throw err.
                        if (err) throw err;
                    })
                }
                else
                {
                    single_send_count++;
                }               
            }
        }
        console.log(`single_send_count = ${single_send_count}`);
        console.log(`combined_sender_count = ${combined_sender_count}`);

    }

    
/*
    for (let blockNumber = fromBlock; blockNumber <= latestBlock.number; blockNumber++) {
        const block = await provider.getBlock(blockNumber, true);
    
        console.log(`📦 Scanning block ${blockNumber}, tx count: ${block.transactions.length}`);
    
        for (let tx of block.prefetchedTransactions) {
            tx_funcsig = tx.data.slice(0,10);
            if(tx.to == cUSDC_address)
            {
                if(tx_funcsig == transfer_funcsig)
                {
                    console.log(tx.hash);
                }        
            }
        }
    }
*/


}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });