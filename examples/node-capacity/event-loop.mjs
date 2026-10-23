import { setImmediate as yieldTurn } from 'node:timers/promises';
const order = [];
setImmediate(() => order.push('immediate callback'));
async function calculate() {
  order.push('calculate start');
  let sum = 0;
  for (let n = 0; n < 10000; n += 1) sum += n;
  order.push(`calculate end:${sum}`);
  return sum;
}
const result = calculate();
order.push('caller received promise');
await result;
order.push('after await');
await yieldTurn();
order.push('after setImmediate');
console.log(order.join('\n'));
