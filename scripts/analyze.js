

// TODO how do we analyze?

/**
 * From each tx, create a range of possible balances...
 *      this will need to handle all possible actions
 *          WRAP
 *          CONF_TRANSFER_W_PROOF
 *          CONF_TRANSFER (no proof)
 *          BID
 *          UNWRAP   --> If this is the encrypted balance before, then we know their balance is zero
 *          UNWRAP_W_PROOF   --> if proof matches some other handle, we can link them
 * 
 * --> From each tx, create new DB with following figures
 *      
 *      {
 *          txhash, 
 *          blockNum, 
 *          account, 
 *          new-balance-range, 
 *              TODO: should we just try to figure out the values of different FHE handles and go from there?
 *          handle(s) {possibly more than one handle? #TODO see if this is easily searchable},
 *              TODO: not sure if these are needed if we have "notes"
 *          "notes" - these are potential balance changes, and i guess would also have handles associated with them. We can symbolically construct balances as
 *              - balance = {input 1 + input 2 +... - (output1 + output2 + ...) }
 *                  ins/outs can either be given their own tag or likely, some handle 
 *              - would there just be one "note" per transaction?
 *              - could notes be better represented as a tuple {previous handle, new handle}?
 *          output range constraints 
 *              - this will allow us to solve backwards - we can limit output ranges 
 *          event/action 
 *      }
 * 
 *      A single event can be multiple entries, this will mean that multiple balances were updated. They can be grouped together sequentially using block number
 *          #TODO Will we need to check event indexes to order these? Ordering WILL matter
 *      
 * 
 * Actual analysis of data
 *      #TODO how do we compute balance ranges
 *          - Wrap is easy - range{low,high} => {low+wrapped_amount, high+wrapped_amount}
 *              produces one note: input1 which is known for a user. there may or may not be a handle associated with this
 *                  handle definitely if going from 0 to known value
 *                  may not have handle if increasing unknown value - may be better to id previous value
*                       could be uniquely represented by a tuple of previous euint, new euint
 *          - Bid -> range unchanged, reciever range { ,++high of bidder}
 *          - transfer -> sender range unchanged, reciever ++high of sender
 *          - 
 *          
 * 
 * 
 * 
 * 
 * 
 * 
 */
