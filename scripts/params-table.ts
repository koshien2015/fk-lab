/**
 * README に載せる、物理パラメータの一覧表（Markdown）を出力する。
 * `node scripts/params-table.ts` で実行する。
 */
import { PARAM_DEFS } from '../src/physics/params.ts';

const format = (value: number): string =>
  Math.abs(value) >= 1e4 || (Math.abs(value) < 1e-3 && value !== 0) ? value.toExponential(1) : String(value);

console.log('| パラメータ | 値 | 単位 | 仮定値か | 備考 |');
console.log('|---|---|---|---|---|');
for (const def of Object.values(PARAM_DEFS)) {
  console.log(
    `| ${def.label} | ${format(def.value)} | ${def.unit || '–'} | ${def.assumed ? '仮定値' : '規格・物性値'} | ${def.note} |`,
  );
}
