# Findings from confidential token analysis

I built a piece of [open source code](https://github.com/ericDeCourcy/confidential-token-scanner) that scans for transfers of ZAMA confidential tokens on ethereum. It takes transactions which contain cToken transfers, and puts them into a database (available on the github also). From there, i created a script which takes an address as input and finds all transactions where that address is the sender or recipient of cTokens. 

For those unaware, cTokens are built with the ZAMA fhEVM, and are based on ERC20s. They are wrappers for ERC20 tokens - so you can wrap USDT into cUSDT for example. Once in "confidential" form, these tokens are private in the sense that all balances, and all transfer amounts are obscured. However, the _existence of transfers_ and the _parties of the transfer_ are fully visible, in the sense that i can see which accounts are sending and recieving tokens.

There are 6 cTokens currently, and they operate the same way. Here are their addresses:

```
cUSDT: 0xae0207c757aa2b4019ad96edd0092ddc63ef0c50
cUSDC: 0xe978F22157048E5DB8E5d07971376e86671672B2
cBRON: 0x85dE671c3bec1aDeD752c3Cea943521181C826bc
cZAMA: 0x80cb147fd86dc6dee3eee7e4cee33d1397d98071
ctGBP: 0xa873750ccbafd5ec7dd13bfd5237d7129832edd9
cWETH: 0xda9396b82634Ea99243cE51258B6A5Ae512D4893
```

# The story of this project


TODO flesh out
- first i had to gather data. I scanned for transfer events. That covered MOST things, but we also had to look for "finalize unwrap" events as well. These are separate transactions but provide a huge data source.
- first i tried doing min/max framing for balances
  - the goal of this was to be able to say exactly what someone's balance was, given their address
  - the end result of this effort was a "narrative" for the address - they transferred, they bid, they wrapped etc
  - this exposed the need for algebraic representation of balances
- Algebraic representation is where we express balances as a sum of all inputs and outputs
  - the project didn't do this yet. Thats the next step, if i choose to continue
  - once we have an algebraic representation, we can apply {min/max} framing to the different algebraic elements.
  - Then, we can treat all elements like a linear algebra problem. We can begin back-solving
  - i didn't continue because this back-solving algorithm needs some time to get right, and frankly is unneeded for tracing the balances of most accounts.

# The data

- here's where you can find it: <todo link to repo dbs>
  - note that these Dbs are incomplete. I only scanned up to block `24943005` (<todo date>)
- mostly it was cUSDT

# The findings

## 1. The auction exposed real-world patterns
- Auction is kind of the only "Thing" cTokens have been used for up until now, aside from basic transfers. 
- Auction was the vast majority of transactions. <todo numbers>
- Auction exposed how real-world users actually behave
  - They don't care nearly as much about privacy as we might hope
    - or maybe they just trust their actions are more private than they actually are
- The auction displayed a fun property of private systems - privacy decays over time

## 2. Privacy decay
- Auction was private until the end, then information could be easily back solved
  - <TODO example regarding decrypting bids>
- This is actually how they auction intended to function. Bids don't need to be hidden after the settlement price has been reached
- The knowledge of the auction settlement price allowed us to fill in the gaps in information for user actions
  - I knew the settlement price. If you bid under the settlement price, i knew your bid wasn't filled, and your cUSDT balance was effectively unchanged
  - If your bid DID get filled, i could look at your ZAMA token reciept, multipy it by the price, and knew your balance was reduced by exactly that much
- This back-solving was built in from the start, because i knew the auction was already resolved
- A generalized back-solver for other defi protocols which get built in the future can likely be built easily
- key takeway: your actions will eventually be decrypted. Thats okay! But, plan around it.

## 3. "Full unwraps" 
- These really got people.
  - 93% of unwraps
  - If you just wait, it helps increase privacy a ton. Just keep your coins sitting until you need them
  - You can also use "with proof"!
- Practically, for many who only wrapped cTokens to participate in the auction, and then withdrew, the full unwrap didn't matter. Thier balance was already known

## 4. User behavior
- users don't use the private functions
- using "with proof" helps a ton
  - build this into the UI for maximum privacy
- users don't wait. many people withdrew their tokens. This creates privacy decay yet again
- As usage goes up for a token, the amount of privacy goes down. This means the number of balances we can solve for, as a percentage, seems to increase with real-world usage
  - It doesn't have to be this way. But it is, for now

## 5. Privacy score
- I think we can define the privacy score of cTokens by doing ratio of "known / total" handles
- at the end of the day, handles are the secret sauce of Zama. They are what gives the system its private nature.
- we know we doing good if privacy score increases.
  - Simple ways to do this: only use "with proof", delay withdrawals, comingle accounts. Create lots of transfers
- Privacy score is not a good metric of individual privacy. It can easily be artificially inflated by isolated groups doing lots of transfers.
- If you have ideas on how to refine this metric, that would be super cool
- I'm looking for a way to rank the "privacy" of a system
- Perhaps this privacy score can be re-applied to an account - for example, given the handles associated with an account, how many are known/unknown.

## 6. Notes on actual usage of tokens
- cUSDT had 47k transfers, cUSDC had about 400 and all other tokens had less than 100
- "privacy score" on the other tokens aside from cUSDT was massively higher. This is likely because a few dedicated devs were testing the system rather than users using it

# The algebraic solution
- cascading solves. 
- sorry it don't exist yet, if you want to build it you can open a PR or maybe persuade me ($$$) to clean up the repo. I just have other thigns going on sorry whatever pay me
- the majority of accounts i've seen don't need an algebraic solver, they can be solved with basic logic.

# Why?
Why did i do this? Simply because, someone nefarious out there is already doing it. But also, because we strengthen private systems by attempting to break them. I hope this can be educational and inform private development going forward.
