### Setup

1. This is a hardhat project, so make sure you have hardhat installed and stuff.

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

#TODO we still need checkpoints for this scanner
#TODO we should remove the old scanners
#TODO this scanner just creates a database, it still needs to actually perform analysis on the matching transactions

**Here are the other scripts you can run**
- `add-topic-rows.js` - this will add columns to your already existing table from `scan-cUSDT.js`, for topics 1, 2 and 3 of the event emission. Topic 0 is already recorded and is the event signature - TODO: integrate these table columns into `scan-cUSDT.js`
- `populate-topic-rows.js` - this will parse `topics_json` from your table into topics 1, 2, and 3. Basically just completes the table itself instead of letting everything stay NULL - #TODO integrate this into `scan-cUSDT.js` as well
- `find-address.js` - this will allow you to see all transactions involving a specific address, and will provide etherscan links to them
    Try this: 
    ```
    node scripts/find-address.js 0x3a292b57e41d88309201f2df9cf46230c58008e0
    ```


### Ouput

#TODO What does the output look like

### Reconfiguration

There are a few things you can reconfigure

- The network
- The token contract address
- The block range to scan. Alchemy used to limit queries to 500 block ranges, but now its limited down to 10

A simple way to reconfigure this is a #TODO item

### Future/Planned work

- [ ] Easy configuration of params network, token address, and block range. Also adding starting and final block.
- [ ] Automated analysis of the outputs. Eventual goal is that we have a "range" of token balances for each address
    - How do we get here? We can assume "ranges" for balances for well behaved tokens, and then transfers will affect the ranges of their recipients
    
