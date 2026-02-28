### Setup

1. This is a hardhat project, so make sure you have hardhat installed.

2. You'll need to make a file called `hardhat.config.js` in the root directory. For that file, paste this in:

```
require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.24",
};

const privateKey = "0x0123567890abcdef0123567890abcdef0123567890abcdef0123567890abcdef";

module.exports = {
  defaultNetwork : "ethereum",  //This is important for running some scripts
  networks: {
    ethereum: {
      url: "<your alchemy url here>",
      accounts: [privateKey],
      gas: 2100000,
      gasPrice: 8000000000,
      saveDeployments: true,
    }
  },
  solidity: "0.8.24",
};
```

3. in the config file, replace `<your alchemy url here>` with an alchemy RPC url. Should look something like this: `https://eth-mainnet.g.alchemy.com/v2/aaaaaaaaaaaaaaaaaa`

4. Set your default address in hardhat.config.js to ethereum to run certain scripts that need to query the chain

```
module.exports = {
  defaultNetwork : "ethereum",  //Add this line
  networks: {
    ethereum: {   //make sure this is configured with your api key
```

### Running

Run this command in the root directory:

```
$ npx hardhat run scripts/scan-cUSDT.js --network ethereum
```

This will scan the cUSDT confidential token which is live on ethereum and was used for the $ZAMA token auction.



**Here are the other scripts you can run**
- `add-topic-rows.js` - this will add columns to your already existing table from `scan-cUSDT.js`, for topics 1, 2 and 3 of the event emission. Topic 0 is already recorded and is the event signature - TODO: integrate these table columns into `scan-cUSDT.js`
- `populate-topic-rows.js` - this will parse `topics_json` from your table into topics 1, 2, and 3. Basically just completes the table itself instead of letting everything stay NULL - #TODO integrate this into `scan-cUSDT.js` as well
- `find-address.js` - this will allow you to see all transactions involving a specific address, and will provide etherscan links to them
    Try this: 
    ```
    node scripts/find-address.js 0x3a292b57e41d88309201f2df9cf46230c58008e0
    ```
- `node scripts/totalExternalTransfers.js` - This will total up all "exotic" transfers - not involving the auction contracts or the wrapper. It will list the most transferred-with contracts first, then remove all of those which are auction related. Finally it totals the transfers which came from what seems to be "confidential transfer" calls. See **Discoveries** about this

### Ouput

#TODO What does the output look like

### Reconfiguration

There are a few things you can reconfigure

- The network
- The token contract address
- The block range to scan. Alchemy used to limit queries to 500 block ranges, but now its limited down to 10

A simple way to reconfigure this is a #TODO item

### Discoveries

#### 0.2% (95 of 47000) of transfers are to non-zama contracts
- This means the majority are just interacting with the auction contract, which is NOW traceable. 
  - The auction contract was NOT traceable at the time of the auction - the privacy function of the auction was to hide the settlement price. But the settlement price was revealed and used for all bidders.
- Out of rougly 47k transfers recorded, only about 100 of them were to addresses that weren't the wrapper or auction contracts.
- Many accounts involved in these transfers show very little activity. "Interesting" transactions are between two non "safe" contracts (safe contracts being wrappers, auction contracts, zama distributor contracts, etc.)
- Apparently heavily correlated with people actually calling the dang transfer function 
```
Fully external transfers
95

---------------------- Address ----------------------------------------|-------- number of interesting txs 
https://etherscan.io/address/0x5e310f01a0b13278cf676b3439d32859e0aad82d 17
https://etherscan.io/address/0x5c178c08363928c6296ed420eaeef73e21b667d4 11
https://etherscan.io/address/0x1dc385c0594358886a1b21eda0ad4c053214c699 6
https://etherscan.io/address/0x77b7d6545d352bfd858b308343d1a4e414cb4d7e 6
https://etherscan.io/address/0xc695d7097a6a4208b33cc7b85f8a6844a90977dd 6
https://etherscan.io/address/0xb905bce0188045fde5aab20742ec17e9ab6dd853 6
https://etherscan.io/address/0xf38d9f73c6bcb9e047082442580f332e3cbcedce 6
https://etherscan.io/address/0x3d9a867c1ff6bbac2a01dc2678cd7819216874f6 4
https://etherscan.io/address/0x6d7b5a32fc63c5011c3dd217e151c9c118908dfd 4
https://etherscan.io/address/0x36afce8f48bbb961c76ec20bc07f34f313374fd9 4
https://etherscan.io/address/0x3a947148972087dd89c2fda6f0a8cb915948457b 4
https://etherscan.io/address/0x441319b8e436e3fe7d2b685377980fdba203cbec 4
https://etherscan.io/address/0x4978a0d5e2e582a03bc58cdf7a8e89639756c74b 4
https://etherscan.io/address/0x2c2a9ab5922632b397495d56b66a276e09c42d91 4
https://etherscan.io/address/0x3a531341103d589aea7481be75edbca2e9a69605 3
https://etherscan.io/address/0xf13a99222b7e613855cdbc9a667973af7aa202fe 2
https://etherscan.io/address/0x14db914aec49981153c7b16bf85d2ac997c34133 2
https://etherscan.io/address/0xeb7e54b34548a2a8d924fc323f897cd42425b525 2
https://etherscan.io/address/0x17e53556fdda3bf5e53b73af1b68cfcedadd6b1c 2
https://etherscan.io/address/0xfdad746daecfb2e58bc5c6b3ca7aa208081a600f 2
https://etherscan.io/address/0xc91a004d5baa708230527283bfaee3e1d19100b2 2
https://etherscan.io/address/0x3776d95fbb1859de65b54204a9778c8bb19d2873 2
https://etherscan.io/address/0xc54489677956fdc2acb376185761a858ce85544a 2
https://etherscan.io/address/0x3c8d0ef4f5fe05cfcd60d98e35ee493a0c12f21c 2
https://etherscan.io/address/0x255cdddbec2c76b2f409248abeea49c1b1c6bf18 2
```

You wanna run this for yourself??? Huh?? Do ya?

You'll need a events.db for this

run:
```
node scripts/total-external-transfers.js
```

This is confirmed also by sorting for "TRANSFER" in the db under the labels column. There are about 95 matching entities.



### Future/Planned work

- [ ] Easy configuration of params network, token address, and block range. Also adding starting and final block.
- [ ] Automated analysis of the outputs. Eventual goal is that we have a "range" of token balances for each address
    - How do we get here? We can assume "ranges" for balances for well behaved tokens, and then transfers will affect the ranges of their recipients
    
