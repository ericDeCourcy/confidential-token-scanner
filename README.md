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
  networks: {
    baseSepolia: {
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

3. in the config file, replace `<your alchemy url here>` with an alchemy RPC url. Should look something like this: `https://base-sepolia.g.alchemy.com/v2/aaaaaaaaaaaaaaaaaa`. Make sure it works for Base Sepolia

### Running

Run this command in the root directory:

```
$ npx hardhat run scripts/scan-with-checkpoints.js --network baseSepolia
```

This will scan the Inco "comfy" token, saving **checkpoints**. **Checkpoints** basically just means it continues to scan blocks after the last-saved block number, which is stored in `status.txt`. 

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
    
