import { BASE, COMMERCE_SKUS } from "./catalog";
export const USDC_BASE = BASE.tokens.usdc.address;
export function skuById(id: string) { return COMMERCE_SKUS.find(s => s.id === id) ?? null; }
export function usdcAtomic(usdc: string): string {
 if (!/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(usdc)) throw new Error('Invalid USDC decimal');
 const [whole, fraction = ''] = usdc.split('.');
 return String(BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, '0')));
}
export function buildX402Requirement(input: {skuId:string;payTo:string|null;resourceOrigin:string}) {
 const sku=skuById(input.skuId);
 if(!sku)return {requirement:null,blocked:'Unknown SKU.',sku:null};
 if(!input.payTo||!/^0x[0-9a-fA-F]{40}$/.test(input.payTo)||/^0x0{40}$/i.test(input.payTo))return{sku,requirement:null,blocked:'Valid founder-authorized treasury recipient required.'};
 const resource=new URL(sku.resource,input.resourceOrigin).href;
 return{sku,blocked:null,requirement:{x402Version:2 as const,resource:{url:resource,description:sku.description,mimeType:'application/json'},accepts:[{scheme:'exact' as const,network:'eip155:8453' as const,amount:usdcAtomic(sku.usdc),payTo:input.payTo,maxTimeoutSeconds:300,asset:USDC_BASE,extra:{name:'USD Coin',version:'2'}}]}};
}
