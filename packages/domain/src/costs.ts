import Decimal from 'decimal.js';
type Row=Record<string,any>;
const sum=(values:any[])=>values.reduce<Decimal>((total,value)=>total.plus(String(value??0)),new Decimal(0));
/** Additional costs are separate from a documented base wine valuation. Never book these derived figures. */
export function costSummary(model:Record<string,Row[]>){
 const lots=model.lots.map(lot=>{
  const creation=model.ledger.filter(e=>e.lot_id===lot.id&&e.account==='stock'&&Number(e.quantity_l)>0&&['opening','harvest_transform','mix','produce'].includes(e.kind));
  const volume=sum(creation.map(e=>e.quantity_l));
  const base=volume.mul(lot.cost_per_l);
  const direct=(basis:string)=>sum(model.costs.filter(c=>c.lot_id===lot.id&&c.basis===basis).map(c=>c.amount));
  const allocated=(basis:string)=>sum(model.cost_allocations.filter(a=>a.lot_id===lot.id&&model.costs.find(c=>c.id===a.cost_id)?.basis===basis).map(a=>a.amount));
  const losses=sum(model.ledger.filter(e=>e.lot_id===lot.id&&['loss','sample'].includes(e.account)&&!['bottle','bottling_execute','bottling_execute_wine'].includes(e.kind)).map(e=>e.quantity_l));
  const usable=Decimal.max(volume.minus(losses),0),actual=base.plus(direct('actual')).plus(allocated('actual')),planned=base.plus(direct('planned')).plus(allocated('planned'));
  return {id:lot.id,code:lot.code,name:lot.name,produced_l:volume.toFixed(3),loss_l:losses.toFixed(3),base_wine_cost:base.toFixed(2),total_actual:actual.toFixed(2),total_planned:planned.toFixed(2),actual_per_l:usable.gt(0)?actual.div(usable).toFixed(6):null};
 });
 const bottlings=model.bottlings.map(b=>{
  const lot=lots.find(l=>l.id===b.lot_id),used=new Decimal(b.fill_l).mul(b.bottle_count).plus(b.loss_l);
  const base=lot?.actual_per_l===null||lot?.actual_per_l===undefined?null:used.mul(lot.actual_per_l);
  const extra=(basis:string)=>sum(model.costs.filter(c=>c.bottling_id===b.id&&c.basis===basis).map(c=>c.amount));
  const total=base?.plus(extra('actual'))??null;
  return {id:b.id,code:b.code,bottle_count:b.bottle_count,quantity_l:used.toFixed(3),base_wine_cost:base?.toFixed(2)??null,total_actual:total?.toFixed(2)??null,total_planned:base?.plus(extra('planned')).toFixed(2)??null,actual_per_bottle:total&&b.bottle_count?total.div(b.bottle_count).toFixed(6):null};
 });return {lots,bottlings};
}
