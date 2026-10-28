function echo(seconds: number): number {
 return seconds;
}

const raw: unknown = JSON.parse('"30"');
console.log(typeof echo(raw as number));
