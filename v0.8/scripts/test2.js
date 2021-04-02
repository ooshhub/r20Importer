let var2 = ['OriginalStringddd'];
let varName = ['bop'];
let diff;

const rx = /\|\|\|/g

let replacerCount = `<span style="\${style}">\${${varName}}</span>(... rolled from ${var2})`.length;
let replacedCount = `<span style="\${style}">\${bop}</span>(... rolled from OriginalStringddd)`.length;

let replacer = `<span style="\${style}">\${${varName}}</span>(... rolled from ${var2})`;

let desc = `Some text goes here and ||| that would be the replacer`
let newDesc = desc;

let res;

while ((res = rx.exec(newDesc)) !== null) {
	console.log(`match found: ${res[0]}, index: ${rx.lastIndex}`);
	newDesc = newDesc.replace(res[0], replacer);
	diff = replacerCount - res[0].length;
	rx.lastIndex += diff;
	console.log(newDesc.slice(rx.lastIndex-10, rx.lastIndex));
}

console.log(`Original desc count: ${desc.length}, replacer: ${replacerCount}, replaced: ${replacedCount}`);