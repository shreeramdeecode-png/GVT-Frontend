import React, { useMemo } from 'react';
import { Package } from 'lucide-react';

/**
 * Mirrors backend Stage 2 excess stock: total picked kg − order net_weight, split by vendor share.
 */
export function computeExpectedExcessStock(productRows) {
  if (!productRows?.length) return [];

  const byOiid = {};
  productRows.forEach((row) => {
    const oiid = String(row.oiid);
    if (!byOiid[oiid]) {
      byOiid[oiid] = {
        product: row.product,
        netWeight: parseFloat(row.net_weight) || 0,
        vendors: [],
      };
    }
    const pickedWeight = parseFloat(row.pickedWeight);
    const pickedKg =
      Number.isFinite(pickedWeight) && pickedWeight > 0
        ? pickedWeight
        : parseFloat(row.pickedQuantity) || 0;
    const wastage = parseFloat(row.wastage) || 0;
    const revisedPicked = Math.max(0, pickedKg - wastage);

    byOiid[oiid].vendors.push({
      entityName: row.entityName || '—',
      entityType: row.entityType || '',
      revisedPicked,
    });
  });

  return Object.values(byOiid).map((group) => {
    const totalRevisedKg = group.vendors.reduce((sum, v) => sum + v.revisedPicked, 0);
    const excessKg = Math.max(0, totalRevisedKg - group.netWeight);
    const allocations = group.vendors.map((v) => ({
      entityName: v.entityName,
      entityType: v.entityType,
      stockKg:
        excessKg > 0.01 && totalRevisedKg > 0.01
          ? parseFloat((excessKg * (v.revisedPicked / totalRevisedKg)).toFixed(2))
          : 0,
    }));
    const totalStockKg = allocations.reduce((sum, a) => sum + a.stockKg, 0);

    return {
      product: group.product,
      netWeight: group.netWeight,
      totalRevisedKg: parseFloat(totalRevisedKg.toFixed(2)),
      excessKg: parseFloat(excessKg.toFixed(2)),
      totalStockKg: parseFloat(totalStockKg.toFixed(2)),
      allocations,
    };
  });
}

export function formatExcessStockSaveMessage(preview) {
  const withStock = (preview || []).filter((p) => p.totalStockKg > 0.01);
  if (!withStock.length) {
    return 'Stage 2 saved. No excess stock (picked kg must be above order net weight per product).';
  }
  const lines = withStock.map((p) => {
    const parts = p.allocations
      .filter((a) => a.stockKg > 0.01)
      .map((a) => `${a.entityName}: ${a.stockKg} kg`)
      .join(', ');
    return `${p.product}: ${p.totalStockKg} kg → ${parts || 'stock'}`;
  });
  return `Stage 2 saved. Stock added:\n${lines.join('\n')}`;
}

export default function Stage2ExcessStockPreview({ productRows }) {
  const preview = useMemo(() => computeExpectedExcessStock(productRows), [productRows]);
  const withStock = preview.filter((p) => p.totalStockKg > 0.01);
  const noExcess = preview.filter((p) => p.totalRevisedKg > 0.01 && p.totalStockKg <= 0.01);

  if (!preview.length) return null;

  return (
    <div className="mb-6 rounded-xl border-2 border-amber-200 bg-amber-50/80 p-4">
      <div className="flex items-start gap-3">
        <Package className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-amber-900">Expected stock after save</h3>
          <p className="text-xs text-amber-800 mt-1">
            Excess bought = total picked kg − order net weight (same rule as Stock Management).
          </p>

          {withStock.length > 0 && (
            <ul className="mt-3 space-y-2">
              {withStock.map((p) => (
                <li
                  key={p.product}
                  className="text-sm text-amber-950 bg-white/70 rounded-lg px-3 py-2 border border-amber-100"
                >
                  <span className="font-semibold">{p.product}</span>
                  <span className="text-amber-800">
                    {' '}
                    — picked {p.totalRevisedKg} kg, order {p.netWeight} kg →{' '}
                    <span className="font-bold text-emerald-700">{p.totalStockKg} kg</span> to stock
                  </span>
                  {p.allocations.some((a) => a.stockKg > 0.01) && (
                    <div className="text-xs text-gray-600 mt-1">
                      {p.allocations
                        .filter((a) => a.stockKg > 0.01)
                        .map((a) => `${a.entityName}: ${a.stockKg} kg`)
                        .join(' · ')}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {noExcess.length > 0 && (
            <ul className="mt-2 space-y-1">
              {noExcess.map((p) => (
                <li key={`none-${p.product}`} className="text-xs text-amber-700">
                  {p.product}: no excess (picked {p.totalRevisedKg} kg ≤ order {p.netWeight} kg) — nothing
                  added to stock
                </li>
              ))}
            </ul>
          )}

          {withStock.length === 0 && noExcess.length === 0 && (
            <p className="text-xs text-amber-700 mt-2">Enter picked weight on Stage 2 to see expected stock.</p>
          )}
        </div>
      </div>
    </div>
  );
}
