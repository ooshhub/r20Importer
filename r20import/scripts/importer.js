/* globals Scene, readTextFromFile, JournalEntry, Macro, RollTable, CONFIG */
// import utils & helpers
import Intro from './silly.js';
import H from './helpers.js';
import OGL5e from './5eogl.js';

export default class R20Importer {

	static rx = {
		uuid: /[a-zA-Z0-9]{16}/,
		classes: /(artificer|barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard)/i,
		damageTypes: /(acid|bludgeoning|cold|fire|force|lightning|necrotic|physical|piercing|poison|psychic|radiant|slashing|thunder)/ig,
		conditions: /(Hblinded|charmed|deafened|diseased|exhaustion|frightened|grappled|incapacitated|invisible|paralyzed|petrified|poisoned|prone|restrained|stunned|unconscious)/ig,
	}
	
	static compendium = {
		names: {
			creatures: 'world.creatures-oosh', // change this to menu setting
			spells: 'world.spells-oosh',
			items: 'world.items-oosh',
			backgrounds: 'world.character-backgrounds-oosh'
		},
		packs: {
			npcData: {},
			spellData: {},
			itemData: {},
			backgroundData: {}
		}
	}

	static defaults = {
		abilities: ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'],
		folders: {
			classes: 'Classes',
			subclasses: 'Classes',
			classFeatures: 'Class Features',
			race: 'Races',
			raceFeatures: 'Race Features',
		}
	}

    static directory = {
		characterLinks: [],
		handoutLinks: [],
		lightSources: [],
		folderEntries: {},
		r20characters: [],
	};

    static importConfig = {
		images: "remote",
		ogl5e: false,
		totalEntityPoints: 0,
		currentPageLighting: "legacy",
		offsets: {
			offsetX: 0,
			offsetY: 0,
			mapScaling: 1
		},
		folders: [],
		defaultMapScaling: 1,
		defaultLighting: 'legacy',
		defaultPixelsPerSquare: 70,
	};
	
	static counter = {
		scenes: 0,
		folders: 0,
		actors: 0,
		journals: 0,
		rolltables: 0,
		macros: 0,
		cleanups: 0,
		_total: 0,
		_weights: {scenes: 10, folders: 20, actors: 0.5, journals: 1, rolltables: 1, macros: 1, cleanups: 5},
		set: function(entity, value) {
			if (typeof(this[entity]) === 'undefined') {H.eLog(`Counter Error: illegal Entity supplied`, 'error', true); return}
			value = parseInt(value,10);
			if (isNaN(value)) {H.eLog(`Counter Error: non-integer supplied`, 'error', true); value=1}
			this[entity] += value;
			this._total += value*this._weights[entity];
		},
		get: function(entity, testValue) {
			if (/^tot/i.test(entity)) return this._total;
			if (typeof(this[entity]) === 'undefined') {H.eLog(`Counter Error: illegal Entity supplied`, 'error', true); return}
			return (testValue) ? testValue*this._weights[entity] : this[entity]/this._weights[entity];
		}
	}

	static error = {
		abort: false,
	}

    static async startImport(ev, scanOnly=false) {
        ev.preventDefault();
        ev.stopPropagation();
		H.eLog(`Starting import...`, ev);
		let idJSON = document.getElementById('import-json');
        let ver;
        let filesObj = idJSON.files; // one file at a time, for now
		if (!filesObj.length) return console.error(`No file selected!`);
        let inputText = await readTextFromFile(filesObj[0]);
        let impObj = JSON.parse(inputText);//eslint-disable-next-line no-prototype-builtins
		if (impObj.hasOwnProperty('schema_version')) ver = H.versionControl(impObj.schema_version);
		else alert(`Unrecognised JSON - bad object structure or unknown source.`);
		if (ver) console.log(`-= Oosh's Importer v${CONFIG.OOSHR20I.schemaVersion} =- proceeding with v${ver} JSON.`)
		else alert('Incompatible JSON loaded - see console log for error details. Aborting process...');
		let importAsArray = (impObj.type.match(/collection/i)) ? 'array' : false;
		this.importConfig.images = (impObj.images === 'local') ? 'local' : 'remote';
		if (importAsArray) this.importConfig.folders = impObj.folders;
        let importType = (impObj.type.match(/campaign/i)) ? 'campaign' :
            (impObj.type.match(/page/i)) ? 'pages' :
            (impObj.type.match(/character/i)) ? 'characters' :
            (impObj.type.match(/handout/i)) ? 'handouts' :
            'unknown';
		if (scanOnly) {H.eLog('Scanonly, returning early...'); return impObj}
        switch(importType) {
            case('campaign'):
                this.importCampaign(impObj);
                break;
			case('pages'):
				//console.log(`Importing pages (is array?: ${importAsArray})`);
                this.importPages(impObj, importAsArray);
                break;
            case('characters'):
                this.importJournal(null, impObj, importAsArray);
                break;
            case('handouts'):
                this.importJournal(impObj, null, importAsArray);
                break;
            default:
                H.eLog(`Unknown datatype +++ MELON MELON MELON +++`, 'error', true);
                break;
        }
    }

    static async importCampaign(campaignObject) {
		/* === Start Intro screen, calculate total entities */
		console.log(`Starting await`);
		await Intro.drawLoadingPage();
		console.log(`Ending await`);
		//return;
		this.importConfig.totalEntityPoints = this.counter.get('folders', 1) // use a shortcut hack for folders for now
			+ this.counter.get('scenes', campaignObject.pages?.length||0) + this.counter.get('actors', campaignObject.characters?.length||0)
			+ this.counter.get('journals', campaignObject.handouts?.length||0) + this.counter.get('cleanups', 3); // Hardcoded cleanups quantity
		if (this.importConfig.ogl5e) this.importConfig.totalEntityPoints += this.counter.get('rolltables', campaignObject.rollabletables?.length||0)
			+ this.counter.get('macros', campaignObject.macros?.length||0);

		H.eLog(`Folders:${this.counter.get('folders', 1)}  Scenes:${this.counter.get('scenes', campaignObject.pages?.length||0)}  actors:${this.counter.get('actors', campaignObject.characters?.length||0)} rolltables:${this.counter.get('rolltables', campaignObject.rollabletables?.length||0)}	macros:${this.counter.get('macros', campaignObject.macros?.length||0)} journals:${this.counter.get('journals', campaignObject.handouts?.length||0)} cleanups:${this.counter.get('cleanups', 3)}`, 'info');

		let tablesDone, macrosDone;
		this.importConfig.folders = campaignObject.folders;
		await H.getCampaignSettings(campaignObject).then(async settings => {
			this.importConfig.defaultLighting = settings.lighting || 'legacy';
			let defGridValues = await H.checkScale(70, parseFloat(settings.snapping_increment, 10));
			this.importConfig.defaultPixelsPerSquare = defGridValues.pixelsPerSquare;
			this.importConfig.defaultMapScaling = defGridValues.scale;
			H.eLog(`Default map settings updated, scale: ${this.importConfig.defaultMapScaling}, pps: ${this.importConfig.defaultPixelsPerSquare}`, 'info');
		});
		H.eLog(`=== STARTING JOURNAL IMPORT ===`, 'info', true);
		let handoutsDone = await Promise.all([this.importJournal(campaignObject.handouts, campaignObject.characters, 'campaign'), H.timeout(8000)])
			.then((res) => {
				H.eLog(`=== Processed ${res} journal/character/folder items, r20id directory contains ${this.directory.characterLinks.length} entries ===`, 'info', true);
				return true;
			});
		await H.timeout(1000);
		let pagesDone = await Promise.all([this.importPages(campaignObject.pages, 'campaign'), H.timeout(8000)])
			.then((res) => {
				H.eLog(`Successfully created -= ${res} =- Scenes.`, 'info', true);
			});
		if (this.importConfig.ogl5e && campaignObject.rollabletables?.length) {
			tablesDone = await Promise.all([this.importRolltables(campaignObject.rollabletables), H.timeout(2000)])
				.then((res) => {
					H.eLog(`Successfully created -= ${res} =- Roll Tables.`, 'info', true);
				});
		} else {
			tablesDone = new Promise(res=>res());
			H.eLog(`Skipping Rollable Table imports...`, 'warn', true)}
		if (this.importConfig.ogl5e && campaignObject.macros?.length) {
			macrosDone = await Promise.all([this.importMacros(campaignObject.macros), H.timeout(2000)])
				.then((res) => {
					H.eLog(`Successfully created -= ${res} =- Macros.`, 'info', true);
				});
		} else {
			macrosDone = new Promise(res=>res());
			H.eLog(`Skipping Macro imports...`, 'warn', true);
		}
		await Promise.all([handoutsDone, pagesDone, tablesDone, macrosDone]).then(async () =>{
			H.eLog(`=== Primary import complete,  launching clean-up...`, 'log', true);
			await H.timeout(1500);
			H.eLog(`=== Launching Journal Link Repointererer ===`, 'info', true);
			await Promise.all(game.journal.entities.map(async (j) => {
				if (j.data?.content && typeof(j.data.content) === 'string') {
					await H.parseHandout(j).then(async (newContent) => {
						await j.update({content: newContent});
						//H.eLog(`${j.name} Journal links updated!`);
					});
				}
			})).then(() => {
				H.eLog(`Journal update complete.`);
				this.counter.set('cleanups', 1);
			});
			H.eLog(`=== Cleaning up empty folders ===`, 'info', true);
			await H.timeout(100);
			await H.cleanupFoldersAsync().then(() => {
				H.eLog(`=== IMPORT COMPLETED ===`, 'info', true);
				this.counter.set('cleanups', 1);
			});
		}).then(async () => {
			this.counter.set('cleanups', 1);
			//console.log(this.counter);
			await H.timeout(8000);
			CONFIG.OOSHR20I.forceComplete = true;
		});
	}

	static async importJournal(handoutsObject, charactersObject, isArray) {
		let handoutsArray = [], foldersArray = [], charactersArray = [];
		let okFolder, okJournal, okCharacter;
		let countFolder = 0;
		handoutsArray = (handoutsObject) ? (isArray === 'campaign') ? handoutsObject : (isArray === 'array') ? handoutsObject.array : (!handoutsObject) ? [] : {type: 'handoutsSingle', array: [handoutsObject]} : [];
		foldersArray = (isArray) ? this.importConfig.folders : [];
		charactersArray =  (charactersObject) ? (isArray === 'campaign') ? charactersObject : (isArray === 'array') ? charactersObject.array : (!charactersObject) ? [] : {type: 'charactersSingle', array: [charactersObject]} : [];
		H.eLog(`Passed through to Journal function...`);
		this.directory.r20characters = charactersArray;
		//console.log(foldersArray);
		let nulls = [null, null];
		let homelessFoldersArr = await H.makeFolder({n: 'Homeless Folder'}, [])//.then((v) => {return v});
		//console.log(homelessFoldersArr);
		let homelessFolder = homelessFoldersArr[0], homelessFolderC = homelessFoldersArr[1];
		//let homelessFolderC = await H.makeFolder({n: 'Homeless Folder'}, nulls).then((v) => {return v._id});
		this.directory.folderEntries.homeless = homelessFolder;
		this.directory.folderEntries.homelessC = homelessFolderC;

		// Process Folders
		okFolder = await Promise.all(foldersArray.map(async (entry) => {
			if (typeof(entry) === 'object') {  // first level of folders
				let folderIdT1 = await H.makeFolder(entry, nulls, 1)
				//console.log(folderIdT1);
				if (entry.i.length > 0) await Promise.all(entry.i.map(async (entryT2) => {
					if (typeof(entryT2) === 'object') { // second level of folders
						//console.log(entryT2);
						let folderIdT2 = await H.makeFolder(entryT2, folderIdT1, 2)
						//console.log(folderIdT2);
						if (entryT2.i.length > 0) await Promise.all(entryT2.i.map(async (entryT3) => { // third and maximum level of folders
							if (typeof(entryT3) === 'object') {
								let folderIdT3 = await H.makeFolder(entryT3, folderIdT2, 3)
								//console.log(folderIdT3);
								if (entryT3.i.length > 0) entryT3.i.forEach(entryT4 => {
									if (typeof(entryT4) === 'object') { // max depth reached, find all other r20ids and send to a homeless folder
										if (entryT4.i.length > 0) entryT4.i.forEach(entryT5 => {
											if (typeof(entryT5) === 'object') {
												if (entryT5.i.length > 0) entryT5.i.forEach(entryT6 => {
													if (typeof(entryT6) === 'object') {
														if (entryT6.i.length > 0) entryT6.i.forEach(entryT7 => {
															if (typeof(entryT7) === 'string') this.directory.folderEntries[entryT7] = homelessFolder, this.directory.folderEntries[`c${entryT7}`] = homelessFolderC;
														})
													} else if (typeof(entryT6) === 'string') this.directory.folderEntries[entryT6] = homelessFolder, this.directory.folderEntries[`c${entryT6}`] = homelessFolderC;
												})
											} else if (typeof(entryT5) === 'string') this.directory.folderEntries.push[entryT5] = homelessFolder, this.directory.folderEntries[`c${entryT5}`] = homelessFolderC;
										})
									} else if (typeof(entryT4) === 'string') this.directory.folderEntries[entryT4] = folderIdT3[0], this.directory.folderEntries[`c${entryT4}`] = folderIdT3[1];
								})
							} else if (typeof(entryT3) === 'string') this.directory.folderEntries[entryT3] = folderIdT2[0], this.directory.folderEntries[`c${entryT3}`] = folderIdT2[1];
						}))
					} else if (typeof(entryT2) === 'string') this.directory.folderEntries[entryT2] = folderIdT1[0], this.directory.folderEntries[`c${entryT2}`] = folderIdT1[1];
				}))
			} else if (typeof(entry) === 'string') this.directory.folderEntries[entry] = null, this.directory.folderEntries[`c${entry}`] = null;
		})).then(async () => {
			H.eLog(`Created -= ${countFolder} =- Folder Entries`);
			this.counter.set('folders', 1);
			await H.timeout(2000);
			return true});

		// Process Journal Entries
		okJournal =	await Promise.all(handoutsArray.map(async (handout) => {
			let parentFolder = (this.directory.folderEntries[handout.r20id]) ? this.directory.folderEntries[handout.r20id] : this.directory.folderEntries.homeless;
			let html = (handout.notes) ? handout.notes : "";
			let html2 = (handout.gmnotes) ? handout.gmnotes : "";
			let divider = (html && html2) ? `<br><br><br><h2>GM Notes</h2>` : (html2) ? '<h2>GM Notes</h2>' : '';
			let imgpath = (handout.images === 'remote') ? handout.avatar : game.settings.get('r20import', 'importImagePath') + handout.image;
			let avatar = (handout.avatar.match(/(.jp|.gif|.png)/)) ? `<img src="${imgpath}"/>` : '';
			let handoutData = {
				content: avatar + html + divider + html2,
				name: handout.name || "",
				type: "JournalEntry",
				sort: null,
				flags: {},
				folder: parentFolder || null,
				r20id: handout.r20id || null,
			}

			await JournalEntry.create(handoutData).then((fJournal) => {
				this.counter.set('journals', 1);
				this.directory.handoutLinks.push(`${handout.r20id}|${fJournal._id}`);
			});				

		})).then(async () => {
			H.eLog(`Created -= ${this.counter.get('journals')} =- Journal Entries`);
			await H.timeout(2000);
			return true
		});

		// Load Compendium indices for character searches
		this.compendium.packs.npcData = game.packs.get(this.compendium.names.creatures); 
		if (this.compendium.packs.npcData) await this.compendium.packs.npcData.getIndex().then(i=>H.eLog(`Creature compendium loaded with ${i.length} entries.`, 'info'));
		this.compendium.packs.spellData = game.packs.get(this.compendium.names.spells);
		if (this.compendium.packs.spellData) await this.compendium.packs.spellData.getIndex().then(i=>H.eLog(`Spells compendium loaded with ${i.length} entries.`, 'info'));
		this.compendium.packs.itemData = game.packs.get(this.compendium.names.items);
		if (this.compendium.packs.itemData) await this.compendium.packs.itemData.getIndex().then(i=>H.eLog(`Items compendium loaded with ${i.length} entries.`, 'info'));
		this.compendium.packs.backgroundData = game.packs.get(this.compendium.names.backgrounds);
		if (this.compendium.packs.backgroundData) await this.compendium.packs.backgroundData.getIndex().then(i=>H.eLog(`Backgrounds compendium loaded with ${i.length} entries.`, 'info'));

		// Process Characters
		// If using generic importer, make sure a sheet class exists
		let sheetNames = Object.keys(CONFIG.Actor.typeLabels);
		let sheetType = sheetNames.length ? sheetNames[0] : null;

		okCharacter = await Promise.all(charactersArray.map(async (char) => {
			if (this.importConfig.ogl5e) await OGL5e.process5eCharacter.bind(this, char)();
			else if (sheetType) await H.processGenericCharacter.bind(this, char, sheetType)();
		})).then(() => {
			H.eLog(`Created -= ${this.counter.get('actors')} =- Actors.`);
			return true;
		});
		await H.timeout(1000);
		await Promise.all([okJournal, okFolder, okCharacter]).then(() => H.eLog(`=== Characters & Journal Completed! ===`, 'info', true));
		return countFolder + this.counter.get('actors') + this.counter.get('journals');
	}


    /*  import R20 Pages, convert to Foundry Scenes  */
	static async importPages(pagesObj, isArray) { // rewrite to convert all data as Promises before creation???
		H.eLog('Passed through to Pages function...');
		//console.log(`Actor/Token link directory: `, this.directory.characterLinks);
		await H.timeout(500);
		let pagesArray = (isArray === 'campaign') ? pagesObj : (isArray === 'array') ? pagesObj.array : {type: 'pagesSingle', array: [pagesObj]};
		await Promise.all(pagesArray.map(async (page) => {
			this.importConfig.currentPageLighting = (page.attributes.dynamic_lighting_enabled) ? "updated" : "legacy";
			let currentLighting = (page.attributes.dynamic_lighting_enabled) ? "updated" : "legacy";
			let gridValues = await H.checkScale(70, parseFloat(page.attributes.snapping_increment, 10)||1).then(v=>v);
			//H.eLog(gridValues);
			let pixelsPerSquare = gridValues.pixelsPerSquare;
			let mapScaling = gridValues.scale;
			this.importConfig.offsets.mapScaling = gridValues.scale;
			//H.eLog(`Map Scale: ${mapScaling}`);
			let backgroundImage;
			//if (page.graphics.map.length > 0) backgroundImage = await H.findBackgroundImage(page.graphics.map, page.attributes, gridValues, this.importConfig.images);
			//H.eLog(backgroundImage);
			//H.eLog(pixelsPerSquare);
			let lightSources = [];
			let offsetX = (backgroundImage) ? backgroundImage.offsetX : 0;
			let offsetY = (backgroundImage) ? backgroundImage.offsetY : 0;
			this.importConfig.offsets.offsetX = offsetX;
			this.importConfig.offsets.offsetY = offsetY;
            let sceneData = {
                name: page.name || "unnamed",
                navName: page.name || "unnamed",
				r20index: page.r20index,
                description: "",
                navigation: true,
				navOrder: `${page.r20index+2||1}00000`,
				sort: `${page.r20index+2||1}00000`,
				img: (backgroundImage) ? backgroundImage.image : "",
				inital: null,
				flags: {r20index: page.r20index},
                width: (backgroundImage) ? backgroundImage.sceneWidth : page.attributes.width*pixelsPerSquare*mapScaling || 2800,
                height: (backgroundImage) ? backgroundImage.sceneHeight : page.attributes.height*pixelsPerSquare*mapScaling || 2800,
                padding: (backgroundImage) ? backgroundImage.scenePadding : 0,
                backgroundColor: H.isValidHex(page.attributes.background_color) ? H.isValidHex(page.attributes.background_color) : "#ffffff",
                gridType: (page.attributes.snapping_increment == 0 || !page.attributes.showgrid) ? 0 : 1,
                grid: pixelsPerSquare,
                gridColor: H.isValidHex(page.attributes.gridcolor) ? H.isValidHex(page.attributes.gridcolor) : "#000000",
                gridAlpha: page.attributes.grid_opactiy || 0.5,
                gridDistance: page.attributes.scale_number || 5,
				gridUnits: page.attributes.scale_units || "ft",
				tokenVision: true,
				fogExploration: true,
				lights: [],
				globalLight: false,
				globalLightThreshold: null,
				darkness: 0,
				sounds: [],
				templates: [],
				notes: [],
				drawings: [],
				tiles: [],
				walls: [],
				size: null
			}

            /* convert r20 Path coordinates into foundry Walls */

			let wallColours = page.paths.filter(w=>w.attributes.layer==='walls').map(w=>w.attributes.stroke);
			let doorColor = await H.getAverageFromArray(wallColours, 1);
			let secretColor = await H.getAverageFromArray(wallColours, 2);

            let outputWalls = [];
			let impWalls = (page.paths.length > 0) ? page.paths.filter((wall) => wall.attributes.layer === 'walls') : null
			await H.timeout(10);
            if (impWalls) {
				await Promise.all(impWalls.map(async (wall) => {
					if (!wall.attributes.path.match(/[QC]/g)) {
						let p = JSON.parse(wall.attributes.path) || null;
						let l = (offsetX + wall.attributes.left - parseInt(wall.attributes.width, 10)/2)*mapScaling;
						let t = (offsetY + wall.attributes.top - parseInt(wall.attributes.height, 10)/2)*mapScaling;
						let ux = l + (p[0][1])*mapScaling;
						let uy = t + (p[0][2])*mapScaling;
						for (let i=1; i<p.length; i++) {
							let coords = [ux, uy, l + (p[i][1])*mapScaling, t + (p[i][2])*mapScaling];
							outputWalls.push({
								flags: {r20color: wall.attributes.stroke},
								c: coords,
								move: 1,
								sense: 1,
								door: (wall.attributes.stroke === doorColor) ? 1 : (wall.attributes.stroke === secretColor) ? 2 : 0,
								ds: 0,
								locked: true,
							});
							ux = coords[2];
							uy = coords[3];
						}
					}
				})); 
            }

			sceneData.walls = await outputWalls;

			let tokens = {}; // PROCESS ALL TOKENS

            for (let layer in page.graphics) { // loop through layer by layer
				let layerTarget = (layer === 'map') ? 'tiles' : (layer === 'gmlayer') ? 'gmlayer' : (layer === 'objects') ? 'objects' : 'other'; // foundry Layer to spawn this Collection in
				let layerOrder = page.zorder.filter((id) => page.idByLayer[layer].includes(id));
				let graphics = page.graphics[layer].filter((img) => layerOrder.includes(img.id)).sort((a,b) => layerOrder.indexOf(a.id) - layerOrder.indexOf(b.id)); // sort
				if (layer === 'map' && backgroundImage) graphics.splice(backgroundImage.index, 1); // remove map image if it has been applied to BG
				let tokenData = [];
				await Promise.all(graphics.map(async (token, i) => {
					let newData = {};
					let ta = token.attributes;
					let imgpath = (this.importConfig.images === 'local') ? game.settings.get('r20import', 'importImagePath') + token.image : ta.imgsrc;
					if (layer === 'other') {  // Process tokens on Dynamic Lighting layer ==> Lighting layer
						await H.grabLightSource(token, this.importConfig.currentPageLighting, this.importConfig.offsets)
							.then(lightData => {if (lightData) {
								lightData.x *= mapScaling;
								lightData.y *= mapScaling;
								lightSources.push(lightData);
							}});
					} else if (layer === 'map') {  // Process tokens on Map layer ==> Tiles layer
						newData = {
							img: imgpath || "/import/Images/default.png",
							width: parseInt(ta.width, 10)*mapScaling || 70,
							height: parseInt(ta.height, 10)*mapScaling || 70,
							scale: mapScaling,
							x: (offsetX + parseInt(ta.left, 10) - parseInt(ta.width, 10)/2)*mapScaling || 0,
							y: (offsetY + parseInt(ta.top, 10) - parseInt(ta.height, 10)/2)*mapScaling || 0,
							z: parseInt(i, 10)*10 || 0,
							rotation: ta.rotation || 0,
							hidden: false,
							locked: true,
						}
						await H.grabLightSource(token, this.importConfig.currentPageLighting, this.importConfig.offsets)
							.then(lightData => {if (lightData) {
								lightData.x *= mapScaling;
								lightData.y *= mapScaling;
								lightSources.push(lightData);
							}});
					} else {  // Process tokens on DM & Object layers ==> Tokens layer
						let npc = H.isNpc(token, this.directory.r20characters);
						let sighted = (this.importConfig.currentPageLighting === 'updated' && ta.has_bright_light_vision) ? true : (ta.light_hassight) ? true : false;
						await H.grabLightSource(token, currentLighting, this.importConfig.offsets, true)
							.then(lightCalcs => {
								newData = {
									name: ta.name || "unnamed",
									r20id: token.id || -1,
									r20represents: ta.represents || "",
									flags: {
										//currentHp: (ta.bar1_value > 0) ? ta.bar1_value : null,
									},
									description: ta.gmnotes || "",
									displayName: (npc) ? 20 : 30, // needs to change later
									img: imgpath || "icons/svg/mystery-man.svg", // check this???
									tint: (H.isValidHex(ta.tint_color)) ? ta.tint_color : "", // may need processing "#2eba38"
									effects: [],
									overlayEffect: (/dead/.test(ta.statusmarkers)) ? 'icons/svg/skull.svg' : '',
									width: ta.width/pixelsPerSquare*mapScaling || 1,
									height: ta.height/pixelsPerSquare*mapScaling || 1,
									scale: 1, // no scale here???
									x: lightCalcs.x*mapScaling || 70,
									y: lightCalcs.y*mapScaling || 70,
									elevation: 0,
									lockRotation: false,
									rotation: ta.rotation || 0,
									hidden: (layer === 'objects') ? false : true,
									vision: sighted,
									dimSight: lightCalcs.dimSight || 0,
									brightSight: lightCalcs.brightSight || 0,
									sightAngle: lightCalcs.sightAngle || 360,
									dimLight: lightCalcs.dim || 0,
									brightLight: lightCalcs.bright || 0,
									lightAngle: lightCalcs.angle || 360,
									actorId: "",
									actorLink: false,
									actorData: {
										data: {attributes: {hp: {value: (ta.bar1_value > 0) ? ta.bar1_value : null}}},
									},
									disposition: (npc) ? -1 : 1,
									displayBars: (npc) ? 20 : 30,
									bar1: {
										attribute: (ta.name) ? 'attributes.hp' : '',
									},
									bar2: {
										attribute: (ta.name) ? 'attributes.ac.value' : '',
									},
									mirrorX: ta.flipv || false,
									mirrorY: ta.fliph || false,
								}
						});
					}					
					//H.timeout(20);   // Process token=>character links, requires character import to have run
					if (this.directory.characterLinks.length && newData.r20represents) {
						let rxR20id = new RegExp(`${newData.r20represents}`);
						let link = this.directory.characterLinks.find(l=>rxR20id.test(l));
						if (link) {
							let foundryId = await (link.match(/[^|]+\|(.+)/)) ? link.match(/[^|]+\|(.+)/)[1] : '';
							if (foundryId) {
								newData.actorLink = (!ta.bar1_link) ? false : true;
								newData.actorId = foundryId;
								//newData.bar1.attribute = 
								//H.eLog(`=== Token "${newData.name}" Linked to character ID "${foundryId}" ===`);
							}
						} else console.warn(`=== No link found for ${newData.name}, r20id: "${newData.r20represents}" ===`)
					}
					if (newData) await tokenData.push(newData)
					await H.timeout(10);
				}));

				tokens[layerTarget] = tokenData;
			}

			sceneData.tiles = await tokens.tiles;
			
			sceneData.tokens = await tokens.objects.concat(tokens.gmlayer);

			//console.log(this.directory.lightSources);

			sceneData.lights = await lightSources;

			/* Text and drawings */
			let drawingsArray = [];

			await Promise.all(page.text.map(async (text) => {
				let tx = text.attributes;
				const availableFonts = ['Comic Sans MS', 'Signika', 'Arial', 'Arial Black', 'Courier New', 'Times New Roman', 'Modesto Condensed'];
				if (tx.text !== "") {
					let textData = {
						r20id: text.id,
						flags: {},
						type: "t",
						author: game.user._id,
						x: (offsetX + parseInt(tx.left, 10) - parseInt(tx.width, 10)/2)*mapScaling || 0,
						y: (offsetY + parseInt(tx.top, 10) - parseInt(tx.height, 10)/2)*mapScaling || 0,
						width: parseInt(tx.width, 10)*mapScaling || 70,
						height: parseInt(tx.height, 10)*mapScaling || 70,
						rotation: parseInt(tx.rotation, 10) || 0,
						hidden: (tx.layer === 'gmlayer') ? true : false,
						locked: false,
						text: tx.text || "!translation error!",
						fontFamily: (availableFonts.includes(tx.font_family)) ? tx.font_family : "Arial",
						fontSize: parseInt(tx.font_size, 10)*mapScaling ||  48*mapScaling,
						textColor: H.rgbToHex(tx.color) || '#ffffff',
						textAlpha: 1,
						strokeWidth: 0,
					}

					drawingsArray.push(await textData);
				}
			}));

			let drawingsPaths = page.paths.filter((p) => p.attributes.layer !== "walls");

			await Promise.all(drawingsPaths.map(async (path) => {

				let pt = path.attributes;			
				let pth = JSON.parse(pt.path);
				if (!Array.isArray(pth)) return;
				let pType, bezier;
				let scaleX = pt.scaleX || 1, scaleY = pt.scaleY || 1;

				if (!pt.path.match(/[QC]/g)) { // process polygons
					pType = 'p'; //=== do rectangles later ???
					bezier = 0;
					pth = pth.map(point => {
						point.shift();
						return point.map((c,i) => {
							if (i%2 === 0) return c*=scaleX*mapScaling;
							else return c*=scaleY*mapScaling;
						});
					});
				} else if (pt.path.match(/Q/)) { // process freehand
					pType = 'f';
					bezier = 0.5;
					pth.forEach(point => {
						if (point.length > 2) point = point.splice(0, point.length - 2);
						point.forEach((c) => c *= mapScaling)
					})
				} else if (pt.path.match(/C/)) { // process ellipses
					pType = 'e';
					bezier = 0;
				} else pType = null;

				if (pType) { // remove 'p' later
					let pathData = {
						r20id: path.id,
						flags: {},
						type: pType,
						author: game.user._id,
						x: (offsetX + parseInt(pt.left, 10) - parseInt(pt.width*mapScaling*scaleX, 10)/2)*mapScaling || 0,
						y: (offsetY + parseInt(pt.top, 10) - parseInt(pt.height*mapScaling*scaleY, 10)/2)*mapScaling || 0,
						z: parseInt(pt.z_index, 10) || 0,
						width: parseInt(pt.width, 10)*mapScaling*scaleX || 70,
						height: parseInt(pt.height, 10)*mapScaling*scaleY || 70,
						rotation: parseInt(pt.rotation, 10) || 0,
						hidden: (pt.layer === 'gmlayer') ? true : false,
						locked: false,
						points: pth,
						bezierFactor: bezier || 0,
						fillType: (!pt.fill || pt.fill === 'transparent') ? 0 : 1,
						fillColor: H.isValidHex(pt.fill) ? H.isValidHex(pt.fill) : '#000000',
						fillAlpha: 1,
						strokeWidth: parseInt(pt.stroke_width, 10)*mapScaling || 5*mapScaling,
						strokeColor: pt.stroke || '#000000',
						strokeAlpha: 1,
					}
				
					drawingsArray.push(await pathData);
				}
			}));

			drawingsArray.sort((a,b) => page.zorder.indexOf(a.r20id) - page.zorder.indexOf(b.r20id));

			sceneData.drawings = await drawingsArray;

			/* Finally, create the scene! */
			await Scene.create(sceneData).then(async fScene => {
				H.eLog(`Created new Scene -= ${fScene.name} =- with ID: ${fScene._id}`);
				/*await Promise.all(fScene.data.tokens.map(async (tok) => {
					if (tok.flags?.currentHp && !isNaN(tok.flags?.currentHp)) {
						console.log(`=== editing token actor HP ===`, tok);
						tok.actor?.update({data: {attributes: {hp: {value:tok.flags.currentHp}}}});
					}
				}));*/
				this.counter.set('scenes', 1);
			});
		})).then(v => H.eLog(`${this.counter.scenes} Scenes imported!`)); // eslint-disable-line no-unused-vars
		await H.timeout(500);
		return this.counter.get('scenes');
    }

	static async importRolltables (rolltablesObject) {

		await Promise.all(rolltablesObject.map(async (table) => {

			// turn R20 weights into range & expression expected by Foundry
			let weights = table.tableItems.map(t=>t.weight);
			let init = 1;
			let final = await weights.reduce((t, v, i) => {
				if (!v) table.tableItems[i].range = [0,0];
				else table.tableItems[i].range = [t, t+v-1];
				//H.eLog(`item ${i}: ${table.tableItems[i].range[0]} - ${table.tableItems[i].range[1]}`)
				return t+(v||0);
			}, init);

			let form = `d${final - init}`;

			let data = {
				name: table.name,
				r20id: table.r20id,
				img: 'icons/svg/d20-grey.svg',
				results: [],
				formula: form,
				replacement: true,
				displayRoll: table.showplayers ? true : false
			}

			await Promise.all(table.tableItems.map(async (item, i) => {
				let imgPath = (item.image) ? (this.importConfig.images === 'local') ? await H.stg('importImagePath') + item.image : item.image : '';
				let itemData = {
					type: 0,
					text: item.name||`Item${i}`,
					img: imgPath||'',
					weight: item.weight||1,
					range: item.range||[],
					drawn: false
				}
				data.results.push(itemData);
				if (!data.img && item.image) data.img = imgPath;
			}));

			await RollTable.create(data).then(() => this.counter.set('rolltables', 1));
		})).then(() => H.eLog(`Finished rollTable import...`));
		return this.counter.get('rolltables');
	}

	/* === Import macros, for 5e GM Adventure macros only === */
	static async importMacros (macrosObject) {

		//if (H.stg('ogl5e') !== 1) {H.eLog(`Skipping macros, no 5e OGL sheet support found in Campaign!`, 'warn', true); return}

		H.eLog(`Proceeding with macro import...`, 'info', true);
		//console.log(this.directory.handoutLinks, this.directory.characterLinks);

		//let macroCounter = 0;
		let macroNameArray = [];

		await Promise.all(macrosObject.map(async (macro) => {
			await OGL5e.parseMacro(macro).then(async (macData) => {
				if (!macData) {H.eLog(`Error reading macro data, aborting converstion...`, 'error'); return}
				await OGL5e.constructScript(macData).then(async (m) => {
					let fData = {
						name: m[0]||'nameError',
						type: m[2]||'chat',
						sort: 999999, // doesn't seem to do anything for macro sorting
						flags: {r20import: true},
						scope: 'global',
						command: m[1]||'macroError',
						img: "icons/svg/dice-target.svg",
						r20data: macData,
					}

					await Macro.create(fData).then((fMac) => {
						fMac.update({r20data: macData});
						macroNameArray.push(`@Macro[${m?.[0]}]`||`macroNameError`);
						this.counter.set('macros', 1);
					});
				});
			});
		})).then(async () => {

			await JournalEntry.create({
				content: `<h2>Imported Adventure Macros</h2><br>${macroNameArray.join('<br>')}`,
				name: 'Imported Macros',
				type: "JournalEntry",
				sort: 1,
				flags: {},
				folder: null,
			}).then(() => H.eLog(`Created Macro Handout!`, 'info', true));

		});
		
		return this.counter.get('macros');
	}
}