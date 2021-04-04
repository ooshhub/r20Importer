/*let resultArr = [];
let style = 'color: orange; font-weight: bold; font-style: italic;'
let result0 = game.tables.entities.find(t=>/BSR-Finding-Petunia-On-Foot/i.test(t.name))?.roll().results?.[0]?.text||'(...table not found...)';
let result1 = game.tables.entities.find(t=>/BSR-Finding Petunia-Horseback/i.test(t.name))?.roll().results?.[0]?.text||'(...table not found...)';

let msg = ` After an hour of searching, the party ?{Mode of Travel|On Foot,<span style="${style}">${result0}</span>( ...from <span style="${style}">${result1}</span>( ...from @RollTable[BSR-Finding Petunia-Horseback] ) )|On Horseback,<span style="${style}">${result0}</span>( ...from <span style="${style}">${result1}</span>( ...from @RollTable[BSR-Finding Petunia-Horseback] ) )} Big Al's cow <b>@Actor[GXhk31OPiAMXh8rp]</b>. For more information, see <b><i>@JournalEntry[irWrFOdjVOanefYg]</b></i>. `;

let chatData = {content: msg};
//ChatMessage.create(chatData);*/


const petunia = {name: 'petunia-stuff', actionData: {whisper: true, foundryDesc: `After an hour of searching, the party ?{Mode of Travel|On Foot,@RollTable[BSR-Finding-Petunia-On-Foot]|On Horseback,@RollTable[BSR-Finding Petunia-Horseback]} Big Al's cow <b>@Actor[Petunia]</b>. For more information, see <b><i>@JournalEntry[B⁠utterskull Ranch]</b></i>. `}};

const constructScript = (input) => {
	let desc = input.actionData.foundryDesc;
	let scriptMacro, res, i = 0, diff;
	let rxRollTable = /@RollTable\[(.*?)\]/g;
	let varDecs = `let resultArr = [];\n
	let style = 'color: blue; background: white; padding-left: 7px; padding-right: 7px; border-radius: 5px; opacity: 0.7';\n`;

	console.log(`Running test on ${input?.name||'unnamed macro'}...`);

	if (!/@RollTable/.test(desc)) return;

	while ((res = rxRollTable.exec(desc)) !== null) {
        let tableName = res[1];
		let varName = `result${i}`;
		varDecs += `let ${varName} = game.tables.entities.find(t=>/${tableName}/i.test(t.name))?.roll().results?.[0]?.text||'(!BadResult!)';\n` //going to need to regex escape this;
        let replacer = `<span style="\${style}">\${${varName}}</span>(... rolled from ${res[0]})`;
		desc = desc.replace(res[0], replacer);
        diff = replacer.length - res[0].length;
        rxRollTable.lastIndex += diff;
		i++;
    }
	let getwhisperstuff = ["wm5GeeejP0vnqcWO", "9TEopVTGkv2gjvAn"];
	let gmIds = input.actionData.whisper ? getwhisperstuff : null;
	let gmStr = gmIds?.length ? `, type: 4, whisper: ['${gmIds.join(`','`)}']` : '';
	varDecs += `\nlet msg = \`${desc}\`;\n`;
	let scriptEnd = `let chatData = {content: msg${gmStr}};\nChatMessage.create(chatData);`;

	scriptMacro = `${varDecs}\n${scriptEnd}`;

	return (input.name, scriptMacro);
}

console.log(constructScript(petunia));