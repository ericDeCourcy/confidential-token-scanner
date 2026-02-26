// cUSDT labels


function labelFromFuncSig(funcSig) {
    switch(funcSig) {
        case "0x1fad948c": return "HANDLE_OPS"; // pretty sure call from smart wallet
        case "0x2fb74e62": return "CONF_TRANSFER_W_PROOF";
        case "0x5bebed7e": return "CONF_TRANSFER";
        case "0x5bf4ef06": return "UNWRAP_W_PROOF"; 
        case "0x6a761202": return "GNOSIS_EXEC";  //Call from a gnosis safe
        case "0x6db28804": return "FINALIZE_REFUND";  // TODO What does this do?
        case "0x72b38ab9": return "REFUND_USER";    //From zama auction
        case "0x765e827f": return "HANLDE_OPS"; //TODO not sure what this does - looks like some acct abstration thing
        case "0x82ad56cb": return "AGGREGATE_MULTICALL"; //TODO what is this doing? Looks like one contract made a lot of these
        case "0xb191ca8a": return "???"; //Contract not labelled
        case "0xb780c362": return "EIP-7702-BATCH";
        case "0xbf376c7a": return "WRAP";
        case "0xcef6d209": return "REDEEM_DELEGATIONS"; //metamask GSN-like thing. Wrapper
        case "0xe8c15fd4": return "UNWRAP";
        case "0xe95495b1": return "BID_W_PROOF";
        case "0xfe0d94c1": return "MULTISIG_EXECUTE"; //multisig calling execute, usually doing a bunch of transfers
        default: return null;
    }
}
  
  module.exports = {
    labelFromFuncSig,
  };