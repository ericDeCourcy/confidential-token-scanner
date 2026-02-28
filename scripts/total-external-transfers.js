// this script exists to tally the number of contracts which only interact with a few contracts like the auction and the multisenders, and zero address for mints and burns.
//  It will tally addresses with transfers outside of the norm, and it will tally addresses which have been transferred to a lot.

const Database = require("better-sqlite3");

// 1. tally addresses with transfers both "totally safe" and outside the norm
let safeOnlyTotal = 0;
let externalTransferTotal = 0;
let unknownTotal = 0;

async function main() {

    /*
    const input = process.argv[2];
    if (!input) {
      console.error("Usage: node total-external-transfers.js <0xAddress>");
      process.exit(1);
    }
      */

    const listOfAuctionWallets = [
        "0000000000000000000000000000000000000000",
        "2c7f968107a47087085308e7833dd8b11ecddf4f",
        "ef7857c5a1fc254c6883771eb15e119596a6d65a",
        "e3cfd946b719d6c759944bcca4f9d370d50a7f49",
        "f8a376aa3214841243831ad18f2367fae831acf9",
        "70980569ebd236f557211a8bc20c0b5845034502",
        "508459465da5cf760ccbf2a0acd156f40383770e",
        "e01c8a7f1877f1609c447fee2ee963d1853266bb",
        "6af14a92a6a1cf2b694fd37aaca6ec5b36eabecc",
        "2dbfc8f37d7cd52d5a28fac4799bb932446f3f8a",
        "93345f1976eb1575ac03ab4f23728ac9029d250b",
        "54fd9ab08078cf60e168838ed2597c2682d26b84",
        "6df8246cf8f084101a60c89966e2dc7cc672021f",
        "1fe756179e61cb6d89c3d3af82376f0031be0edf",
        "a5c8c4666c4a2567ed01e41b5d98839bdda458b7",
        "47cf5283fd2fc5cf46614c9f593273cebac7fc4e",
        "03b9d091bb9854cd9813ad6e29cc5d5ec64943db",
        "fcdc336df1201df580b62fcdc0c456ad41e2706b",
        "ae7bd990a559b35bd12ad3c3f0bd86c068c50115",
        "1b411cc4d55a4ab2302f0e4f6aec5e3d66b29111",
        "056f0498268a497d66ab2843c8bb8edebb01608e",
        "6fcc0995b6a691b7b4652458df8067a985549bcf",
        "9f6a86fc62597bcccf56d9400078ba6b8a7093d3",
        "1dfd06a53f4392a1e8ddaa315637944a1d6953d1",
        "a4e7442d3ce8d688d0854b23e9af9f19e9a49e07",
        "ea5c7a58f446235e2d3b34587ce525e784a199a7",
        "2615b27d6e7a450e03bf5c94f6141c507e934f41",
        "91d8e75d14f7c0f1fdfb362ce70d3b5632b7e1ea",
        "9700d6e978107fb91ff634b7b397cf7d8ecc7681",
        "1a1dc272a0f894e4a0574ce9c88a9eadcf46aa40",
        "bacbe998075640ba12c1f763c8e67fbda6016f48",
        "1576ffc274046e63028316ce15807227ba9da5ce",
        "b5d8bd9b45c9eac6f51cb4da75d49901d4468255",
        "9cf3c00bd77d710a148133815ff0684d3b624598", //APPArently this is a zama deployer...??? It has a few "exotic" transactions
    ];



    
    // open db
    const db = new Database("events.db", { readonly: true });

    try {
    // topic1 and topic2 are sender and receiver
    const stmt = db.prepare(`
        SELECT topic1, topic2   
        FROM contract_logs
    
    `);
      
    //const term = "0x000000000000000000000000"+input.slice(-40);
    //console.log(`term ${term}`);
    
    const rows = await stmt.iterate();

    const countsOfAddresses = new Map();

    function add(item) {
        countsOfAddresses.set(item, (countsOfAddresses.get(item) || 0) + 1);
    }

    // This means that the list is 
    const nonSafelistTransfers = new Map();

    function addNonSafeList(item) {
        nonSafelistTransfers.set(item, (nonSafelistTransfers.get(item) || 0) + 1);
    }

    for(const row of rows)
    {
        add(row.topic1);
        add(row.topic2);

        const flagged = listOfAuctionWallets.some(value => row.topic1.includes(value));
        const flaggedAlso = listOfAuctionWallets.some(value => row.topic2.includes(value));
        if(!flagged && !flaggedAlso) { 
            externalTransferTotal++; 
            console.log(`topic1, topic2 = {${row.topic1.slice(-40)},${row.topic2.slice(-40)}}`)
            
            addNonSafeList(row.topic1);
            addNonSafeList(row.topic2);
        }

        
    }

    // just enough to see the dropoff in auction wallets lol
    const top40 = [...countsOfAddresses.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(1, 41);          // slices off "zero address" because it has by far the most due to mints/burns


    for (const [address, count] of top40) {
        const formattedLink = `https://etherscan.io/address/${"0x"+address.slice(-40)}`;
        console.log(formattedLink, count);
    }

    console.log("=-=-=-=-=-=-=")
    console.log("\nFully external transfers");

    console.log(externalTransferTotal)


    const top25 = [...nonSafelistTransfers.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25);         


    for (const [address, count] of top25) {
        const formattedLink = `https://etherscan.io/address/${"0x"+address.slice(-40)}`;
        console.log(formattedLink, count);
    }

    console.log(externalTransferTotal)
   
    } 


     
    finally {

        db.close();
    } 

    //console.log(`${safeOnlyTotal} ${externalTransferTotal}`);

}

main();