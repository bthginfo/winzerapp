import Decimal from 'decimal.js';
import solver from 'javascript-lp-solver';
export type PlanningSource={id:string;available:string;cost:string;blocked:boolean;measurements:Record<string,{value:string;unit:string;method:string}|null>};
export type PlanningTarget={id:string;volume:string;budget?:string;shares:Record<string,{minimum:string;maximum:string}>;parameters:Record<string,{minimum:string;maximum:string;unit:string;method:string}>};
export type Candidate={objective:'cost'|'targets'|'remainders';plans:{id:string;components:{position_id:string;quantity_l:string}[];cost:string;estimates:Record<string,string>}[];remainders:{id:string;quantity_l:string}[];totalCost:string;estimated:true;ph:null;model:'milp-ml-v1'};
const D=(s:string)=>{if(!/^(0|[1-9]\d*)(\.\d+)?$/.test(s))throw new Error('INVALID_DECIMAL');const d=new Decimal(s);if(!d.isFinite())throw new Error('INVALID_DECIMAL');return d;};
/** Independently validates a numerical solver result using decimal arithmetic. Never books or reserves stock. */
export function validateCandidate(candidate:Candidate,sources:PlanningSource[],targets:PlanningTarget[]):void{
 if(candidate.plans.length!==targets.length)throw new Error('INVALID_SOLUTION');
 const consumed=new Map<string,Decimal>();
 for(const target of targets){const plan=candidate.plans.find(p=>p.id===target.id);if(!plan)throw new Error('INVALID_SOLUTION');let volume=new Decimal(0),cost=new Decimal(0);const values:Record<string,Decimal>={};
  if(new Set(plan.components.map(c=>c.position_id)).size!==plan.components.length)throw new Error('INVALID_SOLUTION');
  for(const component of plan.components){const source=sources.find(s=>s.id===component.position_id);if(!source||source.blocked)throw new Error('BLOCKED_SOURCE');const q=D(component.quantity_l);volume=volume.plus(q);cost=cost.plus(q.times(D(source.cost)));consumed.set(source.id,(consumed.get(source.id)??new Decimal(0)).plus(q));
   for(const [parameter,range] of Object.entries(target.parameters)){if(!['alcohol','sugar','acidity'].includes(parameter))throw new Error('NON_LINEAR_PARAMETER');const m=source.measurements[parameter];if(!m||m.unit!==range.unit||m.method!==range.method)throw new Error('INCOMPATIBLE_ANALYSIS');values[parameter]=(values[parameter]??new Decimal(0)).plus(q.times(D(m.value)));}
  }
  if(!volume.eq(D(target.volume)))throw new Error('TARGET_VOLUME_UNMET');if(target.budget&&cost.gt(D(target.budget)))throw new Error('BUDGET_EXCEEDED');
  for(const source of sources){const share=target.shares[source.id];if(!share)continue;const q=D(plan.components.find(c=>c.position_id===source.id)?.quantity_l??'0').times(100);if(q.lt(volume.times(D(share.minimum)))||q.gt(volume.times(D(share.maximum))))throw new Error('SHARE_LIMIT_UNMET');}
  for(const [parameter,range] of Object.entries(target.parameters)){const value=values[parameter];if(!value||value.lt(volume.times(D(range.minimum)))||value.gt(volume.times(D(range.maximum))))throw new Error('ANALYTICAL_TARGET_UNMET');}
 }
 for(const source of sources){if((consumed.get(source.id)??new Decimal(0)).gt(D(source.available)))throw new Error('SHARED_STOCK_EXCEEDED');}
}
export function optimizeBlends(sources:PlanningSource[],targets:PlanningTarget[]):{candidates:Candidate[];issues:string[]}{
 if(!sources.length||sources.length>20||!targets.length||targets.length>5||new Set(sources.map(s=>s.id)).size!==sources.length||new Set(targets.map(t=>t.id)).size!==targets.length)throw new Error('PLANNING_SIZE_INVALID');
 for(const t of targets){if(D(t.volume).lte(0)||D(t.volume).times(1000).gt(1000000000))throw new Error('PLANNING_SIZE_INVALID');for(const [parameter,r] of Object.entries(t.parameters)){if(!['alcohol','sugar','acidity'].includes(parameter))throw new Error('NON_LINEAR_PARAMETER');if(D(r.minimum).gt(D(r.maximum)))throw new Error('INVALID_RANGE');}for(const r of Object.values(t.shares)){if(D(r.minimum).gt(D(r.maximum))||D(r.maximum).gt(100))throw new Error('INVALID_RANGE');}}
 const issues:string[]=[],candidates:Candidate[]=[];
 for(const objective of ['cost','targets','remainders'] as const){
  const model:any={optimize:'objective',opType:'min',constraints:{},variables:{},ints:{},binaries:{},options:{timeout:1500,tolerance:0}};
  for(const [i,s] of sources.entries()){const available=D(s.available).times(1000).floor().toNumber();model.constraints['stock_'+i]={max:s.blocked?0:available};if(objective==='remainders'&&available>0){model.constraints['remaining_'+i]={min:available};model.variables['left_'+i]={objective:1,['remaining_'+i]:available};model.binaries['left_'+i]=1;}}
  for(const [j,t] of targets.entries()){
   const targetMl=D(t.volume).times(1000).toNumber();model.constraints['volume_'+j]={equal:targetMl};if(t.budget)model.constraints['budget_'+j]={max:D(t.budget).toNumber()};
   for(const [parameter,r] of Object.entries(t.parameters)){model.constraints['min_'+j+'_'+parameter]={min:D(r.minimum).times(targetMl).toNumber()};model.constraints['max_'+j+'_'+parameter]={max:D(r.maximum).times(targetMl).toNumber()};
    if(objective==='targets'){const center=D(r.minimum).plus(D(r.maximum)).div(2).times(targetMl).toNumber();model.constraints['center_'+j+'_'+parameter]={equal:center};model.variables['low_'+j+'_'+parameter]={objective:1/targetMl,['center_'+j+'_'+parameter]:1};model.variables['high_'+j+'_'+parameter]={objective:1/targetMl,['center_'+j+'_'+parameter]:-1};}
   }
   for(const [i,s] of sources.entries()){
    const variable='v_'+j+'_'+i;const coeff:Record<string,number>={objective:objective==='cost'?D(s.cost).div(1000).toNumber():D(s.cost).div(1000000000).toNumber(),['volume_'+j]:1,['stock_'+i]:1};if(objective==='remainders')coeff['remaining_'+i]=1;if(t.budget)coeff['budget_'+j]=D(s.cost).div(1000).toNumber();
    const share=t.shares[s.id];if(share){model.constraints['share_'+j+'_'+i]={min:D(share.minimum).times(targetMl).div(100).ceil().toNumber(),max:D(share.maximum).times(targetMl).div(100).floor().toNumber()};coeff['share_'+j+'_'+i]=1;}
    let usable=!s.blocked;
    for(const [parameter,r] of Object.entries(t.parameters)){const m=s.measurements[parameter];if(!m||m.unit!==r.unit||m.method!==r.method){usable=false;issues.push('INCOMPATIBLE_ANALYSIS: '+s.id+' / '+parameter);continue;}coeff['min_'+j+'_'+parameter]=D(m.value).toNumber();coeff['max_'+j+'_'+parameter]=D(m.value).toNumber();if(objective==='targets')coeff['center_'+j+'_'+parameter]=D(m.value).toNumber();}
    if(!usable){model.constraints['unusable_'+j+'_'+i]={max:0};coeff['unusable_'+j+'_'+i]=1;}model.variables[variable]=coeff;model.ints[variable]=1;
   }
  }
  const rawSolution=solver.Solve(model);if(!rawSolution||typeof rawSolution!=='object')throw new Error('INVALID_SOLUTION');const solution=rawSolution as Record<string,unknown>;if(!solution.feasible||!solution.bounded){issues.push('NO_FEASIBLE_SOLUTION: '+objective);continue;}
  const consumed=new Map<string,Decimal>();let totalCost=new Decimal(0);
  const plans=targets.map((t,j)=>{const components=sources.flatMap((s,i)=>{const raw=solution['v_'+j+'_'+i]??0;if(typeof raw!=='number'||!Number.isFinite(raw)||Math.abs(raw-Math.round(raw))>0.00001)throw new Error('INVALID_SOLUTION');const q=new Decimal(Math.round(raw)).div(1000);if(q.lte(0))return [];consumed.set(s.id,(consumed.get(s.id)??new Decimal(0)).plus(q));return [{position_id:s.id,quantity_l:q.toFixed(3)}];});const cost=components.reduce((a,c)=>a.plus(D(c.quantity_l).times(D(sources.find(s=>s.id===c.position_id)!.cost))),new Decimal(0));totalCost=totalCost.plus(cost);const estimates=Object.fromEntries(Object.keys(t.parameters).map(p=>[p,components.reduce((a,c)=>a.plus(D(c.quantity_l).times(D(sources.find(s=>s.id===c.position_id)!.measurements[p]!.value))),new Decimal(0)).div(D(t.volume)).toFixed(3)]));return {id:t.id,components,cost:cost.toFixed(2),estimates};});
  const candidate:Candidate={objective,plans,remainders:sources.map(s=>({id:s.id,quantity_l:D(s.available).minus(consumed.get(s.id)??0).toFixed(3)})),totalCost:totalCost.toFixed(2),estimated:true,ph:null,model:'milp-ml-v1'};
  try{validateCandidate(candidate,sources,targets);if(!candidates.some(c=>JSON.stringify(c.plans)===JSON.stringify(candidate.plans)))candidates.push(candidate);}catch(cause){issues.push(cause instanceof Error?cause.message:'INVALID_SOLUTION');}
 }
 return {candidates,issues:[...new Set(issues)]};
}
