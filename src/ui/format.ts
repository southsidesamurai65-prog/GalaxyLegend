/** 把 300000 显示成 30W，避免护盾/伤害数字撑爆卡片。 */
export function formatCompact(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  if (abs >= 10000) {
    const tenThousands = rounded / 10000;
    return `${Number.isInteger(tenThousands) ? tenThousands : tenThousands.toFixed(1)}W`;
  }
  return `${rounded}`;
}
