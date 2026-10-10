import Decimal from 'decimal.js';
Decimal.set({precision:50});

export type Source = {
  id: string; volume: string; available: string; cost: string;
  alcohol: string | null; unit: string | null; method: string | null; blocked: boolean;
};
export type Blend = {
  volume: string; cost: string; costPerLiter: string;
  alcohol: string | null; model: 'volume-weighted-v1';
  estimated: true; ph: null; samples: { id: string; ml: string }[];
};
const decimal = (value: string) => {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error('INVALID_DECIMAL');
  const result = new Decimal(value);
  if (!result.isFinite()) throw new Error('INVALID_DECIMAL');
  return result;
};

/** Planning only. No reservation, stock mutation, pH or sensory prediction. */
export function planBlend(sources: Source[], sampleMl = '250'): Blend {
  const used = sources.filter(s => !decimal(s.volume).isZero());
  if (!used.length) throw new Error('EMPTY_RECIPE');
  if (new Set(used.map(s => s.id)).size !== used.length) throw new Error('DUPLICATE_SOURCE');
  const volumes = used.map(s => decimal(s.volume));
  const total = volumes.reduce((a, b) => a.plus(b), new Decimal(0));
  const sample = decimal(sampleMl);
  if (sample.isZero()) throw new Error('INVALID_SAMPLE');
  used.forEach((s, i) => {
    if (s.blocked) throw new Error('BLOCKED_SOURCE');
    if (volumes[i].greaterThan(decimal(s.available))) throw new Error('INSUFFICIENT_STOCK');
  });
  const cost = used.reduce((sum, s, i) => sum.plus(volumes[i].times(decimal(s.cost))), new Decimal(0));
  const comparable = used.every(s => s.alcohol !== null && s.method !== null && s.method === used[0].method && s.unit!==null && s.unit === used[0].unit);
  const alcohol = comparable
    ? used.reduce((sum, s, i) => sum.plus(volumes[i].times(decimal(s.alcohol!))), new Decimal(0)).div(total).toFixed(2)
    : null;
  let remaining = sample;
  const samples = used.map((s, i) => {
    const ml = i === used.length - 1 ? remaining : volumes[i].div(total).times(sample).toDecimalPlaces(2, Decimal.ROUND_DOWN);
    remaining = remaining.minus(ml);
    return { id: s.id, ml: ml.toFixed(2) };
  });
  return { volume: total.toFixed(3), cost: cost.toFixed(2), costPerLiter: cost.div(total).toFixed(2), alcohol,
    model: 'volume-weighted-v1', estimated: true, ph: null, samples };
}
