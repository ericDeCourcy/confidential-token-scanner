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

### Scanning tokens

Run this command in the root directory:

```
$ node scripts/scan-cToken.js --token cUSDT --sleep 1000 --endBlock 12345678 --startBlock 12345678

```
All flags except `--token` are optional.

This will scan the cUSDT confidential token which is live on ethereum and was used for the $ZAMA token auction.

`--sleep` will determine the time between API queries, which is useful to avoid rate limiting, especially in the case of USDT around the time of the ZAMA auction. It is an optional parameter. It is specified in milliseconds.

`--token` is a mandatory parameter. It has the following options:
- `cBRON`
- `ctGBP`
- `cUSDC`
- `cUSDT`
- `cWETH`
- `cZAMA`

`--endBlock` is the last block to scan

`--startBlock` will override loading from the checkpoint, and instead load from some block

### See all transactions for an address
- `find-address.js` - this will allow you to see all transactions involving a specific address, and will provide etherscan links to them
    Try this: 
    ```
    node scripts/find-address.js 0x3a292b57e41d88309201f2df9cf46230c58008e0
    ```

### See "interesting" transfers
- `node scripts/totalExternalTransfers.js` - This will total up all "interesting" transfers, which are any not involving the auction contracts or the cToken wrapper. It will list the most active addresses first, then remove all of those which are auction related. Finally it totals the transfers which came from what seems to be "confidential transfer" calls. See **Discoveries** about this

### Ouput

Here is an example output from running `analyze-addresses.js` for address `0x9B98D08671E6F40cE7a4b4E4bf39b8D2538bA47F` for the cUSDT token. 

```
$ node scripts/analyze-address.js 0x9B98D08671E6F40cE7a4b4E4bf39b8D2538bA47F cUSDT
```

![Scanner output](./images/analyze-address-output.png)


### Reconfiguration

There are a few things you can reconfigure

- The network
- The token contract address
- The block range to scan. Alchemy used to limit queries to 500 block ranges, but now its limited down to 10

#TODO setup a simple re-configuration mechanism

### Discoveries

#### Percentages of diff transfers


#### 0.2% (95 of 47000) of cUSDT transfers are to non-zama contracts
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

You'll need a `events.db` for this

run:
```
node scripts/total-external-transfers.js
```

This is confirmed also by sorting for "TRANSFER" in the db under the labels column. There are about 95 matching entities.

#### Dimensions of privacy (so far)

1. The possible range of balance
  The difference between the lowest and highest possible balance for an address

2. The anonymity set - total number of txs overall, esp to senders/recipients associated with you via other txs
  The size of the number of "possible other" data points

3. The number of "dependencies" a balance has.
  The number of independent variables that would exist if describing this value as a summation (all "transfer ins" minus "transfer outs")


#### Usage stats
| cToken | Wrap | Transfer | Transfer_w_proof | Unwraps | Unwrap_w_proof | Total |
| ------ | ---- | -------- | ---------------- | ------- | -------------- | ----- |
| cUSDT  |      |          |                  |         |                |       |
| cUSDC  | 150  | 2        | 54               | 26      | 103            | 129   |
| cBRON  | 32   | 0        | 42               | 0       | 16             | 16    |
| ctGBP  | 5    | 0        | 4                | 0       | 4              | 4     |
| cWETH  | 16   | 0        | 3                | 0       | 18             | 7     |
| cZAMA  | 19   | 0        | 16               | 4       | 24             | 17    |


### Future/Planned work

- [ ] Easy configuration of params network, token address, and block range. Also adding starting and final block.
- [ ] Automated analysis of the outputs. Eventual goal is that we have a "range" of token balances for each address
    - How do we get here? We can assume "ranges" for balances for well behaved tokens, and then transfers will affect the ranges of their recipients
    
### Learnings
- [ ] #TODO Check if tokens are generally used "privately" or "not-privately" for transfers
- [ ] #TODO Should there be a default path in the "unwrap" function which just "zeroes" your balance rather than storing it as an euint? This would be easier as if you do an unwrap of the handle representing your balance then you're clearly emptying your balance
	- In [`_update` function of ERC7984](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts/blob/136840e97e6ec7331642821a9bd51c61cca1ebf9/contracts/token/ERC7984/ERC7984.sol#L284-L289)
		- there could be branch where 
```
if (from == address(0)) {
	(success, ptr) = FHESafeMath.tryIncrease(_totalSupply, amount);
	FHE.allowThis(ptr);
	_totalSupply = ptr;
} else {
	euint64 fromBalance = _balances[from];
	require(FHE.isInitialized(fromBalance), ERC7984ZeroBalance(from));
	if(fromBalance.unwrap == amount.unwrap)
	{
		ptr = wrap(0);   //this skips an FHE op
	}
	else
	{
		(success, ptr) = FHESafeMath.tryDecrease(fromBalance, amount);
	}
	FHE.allowThis(ptr);
	FHE.allow(ptr, from);
	_balances[from] = ptr;
}
```
- [ ] There may be a standard user flow we can categorize users by

### Get address Script
This script will return all transactions which have a topic in the "confidential transfer" field which matches some address. For example:

- `node scripts/find-address.js 0xfc534a31e8877dc914989267b124a59d6911576d` 
	- This guy did two unwraps, but otherwise pretty standard behavior
		- wrap, bid, recieve multicall, unwrap
- This address also is interesting - similarly simple setup: `0x3a292b57e41d88309201f2df9cf46230c58008e0`
	- #TODO I would really like to understand where the handles he was using came from
- Havent tried this with the script yet, but...
	- https://etherscan.io/tx/0xcaf5041e6846212fe99b11a3540a1e926d3903dfa7a3782b95affe148e5d72ab#eventlog
	- In this tx, you can see the "confidential amount transferred" is the result of a comparison...
		- `6C9003B48BB2080219AF2B18CC8A6B895B7B9FB9A0FF00000000000000010500` is the conf transfer handle
		- it is the `result` of `FHEifThenElse` where the "control" is the result of a `FheGe` on two of the same handle
			- `519CBD8D0DA06573ACA5C170CC2A7517B0F0646A34FF00000000000000010500` 
				- this handle is compared to itself for FheGe, where the result `54DF...` becomes the control for the if/else above
				- Also subbed from itself, where the result is the "true" case for the Ge thing
					- 

### Basic unwrap tracing script
1. identify an address
2. for this address, identify transactions which involved confidential transfers
3. For the "unproved unwrap", identify the handle which is being unwrapped
	1. Find "unwrap" call - look at topic3 in confidential transfer
4. pull all logs for cUSDT contract interactions with this user, find all instances of "unwrap handle"
5. magically identify where that handle is born

### Deliverable ideas
- Show the proportion of "known" versus "unknown" balances - this will be somewhat inflated because so many balances are "definitely zero" due to unwrapping total balance

### Findings
- Simple UX changes could make token history a lot more hidden
	- Not allowing things to go through without a proof
	- Maybe even removing proving altogether
- Unwraps are not equal - the issue with unwraps is not that they reveal how much your clear-space token balance is, its that they *can* reveal your encrypted balance to be 0 
- For tracking, we don't really need to worry about bids, we can just look at if ZAMA was transferred then multiply the amount transferred by the price `0.05` and subtract that from the user's balance
- If you're not *trying to do it right*, you're doing it wrong. This is not good
	- this is referring to the frontend i think
- all balances are constrained by transfer events. 
	- [ ] Does this mean that the privacy set is constrained? by the possibilities of different balances..? 
- "Bits of randomness" is a way of thinking about how "private" a system is.... maybe? IDK if this makes sense
- Backpropogating all the connections will be difficult, i wonder how we can do that
	- once we have all handles listed in db
	- for every address involved in transfers for cToken
		- analyzeAddress and get all handles associated with  that address
		- for each handle
			- find all instances of handles which are "associated" with this handle. Keep going until there are no new handles, store all these handles in a list (group)
				- [ ] what does associated mean precisely? #TODO
					
			- [ ] from every "unwrap" transaction, find what handle it retroactively defines. Throughout the group, replace this handle with its literal value and attempt to solve if all handles present sum to this handle.
				- [ ] To store this we need two columns:
					- AssociatedHandles (JSON)
					- Equation (String)
						- perhaps the table should be "known value", "known value range", "agebraic value", "associated handles(JSON)"
- Privacy decays over time - as more info becomes known, eventually your balance can also become known.
### Questions this tool answers
- what percent of people are doing "full unwraps" vs "unwraps with proof"
	- cUSDT - 642 with proof, 9519 without proof (full unwrap) --> 93.7% are full unwraps

| cToken | Wrap | Transfer | Transfer_w_proof | Unwraps | Unwrap_w_proof | Traceable Transfers | Traceable Unwraps |
| ------ | ---- | -------- | ---------------- | ------- | -------------- | ------------------- | ----------------- |
| cUSDT  |      | 53       | 60               | 9521    | 642            | 46.9%               | 93.7%             |
| cUSDC  | 150  | 2        | 54               | 26      | 103            | 3.57%               | 20.1%             |
| cBRON  | 16   | 0        | 42               | 0       | 16             | 0%                  | 0%                |
| ctGBP  | 5    | 0        | 4                | 0       | 4              | 0%                  | 0%                |
| cWETH  | 16   | 0        | 3                | 0       | 18             | 0%                  | 0%                |
| cZAMA  | 19   | 0        | 16               | 4       | 24             | 0%                  | 14.3%             |


- what percent of transfers are "full transfers" vs "partial transfers"
	- cUSDT - 60 w proof,  53 without --> 46.9% are full transfer
- How much legitimate usage of the token is there vs auction usage
- Can I definitively tell you the confidential token balance of X% accounts, and Y% accounts where the balance is nonzero?
- how often does someone have exactly one sender before withdrawing? (this indicates all funds came from one person)
- how often does someone have exactly one recipient from their sends along with a full withdrawal?
- Lets attempt to label each FHEVM handle - how many of them are we able to say with certainty what their values are?

### For "redeem delegations"
See [[NFP_14]]

### Findings to turn into a twitter thread
Zama scanner findings

- Privacy leaks happen in two forms: unproven unwraps and unproven transfers. Since handles need to be accessible by those using them, transfers/unwraps without proofs have a very limited set of values. These are almost always the entire balance of the account. These handles can be traced
- We can likely "score" the private usage of cTokens by counting the handles which have been used to represent balances or transfer amounts, and then counting the ratio of handles which have only one possible value. Since the important private information behind cTokens is the balances themselves, this score effectively represents "How good the system is". To improve the system, we just need to improve this ratio. 
- We can describe handles as a summation of dependencies. Wraps + transfers_in - unwraps - transfers_out. These dependencies are also sometimes handles or sometimes known values. The literal value can be expressed as a range {min,max}.
	- Using the algebraic approach, we can back-solve private values. Practically, this means your privacy may go down as time goes on. Algebraic values getting solved cascades into other algebraic values.
- Since wraps/unwraps are revealed, the only secret information is transfers. Transfers are the mechanism by which we increase privacy; we create more unknown values by doing more transfers. 
- We can improve the privacy of cTokens substantially by removing `transfer` and only allowing `transferWithProof`. This can be done at the UI level by avoiding `transfer`
- Zama auction was the biggest use case by far of cUSDT. Out of 47000 transactions, ~100 did not involve the auction contracts. 
- Transaction "carefulness" goes down with mass use, drastically. Of the transfers of cUSDT, ~47% of those scanned were traceable. This tells us something - the vast majority of users are not paying that close attention. 
- After the auction, most users of cUSDT pulled their funds back out. ~93% of unwraps were traceable and "full balance unwraps"
- Privacy loss over time is exemplified by the Zama auction. Once the auction price was settled and their $ZAMA transferred, it became very easy to back-compute people's bids. 
- Go check out my github if you want a giant DB of all cUSDT transfer events. I also have the significantly smaller DBs of the other cTokens.