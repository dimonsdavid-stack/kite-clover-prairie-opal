import { NETWORK, USDC, type Purchase, type Settlement } from './core.ts';
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
type Rpc=(method:string,params:unknown[])=>Promise<unknown>;
export async function confirmUsdcSettlement(rpc:Rpc,settlement:Settlement,purchase:Purchase){
 if(!settlement.success||settlement.network!==NETWORK||!/^0x[0-9a-fA-F]{64}$/.test(settlement.transaction)||settlement.payer?.toLowerCase()!==purchase.payer)throw new Error('Settlement mismatch');
 if(await rpc('eth_chainId',[])!=='0x2105')throw new Error('Wrong chain');
 const receipt=await rpc('eth_getTransactionReceipt',[settlement.transaction]) as {status:string;transactionHash:string;blockNumber:string;blockHash:string;logs:{address:string;topics:string[];data:string;removed?:boolean}[]}|null;
 if(!receipt||receipt.status!=='0x1'||receipt.transactionHash.toLowerCase()!==settlement.transaction.toLowerCase())throw new Error('Transaction unconfirmed');
 const block=await rpc('eth_getBlockByNumber',['safe',false]) as {number:string}|null;
 if(!block||BigInt(block.number)<BigInt(receipt.blockNumber))throw new Error('Await safe block');
 const canonical=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]) as {hash:string}|null;
 if(canonical?.hash!==receipt.blockHash)throw new Error('Noncanonical receipt');
 const amount=receipt.logs.filter(l=>!l.removed&&l.address.toLowerCase()===USDC.toLowerCase()&&l.topics.length===3&&l.topics[0]===TRANSFER&&l.topics[1].slice(-40).toLowerCase()===purchase.payer.slice(2)&&l.topics[2].slice(-40).toLowerCase()===purchase.requirement.payTo.slice(2).toLowerCase()).reduce((sum,l)=>sum+BigInt(l.data),0n);
 if(amount!==BigInt(purchase.amount))throw new Error('USDC transfer mismatch');
 return {chainId:8453,transaction:receipt.transactionHash,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,confirmation:'safe',grossAtomic:amount.toString(),netAtomic:null,networkCostAtomic:null,feeAllocation:'unreconciled',source:'independent_rpc_receipt_and_usdc_transfer'};
}
