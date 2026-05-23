# Findings from confidential token analysis

I built a piece of [open source code](https://github.com/ericDeCourcy/confidential-token-scanner) that scans for transfers of ZAMA confidential tokens (cTokens) on Ethereum. It takes transactions which emit Transfer events from cToken contracts, and puts them into a database (available [on the github](https://github.com/ericDeCourcy/confidential-token-scanner) also). From there, i created a script which takes an address as input and finds all transactions where that address is the sender or recipient of cTokens. There are also some other helper scripts, like one which lists all the addresses that unwrapped cTokens, "tagging" scripts which examine the transaction, and a script listing all non-auction-related transactions (the $ZAMA sale was an auction which accounts for most of all cToken transactions).  

Confidential tokens here are ERC7984 tokens. They are built leveraging the ZAMA fhEVM, and are based on ERC20. They are wrappers for ERC20 tokens, allowing you to wrap USDT into cUSDT for example. Once in "confidential" form, these tokens are private in the sense that all balances, and all transfer amounts are obscured. However, the _existence of transfers_ and the _parties of the transfer_ are fully visible, in the sense that i can see which accounts are sending and recieving tokens. A transfer event emits the sender, recipient, and a unique identifier for an encrypted value called a "handle".

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

First i had to gather data. A simple hardhat script to scan the chain accomplished this, scanning for any transfer events. At the end of the day, the only data we needed to "decrypt" was token amounts, so transfers would do for that. This even covered wraps, as wrapping atomically transferred cTokens to the user. So when doing a "wrap" transaction, a transfer event would be emitted, and that would be captured by my scanner. But actually, this did NOT cover unwraps, at least not in enough detail. Unwraps did involve transfers, but they happen in a two step process. Step 1 is triggering the unwrap (where a Transfer event is emitted) and step 2 is finalizing that unwrap, where the ERC20 tokens are transferred to the user. Step 2 is invaluable - it exposes the value of the encrypted amount from Step 1. Since these steps are separate transactions, it was necessary to scan for That covered MOST things, but we also had to look for "finalize unwrap" events as well. These are separate transactions but provide a huge data source.

Wraps and unwraps are critical here - they expose exact amounts, and are paired with handles,

Once i had the data it was time to process it. My initial thought was to use "min/max" notation for balances. Basically, what is the minimum or maximum balance an account could have. If they deposit 100 tokens, then transfer a confidential amount, i know their balance is now `{0,100}` and whoever they just transferred to now has increased their max balance by 100. This was helpful for the first iteration of the project, which a script that "narrates" an account. The account narrative would show what actions the account took and their min/max balance after each action.

<TODO image>

While dealing with processing the Zama auction, i noticed that bids could be discretely tracked. If the bid was active, could represent the amount paid as a constant. Until the bid was no longer active, i could safely assume that the constant amount was locked away, and use that to inform other amounts like balances or amounts associated with other bids. Very quickly this led to a eureka moment.

A more robust framing of balances is what i'll call the "algebraic approach". Rather than min/max framing, we can represent balances as algebraic sums. For example:

`Balance = SUM(transfer_in) - SUM(transfer_out)`

A bid would qualify as a transfer out. This not only helps inform balances, but it also helps inform other transferred amounts. If a user makes two transfers in order (`TX1` and `TX2` here) we can derive some constraints on these values. `TX1` must be no greater than initial balance. `TX2` must be no greater than initial balance _minus_ `TX1`. 

This quickly creates an _"algebraic dependency graph"_, and the beautiful thing about this is that over time it solves itself. If we know the initial user balance (as we often do, due to the nature of wrapping ERC20 tokens), and we eventually learn the value of one of the transactions, it helps inform the value of the other transaction. This reduces solving for confidential amounts down to a linear algebra problem. We can then use linear algebra techniques to fight the good fight and increase privacy. This is done by basically making the linear system really complicated. 

The other advantage of the algebraic solution is no loss in information. With the min/max framing, transfers don't change the sender's min/max. This is because they _might_ be sending a value of `0`. The algebraic solution accounts for this while still being congruent with the min/max solution. 

However, sadly, life started to get in the way of this project and i lost momentum before fully implementing an algebraic solver. This could be a fun project if anyone is interested! And given enough pressure, in the form of words of encouragement, or coins, i may continue fleshing out the algebraic solver. But at time of writing, this is where i've stopped on the project.

Below are more details on my findings at this time:


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

Once again, you can find the transaction data on [my github](https://github.com/ericDeCourcy/confidential-token-scanner): https://github.com/ericDeCourcy/confidential-token-scanner

The data is within the various `...events.db` files. You can see, for example, `cUSDT_events.db` in the toplevel directory of the github.

Please note that these dbs are not up to date - they require manually running the scanner to add to them. So far they have been scanned up to block `24943005`, which is April 23, 2026.

An interesting note: there were over 47000 cUSDT transactions. The other tokens all had less than 500, most with less than 100. This was largely due to the ZAMA auction, which only accepted cUSDT.

# The findings

## 1. "Full unwraps" 

A full unwrap is a really potent peice of data. This is when someone calls "unwrap" rather than "unwrap with proof". To do this, they need access to some handle. And typically, they already have access to the handle they want, because it is _their full balance_. 

If we detect a full unwrap, we know that the user's cToken balance was exactly whatever they recieved from the unwrap finalization (in ERC20 tokens).

Overall, I found that 93% of unwraps were "full unwraps". This is crazy! It exposes so much confidential data. And i get it, once a user withdraws their full balance, why do they care. They're "done" with the confidential token.

Here are the takeaways:
- Users who care should use "unwrap with proof". Yes, it costs more gas. But it can be used for the exact same withdrawal amount, but in a way that preserves privacy better.
- Users who are not in a rush can just wait to withdraw. It helps to increase privacy for everyone they have transacted with, by not exposing a piece of data which can help solve the _algebraic dependency graph_.
- Users should be aware of who they are transacting with! If someone you send to later does a full unwrap, congrats, they have now made it easier to expose your balance. Ideally these systems should be "trustless", but trust still plays a role here.

Note also that "full transfers" are a thing! There are two versions of the `confidentialTransfer` function; one using a proof and one using a handle. I found similarly that the one which uses a handle frequently was used by accounts transferring their full balances.

## 2. The auction exposed real-world patterns

The ZAMA auction was kind of the only "thing" cTokens have been used for up until now, aside from basic transfers. Once again, the auction was the vast majority of transactions. Out of 47000 transactions, only about 100 were non-auction related!

The auction can be used as a reference for how real-world users behave! And sadly, they don't really seem to care about privacy as much as I'd hope. Maybe they trust their actions are more protected than they actually are.

I noticed that 
- 93% of cUSDT unwraps were "full" unwraps
- 47% of cUSDT transfers were "full" transfers.
- The percentages for both of these were significantly lower in other cTokens.

These both leak quite a bit of data. It just seems that real-world users don't care, or don't know. So perhaps we have found an education gap, or a poor user interface, or a compromise in the use philosophy of confidential tokens. 

In any case, we can see that as usage grows, usage hygiene gets sloppy with respect to privacy. 

We can increase privacy as developers by building user interfaces which only call the "proofed" versions of these functions.


## 2. Privacy decay

The ZAMA auction was private until the end, after which information about bids and balances could be easily back solved. This is actually by design, the auction needed to balance fairness when it came to settlement price with an anti-collusion mechanism to allow fair price discovery. But it exemplifies a pattern i think we will see over time with DeFi integrations of cTokens - privacy decays over time. 

Privacy decay comes from a simple concept - as more information about the system is created, it becomes easier to piece together the logical puzzle and trace balances. 

For users, they should know that nothing is forever. Be aware that your privacy may one day be leaked. If you're the last person to exit a dying cToken, we know you hold the entire total supply of that cToken, for example. 

But in general, we can conceptualize privacy as temporal. I suspect DeFi protocols will rely on this mechanism to get fairness in-the-moment when it comes to price discovery and front-running prevention, but as users enter and exit those systems, information about prices, trades or user actions will be made more clear. 

## 4. User behavior

As identified above, users aren't using the "proofed" versions of calls. Sadly, we cannot trust users. We, as developers, are experts for a reason. Ain't nobody got time to learn all this stuff.

We have a duty to get it right _for them_. Please, consider implementing UIs that only call "proofed" versions of different cToken functions. 

We can also see that users don't wait. Time is money, capital efficiency, all that junk. They want to take their cTokens out as fast as possible to go use them for something else. When they do this, they leak information about _everyone's_ balances. So, we should try our best to keep them in the cToken. Build a robust and parallel ecosystem so that they never have to leave.

And, we should shout over and over again about the importance of using proofs rather than known handles.

## 5. Privacy score

An interesting concept which came to mind during this project is a what i'll call a privacy score. The point of a privacy score is to be able to compare different situations and discover, overall, which one is more or less private. Once we have a privacy score metric that we like, we can begin doing things to increase that metric, and by doing so we should increase the probability of being untraceable.

For now, a first iteration of a privacy score could be this: `(num_total_handles - num_known_handles) / num_total_handles`. Since handles ARE the private information, this is the only place where privacy applies. For cTokens, the handles that are needed are balances and transfer amounts. So, we find all of these, and count them up - this is `num_total_handles`. Next, we try our best to solve for the values of these handles. Then, we count up how many we were able to definitively solve. This becomes `num_known_handles`. Now, we subtract this from total handles, to find the number of unknown handles. And boom! Thats our privacy score. 

This score is based on the simple notion that handles are the only thing that actually matters, in terms of privacy. And it gives us a wonderful mental model for increasing privacy - increase total handles, without making them solveable!

However, this isn't perfect. For example, i can create two accounts to spam transactions two each other all day long. But this siloed data doesn't meaningfully help other people's privacy. So, there's clearly some work to be done on improving this scoring method. 

There are some other privacy metrics i've considered, but didn't like as much. Perhaps a robust score combines these all together:
- **"Size of range"**: If a users balance is no greater than 10 tokens, i would argue their balance is less private than a user who's balance is no greater than 1000 tokens. So, perhaps `max_balance - min_balance` is a decent proxy for privacy. I don't like this because algebraically speaking, these balances may require the same number of logical steps to solve. These ranges also depend on capital, which is sorta unfair to the little guy.
- **"number of constraints"**: Using the algebraic method, we can describe every handle as some algebraic expression. The number of items in the summation, or constraints on the handle, may be a good privacy scoring mechanism. But i'm torn - does more constraints mean that a balance is _more_ or _less_ private? On the one hand, we have a more complicated set of equations to solve. On the other hand, there are more constraints, lowering the field of possible values some handle can actually represent.

I think scoring is a crucial, but very difficult problem to solve. A privacy score allows us to definitively say we have made a private system better! But, getting it right is imperative, and probably pretty difficult. 

## About the algebraic solution

The idea of an algebraic solver interests me, though it hasn't been built yet (by me). Thats the next goal of this project. Well, after cleaning up the spaghetti mess i've left on github.

An algebraic solver, because of the privacy decay problem, has the feature of cascading solves. An avalanche of data may be exposed by obtaining one key piece of information. An un-proofed withdrawal may expose balances in the past, and the balances or transaction amounts of anyone which that account has interacted with. 

An algebraic solver i think is the way to continue this project as it matches up excellently with the concept of handles. Every handle becomes an algebraic element, and we can begin building constraints as inequalities or equations while only referencing other handles and constant values. 

An algebraic solver has the unique challenge of exploding complexity. After each new handle is introduced, we must add it to the table, and then check its relationship to every other handle, potentially defining new constraints, and potentially solving older handles. And then this process repeats for every handle we solve. This is the cascade. Once we solve an old handle based on some newly acquired information, we must then see if that handle impacts other handles, and attempt to find and solve those handles. It becomes a daunting, recursive problem quickly. 

Maybe someone with more knowledge of graph theory can point me towards an elegant way of implementing a solver.


# Why?
Why did i do this? Simply because, someone nefarious out there is already doing it. But also, because we strengthen private systems by attempting to break them. I hope this can be educational and inform private development going forward.

### Other shit
<TODO> incorporate this

The auction was kinda a pain. There are lots of special functions in there that needed to be accounted for
At first it seemed like we could ignore most of the auction functions. After all, we knew how much people wrapped, and we knew the settlement price of the auction and how many ZAMA tokens were transferred. So, we can compute how much cUSDT they paid based on ZAMA price and ZAMA amount, and subtract that to get their balance. As long as they didn't transfer to anyone else, we can be sure of their balance. However, due to the sheer volume of data, we needed a way to classify the details of the auction to be sure we weren't missing something. This took a while. Classifying bids, bid cancellations, and ZAMA transfers after the auction took a while. In hindsight, this auction transaction classificiation could have been its own module. Going forward, if this project continues as the ZAMA ecosystem gets built out, it might benefit from having individual modules for classifying transactions related to different DeFi protocols. 
