import Decimal from 'decimal.js';
export type RangeRule={parameter:'alcohol'|'sugar'|'acidity'|'ph'|'free_so2';unit:string;method:string;minimum:string;maximum:string;maxAgeDays:number};
export type RuleInput={asOf:string;values:Record<string,{value:string;unit:string;method:string;measuredAt:string}|null>;grape:string|null;vintage:number|null;originKnown:boolean};
export type RuleSet={validFrom:string;validTo:string;ranges:RangeRule[];grapes:string[];vintages:number[];requireKnownOrigin:boolean};
export function evaluateRules(rules:RuleSet,input:RuleInput){const findings:{parameter:string;status:'passed'|'failed'|'unknown';source:string}[]=[];const day=input.asOf.slice(0,10);
 if(day<rules.validFrom||day>rules.validTo)findings.push({parameter:'validity',status:'unknown',source:day});
 for(const range of rules.ranges){const value=input.values[range.parameter];if(!value||value.unit!==range.unit||value.method!==range.method||Date.parse(input.asOf)-Date.parse(value.measuredAt)>range.maxAgeDays*86400000||Date.parse(value.measuredAt)>Date.parse(input.asOf)){findings.push({parameter:range.parameter,status:'unknown',source:value?.measuredAt??'missing'});continue;}const measured=new Decimal(value.value);findings.push({parameter:range.parameter,status:measured.gte(range.minimum)&&measured.lte(range.maximum)?'passed':'failed',source:value.measuredAt});}
 if(rules.grapes.length)findings.push({parameter:'grape',status:!input.grape?'unknown':rules.grapes.includes(input.grape)?'passed':'failed',source:input.grape??'missing'});
 if(rules.vintages.length)findings.push({parameter:'vintage',status:input.vintage===null?'unknown':rules.vintages.includes(input.vintage)?'passed':'failed',source:String(input.vintage)});
 if(rules.requireKnownOrigin)findings.push({parameter:'origin',status:input.originKnown?'passed':'unknown',source:'actual lineage'});
 const outcome=findings.some(f=>f.status==='failed')?'failed':findings.length&&findings.every(f=>f.status==='passed')?'passed':'unknown';return {outcome,findings};
}
