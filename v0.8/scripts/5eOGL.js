/* globals ChatMessage, Actor */
import H from './helpers.js';

/* Class of methods for Roll20 dnd5e OGL sheet import */
export default class OGL5e {

    // Scrape relevant data (links and rolltables) from R20 adventure package macros
    // TO DO: rewrite to use the above link converter function

    static async parseMacro(inputMacro) {

        let res, tableData = [], linkData = [];
        let replaceLink, replaceTable, diff;
        console.log(`Starting parser for ${inputMacro.name}`);
        const rxLink = /\[([^[\]]+)]\(([^)]+)\)/g;
        const rxDesc = /{{desc[a-z]*=(.*?)}}/;
        const rxRolltable = /\[\[(\d+)t\[([^\]]+)\]\]\]/g;
    
        let desc = await inputMacro.action.match(rxDesc)?.[1]||'';
        if (!desc) {console.warn('No description found in macro, skipped...');return null}
        let toGM = /\/w\s+gm/i.test(inputMacro.action) ? true : false;
    
        let throughput = await H.decodeHE(desc);
    
        // Process character & handout links
        while ((res = rxLink.exec(throughput)) !== null) {
            await H.getFoundryLink(res, res[2], res[1]).then(async (v) => {
                if (v) {
                    replaceLink = v;
                    throughput = await throughput.replace(res[0], replaceLink);
                    diff = replaceLink.length - res[0].length;
                    rxLink.lastIndex += diff;
                    linkData.push(res[0]);
                }
            });
        }
    
        // Process rollable tables
        while ((res = rxRolltable.exec(throughput)) !== null) {
            await H.getFoundryLink(res, res[1], res[2]).then(async (v) => {
                if (v) {
                    replaceTable = v;
                    throughput = await throughput.replace(res[0], replaceTable);
                    diff = replaceTable.length - res[0].length;
                    rxRolltable.lastIndex += diff;
                    tableData.push(res[0]);
                }
            });
        }

        // Any more Style replacers can go here
        let newDesc = await throughput
            .replace(/\*\*\*(.+?)\*\*\*/g, `<b><i>$1</b></i>`)
            .replace(/\*\*(.+?)\*\*/g, `<b>$1</b>`)
    
        let output = {
            name: inputMacro.name,
            title: inputMacro.action.match(/rname=(.*?)}}/)?.[1]?.trim()||'',
            subtitle: inputMacro.action.match(/name=(.*?)}}/)?.[1]?.trim()||'',
            description: desc,
            rolltables: tableData,
            links: linkData,
            foundryDesc: newDesc,
            whisper: toGM,
        }
        return output;
    }

    // Put together a script macro so the rolltables work. Needs a rewrite to use an exec/while loop like the handout one,
    // using the offset to guide lastIndex to the right place each loop
	static async constructScript(inputMacroData) {
        let desc = inputMacroData.foundryDesc;
		let macroName = inputMacroData.name;
		let scriptMacro, res, i = 0, scriptEnd, diff;
		let rxRollTable = /@RollTable\[(.*?)\]/g;
		let varDecs = `let style = 'color: orange; font-weight: bold; font-style: italic;'\n`;
	
        let gmIds = inputMacroData.whisper ? ChatMessage.getWhisperRecipients('gm').map(u=>u.id) : null;
        let gmStr = gmIds?.length ? `, type: 4, whisper: ['${gmIds.join(`','`)}']` : '';
        let gmStrChat = gmIds?.length ? `/w gm ` : '';
	
		if (!/@RollTable/.test(desc)) return [macroName, `${gmStrChat}${desc}`, 'chat'];
	
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

        varDecs += `\nlet msg = \`${desc}\`;\n`;
        scriptEnd = `let chatData = {content: msg${gmStr}};\nChatMessage.create(chatData);`;

	
		scriptMacro = `${varDecs}\n${scriptEnd}`;
	
		return [macroName, scriptMacro, 'script'];
	}


    /* Roll20 5eOGL character sheet importer. Must be bound to R20Importer class, do not invoke from here.  */
    static async process5eCharacter(char) {
        H.eLog(`Passed through to OGL5e`, 'info');
        console.log(char);
        let parentFolder = (this.directory.folderEntries[`c${char.r20id}`]) ? this.directory.folderEntries[`c${char.r20id}`] : this.directory.folderEntries.homelessFolderC;
        let html = (char.bio && char.bio !== 'undefined') ? char.bio : "";
        let html2 = (char.gmnotes && char.gmnotes !== 'undefined') ? char.gmnotes : "";
        let divider = (html && html2) ? `<br><br><br><h2>GM Notes</h2>` : (html2) ? '<h2>GM Notes</h2>' : '';
        let imgpath = (char.images === 'local' && /(jpg|png|gif|bmp|jpeg|svg)\s*$/i.test(char.image)) ? `${game.settings.get('r20import', 'importImagePath')}${char.image}` : char.avatar ;
        let avatar = (char.avatar.match(/(.jp|.gif|.png)/)) ? `<img src="${imgpath}"/>` : '';
        let npcAttr = H.getR20attr(char, 'npc');
        let sheetType = (npcAttr == 1) ? 'npc' : 'character';
        let defToken;
        let charName = char.name, charSize = H.getR20attr(char, 'size')||'';
        let charData, premadeId;
        let speedAttr = (sheetType === 'npc') ? 'npc_speed' : 'speed';
        if (sheetType === 'npc') {
            let charRx = new RegExp(`^\\s*${charName}\\s*$`,'i');
            premadeId = this.compendium.packs.npcData.index.find(npc => charRx.test(npc.name.replace(/\s*\([^)]+\)\s*$/,'')));
            if (premadeId) {
                H.eLog(`Found ${premadeId.name} in Compendium with id: "${premadeId._id}, creating NPC...`)
                this.compendium.packs.npcData.getEntity(premadeId._id).then(async (premadeData) => {
                    //console.log(premadeData);
                    charData = await premadeData;
                    let cd = charData._data;
                    cd.data.attributes.hp.value = H.getR20attr(char, 'hp') || 0;
                    cd.data.attributes.hp.max = H.getR20attr(char, 'hp', 'max') || cd.data.attributes.hp.max;
                    cd.name = cd.name.replace(/\s*\([^)]+\)\s*$/,'');
                    cd.folder = parentFolder || null;
                    cd.r20id = char.r20id || null;
                    if (html2) cd.data.details.biography.value = `${cd.data.details.biography.value}${divider}${html2}`;

                    await Actor.create(charData).then((fNPC) => {
                        this.directory.characterLinks.push(`${char.r20id}|${fNPC._id}`);
                        H.eLog(`Created NPC ${fNPC.name} with id: "${fNPC._id}"!`);
                        this.counter.set('actors', 1);
                    });
                });
            }
            //console.log(`Testing, skipping NPC...`);
        }
        if (sheetType !== 'npc' || (sheetType === 'npc' && !premadeId)) {
            H.eLog(`Creating sheet for ${charName}... with image "${imgpath}"`);
            let journalNotes = ['<h1>Import Notes & Errors:</h1>'];
            this.defaults.abilities.forEach(ab => {  // check ability scores for random bonuses
                let val = H.getR20attr(char, ab), base = H.getR20attr(char, `${ab}_base`);
                if (val && base && val !== base) {
                    journalNotes.push(`${ab}: ${val - base} difference in stat value & base`);
                }
            });  // check for random initiative bonus
            if (H.getR20attr(char, 'initiative_bonus') - H.getR20attr(char, 'dexterity_mod') > 0) journalNotes.push(`Initiative bonus found: ${H.getR20attr(char, 'initiative_bonus') - H.getR20attr(char, 'dexterity_mod')}`);
            
            charData = {
                name: char.name || "",
                type: sheetType,
                img: imgpath || "icons/svg/mystery-man.svg",
                data: {
                    abilities: {
                        str: (sheetType === 'npc') ? {value: H.getR20attr(char, 'strength_base')||10, proficient: (H.getR20attr(char, 'npc_str_save_flag')) ? 1 : 0}
                                : {value: H.getR20attr(char, 'strength_base')||10, proficient: (H.getR20attr(char, 'strength_save_prof')) ? 1 : 0},
                        dex: (sheetType === 'npc') ? {value: H.getR20attr(char, 'dexterity_base')||10, proficient: (H.getR20attr(char, 'npc_dex_save_flag')) ? 1 : 0}
                                : {value: H.getR20attr(char, 'dexterity_base')||10, proficient: (H.getR20attr(char, 'dexterity_save_prof')) ? 1 : 0},
                        con: (sheetType === 'npc') ? {value: H.getR20attr(char, 'constitution_base')||10, proficient: (H.getR20attr(char, 'npc_con_save_flag')) ? 1 : 0}
                                : {value: H.getR20attr(char, 'constitution_base')||10, proficient: (H.getR20attr(char, 'constitution_save_prof')) ? 1 : 0},
                        int: (sheetType === 'npc') ? {value: H.getR20attr(char, 'intelligence_base')||10, proficient: (H.getR20attr(char, 'npc_int_save_flag')) ? 1 : 0}
                                : {value: H.getR20attr(char, 'intelligence_base')||10, proficient: (H.getR20attr(char, 'intelligence_save_prof')) ? 1 : 0},
                        wis: (sheetType === 'npc') ? {value: H.getR20attr(char, 'wisdom_base')||10, proficient: (H.getR20attr(char, 'npc_wis_save_flag')) ? 1 : 0}
                                : {value: H.getR20attr(char, 'wisdom_base')||10, proficient: (H.getR20attr(char, 'wisdom_save_prof')) ? 1 : 0},
                        cha: (sheetType === 'npc') ? {value: H.getR20attr(char, 'charisma_base')||10, proficient: (H.getR20attr(char, 'npc_cha_save_flag')) ? 1 : 0}
                                : {value: H.getR20attr(char, 'charisma_base')||10, proficient: (H.getR20attr(char, 'charisma_save_prof')) ? 1 : 0},
                    },
                    attributes: {
                        ac: {value: (sheetType === 'npc') ? H.getR20attr(char, 'npc_ac') : H.getR20attr(char, 'ac')||10},
                        hp: {
                            value: H.getR20attr(char, 'hp')||0, max: H.getR20attr(char, 'hp', 'max')||10, temp: H.getR20attr(char, 'hp_temp')||0,
                            formula: (sheetType === 'npc') ? H.getR20attr(char, 'npc_hpformula'): 0,
                        },
                        movement: {
                            burrow: (/burrow\s*(\d+)/i.test(H.getR20attr(char, speedAttr))) ? H.getR20attr(char, speedAttr).match(/burrow\s*(\d+)/i)[1] : 0,
                            climb: (/climb\s*(\d+)/i.test(H.getR20attr(char, speedAttr))) ? H.getR20attr(char, speedAttr).match(/climb\s*(\d+)/i)[1] : 0,
                            fly: (/fly\s*(\d+)/i.test(H.getR20attr(char, speedAttr))) ? H.getR20attr(char, speedAttr).match(/fly\s*(\d+)/i)[1] : 0,
                            swim: (/swim\s*(\d+)/i.test(H.getR20attr(char, speedAttr))) ? H.getR20attr(char, speedAttr).match(/swim\s*(\d+)/i)[1] : 0,
                            walk: (/^\s*(\d+)/.test(H.getR20attr(char, speedAttr))) ? `${H.getR20attr(char, speedAttr)}`.match(/^\s*(\d+)/)[1] : 0,
                            hover: (/hover/i.test(H.getR20attr(char, 'npc_speed'))) ? true : false,
                        },
                        senses: {
                            darkvision: (sheetType === 'npc' && /darkvision\s*(\d+)/i.test(H.getR20attr(char, 'npc_senses'))) ? H.getR20attr(char, 'npc_senses').match(/darkvision\s*(\d+)/i)[1] : 0,
                            blindsight: (sheetType === 'npc' && /blindsight\s*(\d+)/i.test(H.getR20attr(char, 'npc_senses'))) ? H.getR20attr(char, 'npc_senses').match(/blindsight\s*(\d+)/i)[1] : 0,
                            tremorsense: (sheetType === 'npc' && /tremorsense\s*(\d+)/i.test(H.getR20attr(char, 'npc_senses'))) ? H.getR20attr(char, 'npc_senses').match(/tremorsense\s*(\d+)/i)[1] : 0,
                            truesight: (sheetType === 'npc' && /truesight\s*(\d+)/i.test(H.getR20attr(char, 'npc_senses'))) ? H.getR20attr(char, 'npc_senses').match(/truesight\s*(\d+)/i)[1] : 0,
                        },
                        spellcasting: /(int|wis|cha)/i.test(H.getR20attr(char, 'spellcasting_ability')) ? H.getR20attr(char, 'spellcasting_ability').match(/(int|wis|cha)/i)[1] : '',
                        exhaustion: H.getR20attr(char, 'exhaustion_level') || 0,
                        inspiration: (H.getR20attr(char, 'inspiration')) ? true : false,
                        prof: H.getR20attr(char, 'pb') || 2, // derived, remove?
                    },
                    details: {
                        biography: {
                            value: avatar + html + divider + html2,
                            public: (sheetType === 'npc') ? '' : html + divider + html2,
                        },
                        appearance: (avatar) ? avatar : 'O.O<br> =',
                        ideal: (sheetType !== 'npc') ? H.getR20attr(char, 'ideals') : '',
                        bond: (sheetType !== 'npc') ? H.getR20attr(char, 'bonds') : '',
                        flaw: (sheetType !== 'npc') ? H.getR20attr(char, 'flaws') : '',
                        trait: (sheetType !== 'npc') ? H.getR20attr(char, 'personality_traits') : '',
                        alignment: (sheetType === 'npc' && H.getR20attr(char, 'npc_type')) ? H.properise(H.getR20attr(char, 'npc_type').match(/(neutral|lawful|chaotic|good|evil|true)/ig)) : H.getR20attr(char, 'alignment') || '',
                        race: (sheetType !== 'npc' && H.getR20attr(char, 'subrace')) ? H.getR20attr(char, 'subrace') : H.getR20attr(char, 'race'),
                        type: (sheetType === 'npc' && H.getR20attr(char, 'npc_type')) ? H.getR20attr(char, 'npc_type').replace(/,.*$/, '') : '',
                        cr: (sheetType === 'npc') ? H.getR20attr(char, 'npc_challenge') : '',
                        xp: {value: (sheetType === 'npc') ? H.getR20attr(char, 'npc_xp') : H.getR20attr(char, 'experience')},
                        background: (sheetType !== 'npc') ? H.getR20attr(char, 'background') || '' : '',
                        notes: {value: (journalNotes) ? journalNotes.join('<br>') : ''}, // might need to move this to an update after Actor creation, to include failures in embedded functions
                    },
                    skills: {
                        acr: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_acrobatics_flag')) ? 1 : 0, ability: 'dex'}
                                : {value: (H.getR20attr(char, 'acrobatics_prof')) ? H.getR20attr(char, 'acrobatics_type')||1 : 0, ability: 'dex'},
                        ani: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_animal_handling_flag')) ? 1 : 0, ability: 'wis'}
                                : {value: (H.getR20attr(char, 'animal_handling_prof')) ? H.getR20attr(char, 'animal_handling_type')||1 : 0, ability: 'wis'},
                        arc: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_arcana_flag')) ? 1 : 0, ability: 'int'}
                                : {value: (H.getR20attr(char, 'arcana_prof')) ? H.getR20attr(char, 'arcana_type')||1 : 0, ability: 'int'},
                        ath: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_athletics_flag')) ? 1 : 0, ability: 'str'}
                                : {value: (H.getR20attr(char, 'athletics_prof')) ? H.getR20attr(char, 'athletics_type')||1 : 0, ability: 'str'},
                        dec: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_deception_flag')) ? 1 : 0, ability: 'cha'}
                                : {value: (H.getR20attr(char, 'deception_prof')) ? H.getR20attr(char, 'deception_type')||1 : 0, ability: 'cha'},
                        his: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_history_flag')) ? 1 : 0, ability: 'int'}
                                : {value: (H.getR20attr(char, 'history_prof')) ? H.getR20attr(char, 'history_type')||1 : 0, ability: 'int'},
                        ins: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_insight_flag')) ? 1 : 0, ability: 'wis'}
                                : {value: (H.getR20attr(char, 'insight_prof')) ? H.getR20attr(char, 'insight_type')||1 : 0, ability: 'wis'},
                        itm: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_intimidation_flag')) ? 1 : 0, ability: 'cha'}
                                : {value: (H.getR20attr(char, 'intimidation_prof')) ? H.getR20attr(char, 'intimidation_type')||1 : 0, ability: 'cha'},
                        inv: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_investigation_flag')) ? 1 : 0, ability: 'int'}
                                : {value: (H.getR20attr(char, 'investigation_prof')) ? H.getR20attr(char, 'investigation_type')||1 : 0, ability: 'int'},
                        med: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_medicine_flag')) ? 1 : 0, ability: 'wis'}
                                : {value: (H.getR20attr(char, 'medicine_prof')) ? H.getR20attr(char, 'medicine_type')||1 : 0, ability: 'wis'},
                        nat: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_nature_flag')) ? 1 : 0, ability: 'int'}
                                : {value: (H.getR20attr(char, 'nature_prof')) ? H.getR20attr(char, 'nature_type')||1 : 0, ability: 'int'},
                        prc: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_perception_flag')) ? 1 : 0, ability: 'wis'}
                                : {value: (H.getR20attr(char, 'perception_prof')) ? H.getR20attr(char, 'perception_type')||1 : 0, ability: 'wis'},
                        prf: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_performance_flag')) ? 1 : 0, ability: 'cha'}
                                : {value: (H.getR20attr(char, 'performance_prof')) ? H.getR20attr(char, 'performance_type')||1 : 0, ability: 'cha'},
                        per: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_persuasion_flag')) ? 1 : 0, ability: 'cha'}
                                : {value: (H.getR20attr(char, 'persuasion_prof')) ? H.getR20attr(char, 'persuasion_type')||1 : 0, ability: 'cha'},
                        rel: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_religion_flag')) ? 1 : 0, ability: 'int'}
                                : {value: (H.getR20attr(char, 'religion_prof')) ? H.getR20attr(char, 'religion_type')||1 : 0, ability: 'int'},
                        slt: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_sleight_of_hand_flag')) ? 1 : 0, ability: 'dex'}
                                : {value: (H.getR20attr(char, 'sleight_of_hand_prof')) ? H.getR20attr(char, 'sleight_of_hand_type')||1 : 0, ability: 'dex'},
                        ste: (sheetType === 'npc') ? {value: (H.getR20attr(char, 'npc_stealth_flag')) ? 1 : 0, ability: 'dex'}
                                : {value: (H.getR20attr(char, 'stealth_prof')) ? H.getR20attr(char, 'stealth_type')||1 : 0, ability: 'dex'}
                    },
                    currency: {
                        pp: H.getR20attr(char, 'pp')||0,
                        gp: H.getR20attr(char, 'gp')||0,
                        ep: H.getR20attr(char, 'ep')||0,
                        sp: H.getR20attr(char, 'sp')||0,
                        cp: H.getR20attr(char, 'cp')||0,
                    },
                    traits: {
                        size: /large/i.test(charSize) ? 'lg' : /small/i.test(charSize) ? 'sm' : /tiny/i.test(charSize) ? 'tiny' : 'med',
                        di: {value: [], custom: ""},  // repeating_traits
                        dr: {value: [], custom: ""},  // repeating_traits
                        dv: {value: [], custom: ""},
                        ci: {value: [], custom: ""},  // repeating_traits
                        languages: {value: [], custom: ""}, // repeating_proficiencies
                        weaponProf: {value: [], custom: ""}, // repeating_proficiencies
                        armorProf: {value: [], custom: ""}, // repeating_proficiencies
                        toolProf: {value: [], custom: ""}, // repeating_tool
                    },
                    spells: {},  // repeating_spells
                    bonuses: {},
                    resources: {},
                },
                flags: {}, // ???
                token: {
                    img: imgpath || "icons/svg/mystery-man.svg",
                },
                items: [],  // repeating_inventory
                effects: [],  // ???
                folder: parentFolder || null,
                r20id: char.r20id || null,
            }

            // Update default token if data found
            if (char.defaulttoken) {
                try {defToken = await JSON.parse(char.defaulttoken)}catch(err){defToken = null}
                if (defToken) {
                    let token = {attributes: defToken};
                    //console.log(`=== DefTok passing through to light calcs: `, token);
                    await H.grabLightSource(token, this.importConfig.defaultLighting, {offsetX: 0, offsetY: 0, mapScaling: this.importConfig.defaultMapScaling}, true)
                        .then(lightCalcs => {
                            //console.log(`=== LightCalcs received: `, lightCalcs);
                            charData.token = {
                                flags: {},
                                name: defToken.name,
                                displayName: (sheetType === 'npc') ? 20 : 30,
                                img: defToken.imgsrc,
                                tint: defToken.tint_color,
                                width: defToken.width/this.importConfig.defaultPixelsPerSquare*this.importConfig.defaultMapScaling || 1,
                                height: defToken.height/this.importConfig.defaultPixelsPerSquare*this.importConfig.defaultMapScaling || 1,
                                scale: this.importConfig.defaultMapScaling || 1,
                                lockRotation: false,
                                rotation: (defToken.rotation) ? defToken.rotation : 0,
                                vision: (char.controlledby) ? true : false,
                                dimSight: lightCalcs.dimSight || 0,
                                brightSight: lightCalcs.brightSight || 0,
                                sightAngle: lightCalcs.sightAngle || 360,
                                dimLight: lightCalcs.dim || 0,
                                brightLight: lightCalcs.bright || 0,
                                lightAngle: lightCalcs.angle || 360,
                                lightAlpha: 1,
                                actorLink: (defToken.bar1_link) ? true : false,
                                disposition: (sheetType === 'npc') ? -1 : 1,
                                displayBars: (sheetType === 'npc') ? 20 : 30,
                                bar1: {
                                    attribute: "attributes.hp"
                                },
                                bar2: {
                                    attribute: "attributes.ac.value"
                                },
                            }
                    });
                }
            }

            // iterate through Roll20 repeating fields to find all the info for the following arrays...
            let classes = [], characterFeatures = [], classNames = [], spells = [], items = [], languages = [], weaponProfs = [], armorProfs = [], background;
            let immunities = [], resistances = [], vulnerabilities = [], conditionImmunities=[];

            let raceName = H.getR20attr(char, 'race'), raceObjRef, raceObj;
            let rxRace = new RegExp(`\\s*${raceName}\\s*`,'i');
            let subraceName = H.getR20attr(char, 'subrace')||''.replace(rxRace, '').replace(/\s*standard\s*/i,'');

            let traitsClass = [], traitsRace = [], traitsOther = [];
            let traitRows = char.attribs.filter(a=>a.name && a.name.match(/^repeating_traits_([A-Za-z0-9_-]{20})_name/i)).map(a=>a.name.match(/^repeating_traits_([A-Za-z0-9_-]{20})_name/i)[1]);
            traitRows.forEach(row => {
                let data = {
                    name: char.attribs.find(a=>a.name.match(`traits_${row}_name`)) ? char.attribs.find(a=>a.name.match(`traits_${row}_name`)).current : '',
                    source: char.attribs.find(a=>a.name.match(`traits_${row}_source`)) ? char.attribs.find(a=>a.name.match(`traits_${row}_source`)).current : '',
                    description: char.attribs.find(a=>a.name.match(`traits_${row}_description`)) ? char.attribs.find(a=>a.name.match(`traits_${row}_description`)).current : '',
                }
                data.sourceType += (char.attribs.find(a=>a.name.match(`traits_${row}_source_type`))) ? char.attribs.find(a=>a.name.match(`traits_${row}_source_type`)).current : '';
                if (/class/i.test(data.source) || this.rx.classes.test(data.source)) traitsClass.push(data);
                else if (/(race|racial)/i.test(data.source) || rxRace.test(data.source)) traitsRace.push(data);
                else traitsOther.push(data);
            });
            let tools = char.attribs.filter(a=>a.name.match(/^repeating_tool_[A-Za-z0-9_-]{20}_toolname/i)).map(a=>a.current);
            let profRows = char.attribs.filter(a=>a.name.match(/^repeating_proficiencies_[A-Za-z0-9_-]{20}_name/i)).map(a=>a.name.match(/^repeating_proficiencies_([A-Za-z0-9_-]{20})_name/i)[1]);
            profRows.forEach(row => {
                let data = {
                    name: char.attribs.find(a=>a.name.match(`proficiencies_${row}_name`)) ? char.attribs.find(a=>a.name.match(`proficiencies_${row}_name`)).current : '',
                    type: char.attribs.find(a=>a.name.match(`proficiencies_${row}_prof_type`)) ? char.attribs.find(a=>a.name.match(`proficiencies_${row}_prof_type`)).current : '',
                    //sourceType: charV.attribs.find(a=>a.name.match(`traits_${row}_source_type`)) ? charV.attribs.find(a=>a.name.match(`traits_${row}_source_type`)).current : '',
                }
                if (/lang/i.test(data.type)) languages.push(data.name);
                else if (/weap/i.test(data.type)) weaponProfs.push(data.name);
                else if (/arm/i.test(data.type)) armorProfs.push(data.name);
                else if (data.name) traitsOther.push(data.name);
            })
            let inventoryRows = char.attribs.filter(a=>a.name.match(/^repeating_inventory_[A-Za-z0-9_-]{20}_itemname/i)).map(a=>a.name.match(/^repeating_inventory_([A-Za-z0-9_-]{20})_itemname/i)[1]);
            let inventory = [];
            inventoryRows.forEach(row => {
                let data = {
                    name: H.getR20attr(char, `repeating_inventory_${row}_itemname`) || 'item',
                    quantity: H.getR20attr(char, `repeating_inventory_${row}_itemcount`) || 1,
                    weight: H.getR20attr(char, `repeating_inventory_${row}_itemweight`) || 0,
                    description: H.getR20attr(char, `repeating_inventory_${row}_itemcontent`) || '',
                    mods: H.getR20attr(char, `repeating_inventory_${row}_itemmodifiers`) || '',
                }
                inventory.push(data);
            });
            let spellnames = char.attribs.filter(a=>a.name.match(/^repeating_spell-[^_]+_[A-Za-z0-9_-]{20}_spellname/i)).map(a=>a.current.replace(/[^A-Za-z'/\s]/g,''));
            //let featureFolders = [];
            let classNotes = [], spellNotes = [], otherNotes = [];

            //  If NPC sheet without a premade sheet in the Compendium, convert Actions & find resistances etc.
            let npcActions = [];
            if (sheetType === 'npc') {
                await H.convertNpcActions(char).then(v => npcActions = v);

                let langs = (H.getR20attr(char, 'npc_languages')||'').split(/\s*,\s*/g);
                let langCust = [];
                if (langs.length) await Promise.all(langs.map(l=> {
                    l = l.trim()
                    if (l.match(/^(aarakocra|abyssal|aquan|auran|celestial|common|deep|draconic|druidic|dwarvish|elvish|giant|gith|gnoll|gnomish|goblin|halfling|ignan|infernal|orc|primordial|sylvan|terran|cant|undercommon)$/i)) charData.data.traits.languages.value.push(l.toLowerCase());
                    else langCust.push(l);
                })).then(() => {if (langCust.length) charData.data.traits.languages.custom = langCust.join('; ')});

                resistances = (H.getR20attr(char, 'npc_resistances')||'').match(this.rx.damageTypes);
                immunities = (H.getR20attr(char, 'npc_immunities')||'').match(this.rx.damageTypes);
                vulnerabilities = (H.getR20attr(char, 'npc_vulnerabilities')||'').match(this.rx.damageTypes);
                conditionImmunities = (H.getR20attr(char, 'npc_condition_immunities')||'').split(/\s*,\s*/g);
                let condCust = [];
                if (conditionImmunities.length) await Promise.all(conditionImmunities.map(ci=> {
                    if (this.rx.conditions.test(ci)) charData.data.traits.ci.value.push(ci.match(this.rx.conditions)[0].toLowerCase());
                    else condCust.push(ci);
                })).then(() => {if (condCust.length) charData.data.traits.ci.custom = condCust.join('; ')});
            }
            
            //  Now for the PC sheet, start with Class & Race...

            if (sheetType !== 'npc') {
                let classFolder = game.folders.find(f=>f.name === this.defaults.folders.classes);
                let featureFolder = game.folders.find(f=>f.name === this.defaults.folders.classFeatures);
                let baseClass = H.getR20attr(char, 'class') || '';
                let baseSubclass = H.getR20attr(char, 'subclass') || '';
                let baseLvl = H.getR20attr(char, 'base_level') || 0;
                if (baseClass) classNames.push(baseClass);
                let classObj;
                if (baseLvl) {
                    if (classFolder && featureFolder) {
                        if (baseClass & baseSubclass) {
                            let rxSubclass = new RegExp(`${baseSubclass}\\s*${baseClass}`,'i');
                            let objRef = game.items.find(i => i.folder === classFolder && i.name.match(rxSubclass));
                            classObj = (objRef) ? JSON.parse(JSON.stringify(objRef)) : null; 
                            if (classObj) {  // eslint-disable-next-line no-prototype-builtins
                                if (classObj.hasOwnProperty('flags')) delete classObj.flags;
                                classObj.data.levels = baseLvl;
                                classes.push(classObj);
                            }

                        }
                        if (baseClass && !classObj) {
                            let rxClass = new RegExp(`^\\s*${baseClass}\\s*$`,'i');
                            let objRef = game.items.find(i => i.folder === classFolder && i.name.match(rxClass));
                            classObj = (objRef) ? JSON.parse(JSON.stringify(objRef)) : null; 
                            if (classObj) {  // eslint-disable-next-line no-prototype-builtins
                                if (classObj.hasOwnProperty('flags')) delete classObj.flags;
                                classObj.data.levels = baseLvl;
                                classes.push(classObj);
                            } else classes.push({name: baseClass, type: 'class', data: {levels: baseLvl}});
                        }

                        //
                        // get multiclasses
                        let validMultis = char.attribs.filter(a=>a.name.match(/multiclass(\d+)_flag/i) && a.current == 1).map(a=>a.name.match(/(multiclass\d+)/i)[1]);
                        //console.log(validMultis);
                        validMultis.forEach(c=> { 
                            let mcClass = H.getR20attr(char,`${c}`);
                            let mcSubclass = H.getR20attr(char, `${c}_subclass`);
                            let mcLvl = H.getR20attr(char,`${c}_lvl`);
                            let mcClassObj;
                            if (mcClass) classNames.push(mcClass);
                            if (mcClass && mcSubclass) {
                                let rxmcSubclass = new RegExp(`${mcSubclass}\\s*${mcClass}`,'i');
                                let objRef = game.items.find(i => i.folder === classFolder && i.name.match(rxmcSubclass));
                                mcClassObj = (objRef) ? JSON.parse(JSON.stringify(objRef)) : null;  
                                if (mcClassObj) {  // eslint-disable-next-line no-prototype-builtins
                                    if (mcClassObj.hasOwnProperty('flags')) delete mcClassObj.flags;
                                    mcClassObj.data.levels = mcLvl;
                                    classes.push(mcClassObj);
                                }
                            }
                            if (mcClass && !mcClassObj) {
                                let rxmcClass = new RegExp(`^\\s*${mcClass}\\s*$`,'i');
                                let objRef = game.items.find(i => i.folder === classFolder && i.name.match(rxmcClass));
                                mcClassObj = (objRef) ? JSON.parse(JSON.stringify(objRef)) : null;  
                                if (mcClassObj) {   // eslint-disable-next-line no-prototype-builtins
                                    if (mcClassObj.hasOwnProperty('flags')) delete mcClassObj.flags;
                                    mcClassObj.data.levels = mcLvl;
                                    classes.push(mcClassObj);
                                } else classes.push({name: mcClass, type: 'class', data: {levels: mcLvl}});
                            }
                        });
                    } else console.error(`could not load class folder "${this.defaults.folders.classes}" or class feature folder "${this.defaults.folders.classFeatures}"!`);
                } else H.eLog(`No class levels found for ${charName}`, 'warn');
                /*if (classNames.length) { // add class folders to valid character feature search locations
                    classNames.forEach(cn => {
                        let rxClassName = new RegExp(`^${cn}`,'i')
                        if (game.folders.find(f => rxClassName.test(f.name))) featureFolders.push(game.folders.find(f => rxClassName.test(f.name))._id);
                    })
                }
                let filteredFeatures = game.items.entries.filter(i => featureFolders.includes(i.data.folder));
                if (filteredFeatures.length) console.log(filteredFeatures.map(f=>f.name))
                if (classNames.length) traitsClass.forEach(t => {
                    t.name = (/.*:.+/.test(t.name)) ? t.name.match(/.*:\s*(.+)/)[1] : t.name;
                    t.name = (/.+-.+/.test(t.name)) ? t.name.match(/(.+)-.* /)[1].trim() : t.name;
                    let rxTrait = new RegExp(`${t.name}`, 'i');
                    let feature = filteredFeatures.filter(i=>i.name.match(rxTrait));
                    if (feature.length === 1) characterFeatures.push(feature[0]);
                    else if (feature.length > 1) {
                        let rxTraitStart = new RegExp(`^\\s*${t.name}`, 'i');
                        let rxTraitEnd = new RegExp(`${t.name}\\s*$`, 'i');
                        if (feature.find(i=>i.name.match(rxTraitStart))) characterFeatures.push(feature.find(i=>i.name.match(rxTraitStart)));
                        else if (feature.find(i=>i.name.match(rxTraitEnd))) characterFeatures.push(feature.find(i=>i.name.match(rxTraitEnd)));
                        else classNotes.push(`${t.name} (${t.source})`);
                    }
                    else classNotes.push(`${t.name} (${t.source})`);
                })*/

                // find race
                let raceFolder = game.folders.entries.find(f=>f.name === this.defaults.folders.race);
                let raceFeatureFolder = game.folders.entries.find(f=>f.name === this.defaults.folders.raceFeatures);
                if (raceName) {
                    if (subraceName) {
                        let rxSub = new RegExp(`${subraceName}`,'i');
                        raceObjRef = game.items.find(i=>i.data.folder === raceFolder._id && rxRace.test(i.name) && rxSub.test(i.name))
                    }
                    if (!subraceName || !raceObj) {
                        raceObjRef = game.items.find(i=>i.data.folder === raceFolder._id && rxRace.test(i.name))
                    }
                    if (raceObjRef) {
                        raceObj = JSON.parse(JSON.stringify(raceObjRef));   // eslint-disable-next-line no-prototype-builtins
                        if (raceObj.hasOwnProperty('flags')) delete raceObj.flags;
                        characterFeatures.push(raceObj);
                    } else characterFeatures.push({name: `${raceName} (${subraceName})`, type: 'feat'});
                }
                if (traitsRace.length) {
                    let filteredFeatures = game.items.entries.filter(i=>i.data.folder === raceFeatureFolder._id);
                    traitsRace.forEach(t=> {
                        let rxTrait = new RegExp(`^\\s*${t.name}\\s*$`, 'i');
                        let feature = filteredFeatures.find(i=>i.name.match(rxTrait));
                        if (feature) characterFeatures.push(feature);
                        else classNotes.push(`${t.name} (${t.source})`);
                    })
                }
                if (classNotes.length) charData.data.details.notes.value += `<br><h1>Other Traits:</h1><br> ${classNotes.join('<br>')}`;

                // Grab Character background
                let bg = (charData.data.details.background.match(/\([^)]+\)/)) ? charData.data.details.background.match(/\(([^)]+)\)/)[1] : (charData.data.details.background) ? charData.data.details.background : '';
                if (bg) {
                    await H.getCompendiumEntry(this.compendium.packs.backgroundData, bg, false).then((bgItem) => {
                        if (bgItem) background = [bgItem];
                        else otherNotes.push(`<br><h2>Background: ${bg}</h2>`);
                    })
                }

                // Update character traits section
                let weaponCust = [], armorCust = [], langCust = [], toolsCust = [];
                if (weaponProfs.length) await Promise.all(weaponProfs.map(async (wp) => {
                    if (/martial/i.test(wp)) charData.data.traits.weaponProf.value.push('mar');
                    else if (/simple/i.test(wp)) charData.data.traits.weaponProf.value.push('sim');
                    else weaponCust.push(wp);
                })).then(() => {if (weaponCust.length) charData.data.traits.weaponProf.custom = weaponCust.join('; ')});
                if (armorProfs.length) await Promise.all(armorProfs.map(async (ap) => {
                    if (/light/i.test(ap)) charData.data.traits.armorProf.value.push('lgt');
                    else if (/medium/i.test(ap)) charData.data.traits.armorProf.value.push('med');
                    else if (/heavy/i.test(ap)) charData.data.traits.armorProf.value.push('hvy');
                    else if (/shield/i.test(ap)) charData.data.traits.armorProf.value.push('shl');
                    else armorCust.push(ap);
                })).then(() => {if (armorCust.length) charData.data.traits.armorProf.custom = armorCust.join('; ')});
                if (languages.length) await Promise.all(languages.map(async (l) => {
                    l = l.trim()
                    if (l.match(/^(aarakocra|abyssal|aquan|auran|celestial|common|deep|draconic|druidic|dwarvish|elvish|giant|gith|gnoll|gnomish|goblin|halfling|ignan|infernal|orc|primordial|sylvan|terran|cant|undercommon)$/i)) charData.data.traits.languages.value.push(l.toLowerCase());
                    else langCust.push(l);
                })).then(() => {if (langCust.length) charData.data.traits.languages.custom = langCust.join('; ')});
                if (tools.length) await Promise.all(tools.map(async (tl) => {
                    let preset = tl.match(/(art|disg|forg|game|herb|music|navg|pois|thief|vehicle)/i);
                    if (preset) charData.data.traits.toolProf.value.push(preset[1]);
                    else toolsCust.push(tl);
                })).then(() => {if (toolsCust.length) charData.data.traits.toolProf.custom = toolsCust.join('; ')});

                let traitNames = traitsRace.map(t=>t.name) + traitsClass.map(t=>t.name);
                let traitDescs = traitsRace.map(t=>t.description) + traitsClass.map(t=>t.description);
                let res = await traitDescs.match(/resist[^\s]*\s+(to|against)\s+([^\s]+)\sdamage/ig);
                let imm = await traitDescs.match(/immun[^\s]*\sto\s[^\s]+\sdamage/ig);
                let vul = await traitDescs.match(/vulnerab[^\s]*\s+to\s+([^\s]+)\s+damage/ig);
                if (res) {
                    res.forEach(r=>{if (this.rx.damageTypes.test(r)) resistances.push(r.match(this.rx.damageTypes)[0])});
                }
                if (imm) imm.forEach(r=>{if (this.rx.damageTypes.test(r)) immunities.push(r.match(this.rx.damageTypes)[1])});
                if (vul) vul.forEach(r=>{if (this.rx.damageTypes.test(r)) vulnerabilities.push(r.match(this.rx.damageTypes)[1])});
                await H.timeout(10);
                charData.data.attributes.senses.darkvision = (/superior darkvision/i.test(traitNames)) ? 120 : (/darkvision/i.test(traitNames)) ? 60 : 0;
            }
        
            if (resistances && resistances.length) charData.data.traits.dr.value = resistances;
            if (immunities && immunities.length) charData.data.traits.di.value = immunities;
            if (vulnerabilities && vulnerabilities.length) charData.data.traits.dv.value = vulnerabilities;
            

            // Search Compendiums for spells & inventory
            if (spellnames.length) {
                //console.log(`Finding spells for ${char.name}`, spellnames);
                await Promise.all(spellnames.map(async (spellname) => {
                    await H.getCompendiumEntry(this.compendium.packs.spellData, spellname).then(async (spell) => {
                        //console.log(spell);
                        if (spell) spells.push(spell);
                        else {
                            //console.log(`${spellname} not found, added to notes`);
                            spellNotes.push(spellname);
                        }
                    });
                }));
            }

            if (inventory.length) {
                await Promise.all(inventory.map(async (invItem) => {
                    await H.getCompendiumEntry(this.compendium.packs.itemData, invItem.name, false).then(async (item) =>{
                        if (item) items.push(item);
                        else {
                            let itemData = {
                                name: `${invItem.name}`,
                                type: 'loot',
                                data: {
                                    source: 'Importer',
                                    weight: invItem.weight,
                                    description: {value: invItem.description + '<br>' + invItem.mods},
                                    quantity: invItem.quantity,
                                }
                            }
                            items.push(itemData);
                        }
                    });
                }));
            }
            //console.log(`===inv`,inventory)
            //console.log(`===item`,items);
            

            if (spellNotes.length) charData.data.details.notes.value += `<br><h1>Spell notes:</h1><br>${spellNotes.join('<br>')}`;
            if (otherNotes.length) charData.data.details.notes.value += `<br><h1>Other notes:</h1><br>${otherNotes.join('<br>')}`;

            await Actor.create(charData).then(async (fChar) => {  // now we create embedded entities for class, spells etc.
                await H.timeout(20);
                if (classes.length) await fChar.createEmbeddedEntity("OwnedItem", classes);
                if (characterFeatures.length) await fChar.createEmbeddedEntity("OwnedItem", characterFeatures);
                if (background) await fChar.createEmbeddedEntity("OwnedItem", background);
                if (spells && spells.length) await fChar.createEmbeddedEntity("OwnedItem", spells);
                if (items && items.length) await fChar.createEmbeddedEntity("OwnedItem", items);
                if (npcActions && npcActions.length) await fChar.createEmbeddedEntity("OwnedItem", npcActions);
                
                this.directory.characterLinks.push(`${char.r20id}|${fChar._id}`);
                H.eLog(`Created ${fChar.name}`);
                this.counter.set('actors', 1);
            });
            await H.timeout(20);
        }
    }

}