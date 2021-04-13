let wallDialog = new Dialog({
	title: "Test Bar",
	content: `<div class="import progress" id="myProgress"><div class="import progress" id="myBar"></div></div><hr><div id="toast" class="import progress"><span>Tickling Dragons...</span></div>`,
	buttons: {   /*                
		one: {
			icon: '<i class="fas fa-check"></i>',
			label: "Option One",
			callback: (ev) => {CONFIG.OOSHR20I.PROGRESS ++; console.log(ev);}
		},
		two: {
			icon: '<i class="fas fa-times"></i>',
			label: "Option Two",
			callback: () => console.log("Chose Two")
		}*/
	},
	//default: "Progress",
	render: () => move(),
	close: html => console.log("This always is logged no matter which option is chosen")
});


