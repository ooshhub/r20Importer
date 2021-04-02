const floppy = async () => {
	let bob = new Promise(res => setTimeout(() => res(console.log('flop')), 3000));
	let alice = new Promise(res => setTimeout(() => res(console.log('faecal')), 5000));
	await Promise.all([alice, bob]).then(() => console.log('poot'))
}

floppy()