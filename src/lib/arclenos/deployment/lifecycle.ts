import { randomUUID } from 'node:crypto';
import { encodeFunctionData, decodeFunctionResult, decodeEventLog, encodeAbiParameters, keccak256, toHex, type Hex, type Address } from 'viem';
import type { Database } from '../operations/queue.ts';
import { FACTORY_ABI, REGISTRY_ABI, MODULE_ABI, DeploymentError, nonzero, address, hash, same, verifiedCode, type Rpc, type FactoryConfig } from './chain.ts';
export interface PreparedDeployment {id:string;venture_id:string;state:string;factory:Address;creator:Address;template:Hex;version:number;user_salt:Hex;owner_address:Address;guardian_address:Address;parent_address:Address;implementation:Address;implementation_code_hash:Hex;config_hex:Hex;expected_address:Address;transaction_data:Hex;transaction_hash:Hex|null;approval_evidence:Record<string,unknown>;}
export interface PrepareInput {ventureId:string;creator:string;template:string;version:number;owner:string;guardian:string;parent:string;asset:string;cap:string;approvalReference:string}
function assertInput(input:PrepareInput) {
 if(!input||typeof input.ventureId!=='string'||input.ventureId.length>100||typeof input.approvalReference!=='string'||input.approvalReference.length<8||input.approvalReference.length>500||typeof input.cap!=='string'||!/^\d{1,78}$/.test(input.cap)||BigInt(input.cap)<=0n||BigInt(input.cap)>=2n**256n)throw new DeploymentError('Invalid deployment parameters or approval reference',400);
}
async function read(rpc:Rpc,to:Address,data:Hex,block='latest'){return await rpc('eth_call',[{to,data},block]) as Hex;}
export async function prepareDeployment(db:Database,rpc:Rpc,config:FactoryConfig,input:PrepareInput,actor:string) {
 assertInput(input);const existing=await db.query<PreparedDeployment>('SELECT * FROM deployment_requests WHERE venture_id=$1',[input.ventureId]);
 if(existing.length)return {deployment:existing[0],transaction:{chainId:'0x2105',from:existing[0].creator,to:existing[0].factory,data:existing[0].transaction_data,value:'0x0'},resumed:true};
 const [venture]=await db.query('SELECT simulation,security,composition,status FROM ventures WHERE id=$1',[input.ventureId]);
 if(!venture)throw new DeploymentError('Venture not found',404);
 if(!Array.isArray(venture.simulation)||!venture.simulation.length||!Array.isArray(venture.security)||!venture.composition)throw new DeploymentError('Simulation and security review evidence required');
 const findings=venture.security as Array<{severity:string;status:string}>;
 if(findings.some(f=>f.severity==='P0'&&f.status!=='mitigated'))throw new DeploymentError('Unresolved P0 findings prevent deployment');
 const creator=nonzero(input.creator),owner=nonzero(input.owner),guardian=nonzero(input.guardian),parent=address(input.parent),asset=nonzero(input.asset),template=hash(input.template);
 const policy=config.implementations.find(row=>same(row.template,template)&&row.version===input.version);
 if(!policy||!same(policy.asset,asset)||BigInt(input.cap)>BigInt(policy.maxCap))throw new DeploymentError('Template, asset or cap outside approved deployment policy',403);
 await verifiedCode(rpc,config.address,config.codeHash);
 const registry=decodeFunctionResult({abi:FACTORY_ABI,functionName:'registry',data:await read(rpc,config.address,encodeFunctionData({abi:FACTORY_ABI,functionName:'registry'}))});
 const implementation=decodeFunctionResult({abi:REGISTRY_ABI,functionName:'resolve',data:await read(rpc,registry,encodeFunctionData({abi:REGISTRY_ABI,functionName:'resolve',args:[template,input.version]}))});
 if(!same(implementation,policy.address))throw new DeploymentError('Registry implementation differs from approved manifest');
 await verifiedCode(rpc,implementation,policy.codeHash);
 const hasRole=decodeFunctionResult({abi:FACTORY_ABI,functionName:'hasRole',data:await read(rpc,config.address,encodeFunctionData({abi:FACTORY_ABI,functionName:'hasRole',args:[keccak256(toHex('DEPLOYER_ROLE')),creator]}))});
 if(!hasRole)throw new DeploymentError('Signing wallet lacks factory deployer role',403);
 const salt=keccak256(toHex(`ARCLENOS:${input.ventureId}:v1`));
 const expected=decodeFunctionResult({abi:FACTORY_ABI,functionName:'predict',data:await read(rpc,config.address,encodeFunctionData({abi:FACTORY_ABI,functionName:'predict',args:[template,input.version,creator,salt]}))});
 const configHex=encodeAbiParameters([{type:'address'},{type:'uint256'}],[asset,BigInt(input.cap)]);
 const data=encodeFunctionData({abi:FACTORY_ABI,functionName:'deploy',args:[template,input.version,salt,owner,guardian,parent,configHex]});
 const transaction={chainId:'0x2105',from:creator,to:config.address,data,value:'0x0'};
 // Simulate the exact unsigned transaction. No key is loaded and no transaction is broadcast.
 const simulated=await rpc('eth_call',[{from:creator,to:config.address,data,value:'0x0'},'latest']) as Hex;
 const returned=decodeFunctionResult({abi:FACTORY_ABI,functionName:'deploy',data:simulated});
 if(!same(returned,expected))throw new DeploymentError('Deployment simulation returned unexpected address');
 const id=randomUUID();const approval={actor,reference:input.approvalReference,asset,cap:input.cap,simulation:venture.simulation,security:venture.security,factoryCodeHash:config.codeHash,approvedAt:new Date().toISOString()};
 const rows=await db.query<PreparedDeployment>(`WITH inserted AS (INSERT INTO deployment_requests(id,venture_id,state,chain_id,factory,creator,template,version,user_salt,owner_address,guardian_address,parent_address,implementation,implementation_code_hash,config_hex,expected_address,transaction_data,approval_actor,approval_evidence)
 VALUES($1,$2,'DEPLOYMENT_PREPARED',8453,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)
 ON CONFLICT(venture_id) DO NOTHING RETURNING *), transition AS (INSERT INTO deployment_transitions(id,deployment_id,state,evidence)
 SELECT $18,id,'DEPLOYMENT_PREPARED',$17::jsonb FROM inserted RETURNING id) SELECT * FROM inserted`,[id,input.ventureId,config.address,creator,template,input.version,salt,owner,guardian,parent,implementation,policy.codeHash,configHex,expected,data,actor,JSON.stringify(approval),randomUUID()]);
 const deployment=rows[0]??(await db.query<PreparedDeployment>('SELECT * FROM deployment_requests WHERE venture_id=$1',[input.ventureId]))[0];
 return {deployment,transaction:{...transaction,from:deployment.creator,to:deployment.factory,data:deployment.transaction_data},resumed:!rows.length};
}
export async function bindSubmission(db:Database,rpc:Rpc,id:string,transactionHash:string) {
 const txHash=hash(transactionHash);const [deployment]=await db.query<PreparedDeployment>('SELECT * FROM deployment_requests WHERE id=$1',[id]);
 if(!deployment)throw new DeploymentError('Deployment not found',404);
 if(deployment.transaction_hash&&!same(deployment.transaction_hash,txHash))throw new DeploymentError('An existing transaction must be reconciled before replacement');
 const tx=await rpc('eth_getTransactionByHash',[txHash]) as {from:string;to:string;input:string;value:string;hash:string}|null;
 if(!tx)throw new DeploymentError('Transaction not yet available from verified Base RPC',202);
 if(!same(tx.hash,txHash)||!same(tx.from,deployment.creator)||!same(tx.to,deployment.factory)||!same(tx.input,deployment.transaction_data)||BigInt(tx.value)!==0n)throw new DeploymentError('Submitted transaction does not match approved deployment',403);
 const rows=await db.query(`WITH changed AS (UPDATE deployment_requests SET transaction_hash=$2,state='TRANSACTION_SUBMITTED',updated_at=now()
 WHERE id=$1 AND state='DEPLOYMENT_PREPARED' AND transaction_hash IS NULL RETURNING id),transition AS
 (INSERT INTO deployment_transitions(id,deployment_id,state,evidence) SELECT $3,id,'TRANSACTION_SUBMITTED',$4::jsonb FROM changed RETURNING id) SELECT * FROM changed`,[id,txHash,randomUUID(),JSON.stringify({transactionHash:txHash,from:tx.from,to:tx.to,inputVerified:true})]);
 return {id,transactionHash:txHash,state:rows.length?'TRANSACTION_SUBMITTED':deployment.state};
}
async function transition(db:Database,id:string,from:string,to:string,evidence:unknown) {
 const rows=await db.query(`WITH changed AS(UPDATE deployment_requests SET state=$3,evidence=$4::jsonb,error=NULL,updated_at=now() WHERE id=$1 AND state=$2 RETURNING id),
 logged AS(INSERT INTO deployment_transitions(id,deployment_id,state,evidence) SELECT $5,id,$3,$4::jsonb FROM changed ON CONFLICT(deployment_id,state) DO NOTHING RETURNING id) SELECT * FROM changed`,[id,from,to,JSON.stringify(evidence),randomUUID()]);
 return Boolean(rows.length);
}
export async function reconcileDeployment(db:Database,rpc:Rpc,config:FactoryConfig,id:string) {
 const [deployment]=await db.query<PreparedDeployment>('SELECT * FROM deployment_requests WHERE id=$1',[id]);
 if(!deployment)throw new DeploymentError('Deployment not found',404);
 if(!deployment.transaction_hash)throw new DeploymentError('Signing wallet must submit and register the prepared transaction');
 if(deployment.state==='CANARY')return {id,state:'CANARY',transactionHash:deployment.transaction_hash};
 if(!same(config.address,deployment.factory))throw new DeploymentError('Factory configuration changed; manual review required');
 await verifiedCode(rpc,config.address,config.codeHash);
 // Re-read the transaction at every reconciliation; callers cannot inject receipt metadata.
 const tx=await rpc('eth_getTransactionByHash',[deployment.transaction_hash]) as {from:string;to:string;input:string;value:string}|null;
 if(!tx||!same(tx.from,deployment.creator)||!same(tx.to,deployment.factory)||!same(tx.input,deployment.transaction_data)||BigInt(tx.value)!==0n)throw new DeploymentError('Approved transaction binding no longer verifies');
 const receipt=await rpc('eth_getTransactionReceipt',[deployment.transaction_hash]) as {status:string;transactionHash:string;blockHash:string;blockNumber:string;logs:Array<{address:Address;topics:Hex[];data:Hex}>}|null;
 if(!receipt)return {id,state:deployment.state,pending:true};
 if(!same(receipt.transactionHash,deployment.transaction_hash))throw new DeploymentError('Receipt transaction mismatch');
 if(receipt.status!=='0x1'){await transition(db,id,deployment.state,'FAILED',{reason:'Transaction reverted',transactionHash:deployment.transaction_hash});return {id,state:'FAILED'};}
 const block=await rpc('eth_getBlockByNumber',[receipt.blockNumber,false]) as {hash:string};
 const finalized=await rpc('eth_getBlockByNumber',['finalized',false]) as {number:string}|null;
 if(!same(block?.hash,receipt.blockHash))throw new DeploymentError('Receipt block is no longer canonical');
 if(!finalized||BigInt(finalized.number)<BigInt(receipt.blockNumber))return {id,state:deployment.state,pending:true,reason:'Waiting for Base finalized block'};
 const expectedSalt=keccak256(encodeAbiParameters([{type:'address'},{type:'bytes32'}],[deployment.creator,deployment.user_salt]));
 const match=receipt.logs.filter(log=>same(log.address,deployment.factory)).some(log=>{try{const event=decodeEventLog({abi:FACTORY_ABI,eventName:'VentureDeployed',topics:log.topics as [Hex,...Hex[]],data:log.data});return same(event.args.venture,deployment.expected_address)&&same(event.args.creator,deployment.creator)&&same(event.args.template,deployment.template)&&event.args.version===deployment.version&&same(event.args.salt,expectedSalt)&&same(event.args.configHash,keccak256(deployment.config_hex));}catch{return false;}});
 if(!match)throw new DeploymentError('Expected factory deployment event missing or mismatched');
 const evidence={transactionHash:deployment.transaction_hash,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,finalizedBlock:finalized.number,address:deployment.expected_address,eventVerified:true};
 await transition(db,id,'TRANSACTION_SUBMITTED','TRANSACTION_CONFIRMED',evidence);
 await verifiedCode(rpc,deployment.implementation,deployment.implementation_code_hash,receipt.blockNumber);
 const clone=await rpc('eth_getCode',[deployment.expected_address,receipt.blockNumber]);
 const expectedClone=`0x363d3d373d3d3d363d73${deployment.implementation.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3`;
 if(!same(clone,expectedClone))throw new DeploymentError('Deployed clone bytecode differs from approved implementation');
 await transition(db,id,'TRANSACTION_CONFIRMED','BYTECODE_VERIFIED',{...evidence,codeHash:keccak256(clone as Hex)});
 const [owner,guardian,initialized,asset,cap]=await Promise.all((['owner','guardian','initialized','asset','cap'] as const).map(async functionName=>decodeFunctionResult({abi:MODULE_ABI,functionName,data:await read(rpc,deployment.expected_address,encodeFunctionData({abi:MODULE_ABI,functionName}),receipt.blockNumber)})));
 if(!same(owner,deployment.owner_address)||!same(guardian,deployment.guardian_address)||initialized!==true||!same(asset,deployment.approval_evidence.asset)||String(cap)!==deployment.approval_evidence.cap)throw new DeploymentError('Initialization postconditions did not verify');
 const initialization={owner,guardian,initialized,asset,cap:String(cap)};
 await transition(db,id,'BYTECODE_VERIFIED','INITIALIZATION_VERIFIED',{...evidence,initialization});
 // Manifest persistence and CANARY publication share one statement and transaction.
 await db.query(`WITH manifest AS (INSERT INTO deployment_manifests(id,deployment_id,chain_id,address,transaction_hash,code_hash,implementation,implementation_code_hash,abi_reference,initialization,authorities,evidence)
 VALUES($1,$2,8453,$3,$4,$5,$6,$7,'contracts/src/ArclenosFactory.sol:VentureDeployed',$8::jsonb,$9::jsonb,$10::jsonb)
 ON CONFLICT(deployment_id) DO NOTHING RETURNING id), published AS(UPDATE deployment_requests SET state='CANARY',evidence=$10::jsonb,updated_at=now() WHERE id=$2 AND state='INITIALIZATION_VERIFIED' RETURNING venture_id),
 logged AS(INSERT INTO deployment_transitions(id,deployment_id,state,evidence) SELECT $11,$2,'CANARY',$10::jsonb FROM published ON CONFLICT(deployment_id,state) DO NOTHING RETURNING id)
 UPDATE ventures SET status='CANARY',risk_status='bounded-onchain-canary',lineage=lineage || $12::jsonb,updated_at=now() WHERE id IN(SELECT venture_id FROM published)`,[randomUUID(),id,deployment.expected_address,deployment.transaction_hash,keccak256(clone as Hex),deployment.implementation,deployment.implementation_code_hash,JSON.stringify(initialization),JSON.stringify({owner,guardian,creator:deployment.creator}),JSON.stringify(evidence),randomUUID(),JSON.stringify({chainId:8453,address:deployment.expected_address,transactionHash:deployment.transaction_hash,manifestDeploymentId:id})]);
 const [current]=await db.query<{state:string}>('SELECT state FROM deployment_requests WHERE id=$1',[id]);
 return {id,state:current.state,...evidence,initialization};
}
