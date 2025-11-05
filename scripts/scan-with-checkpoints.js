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

async function main() {
    scanWithCheckpoints();
}

async function scanWithCheckpoints() {

    let lastScannedBlock; 

    // check status.txt for the last block scanned fully
    fs.readFile("status.txt", "", (err, data) => {
        // In case of a error throw err.
        if (err) throw err;

        const text = data.toString();        // Convert Buffer → string
        lastScannedBlock = parseInt(text, 10);   // Convert string → integer
      
//        console.log(intVal);  // e.g., 42
    })

    // get current block height
    const provider = hre.ethers.provider; 
    const contract = new hre.ethers.Contract(cUSDC_event_emitter, abi, provider);

    const latestBlock = await provider.getBlock("latest");
    const latestBlockNumber = latestBlock.number;

//    console.log(latestBlock.number);

    // while last scanned block is NOT block height
    console.log("lastScannedBlock: " + lastScannedBlock + "    latestBlock: " + latestBlockNumber);
    while(lastScannedBlock < latestBlockNumber)
    {
        console.log("in the while");

        let lastBlockToScan;
        //  if diff is less than 500 blocks
            // set last-block-to-scan to block height
        if(latestBlockNumber - 10 < lastScannedBlock)
        {
            lastBlockToScan = latestBlockNumber;
        }

        // else
            // set last-block-to-scan to last_scanned_block + 10
        else
        {
            lastBlockToScan = lastScannedBlock + 10;
        }
        
        // scan them blocks
        const events = await contract.queryFilter(["0xebefdc81a19926c3d7478ba60eeeb24bc2b9132d18ac57281acac1932afc6b2f"], lastScannedBlock+1, lastBlockToScan); //alchemy limit of 500

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
        
                // 2. detect sender and recipient
                thisSender = thisTx.from;
                thisRecipient = ("0x") + thisTx.data.slice(34,74);

                fs.appendFile("scanOutputWithCheckpoints.txt", thisEvent.transactionHash + "," + thisSender + "," + thisRecipient + ",\n", (err) => {
                    // In case of a error throw err.
                    if (err) throw err;
                })

            }
        }

        lastScannedBlock = lastBlockToScan;

        fs.writeFile("status.txt", lastScannedBlock.toString(), (err) => {
            if (err) throw err;
        })

        console.log("lastScannedBlock: " + lastScannedBlock);


        // for every transfer, append to transfers.txt "${txHash}, ${sender}, ${recipient},"

        // update last_scanned_block 
    }
}

async function processOutput()
{
    // we need to de-duplicate the output, there is a chance that the checkpointed output has the same tx hashes in it. All the data should be the same so that makes it easy
    // basically just scan for transaction hashes, and if it already exists then remove that line

    // loop through all the lines
    //      1. if !txHashExists
    //          1a. set txHashExists
    //          1b. get sender, recipient. Check if senderByRecipient[sender] exists
    //          1c. if it doesnt exist
    //              1ci. add it to the mapping
    
}



main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });