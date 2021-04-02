/* globals Folder, CONFIG, ui, Actor, H */
//import * as JSZip from '../utils/jszip.js';
//import * as saveAs from '../utils/FileSaver.js';
import R20Importer from './importer.js';

export default class Helpers {

    static consoleStyles = {
        log: `color: cyan; background: dark grey; border: solid 1px gray; padding-left:10px; padding-right:10px; border-radius: 4px`,
        error: `color: red; background: lightgray; border: solid 1px red; padding-left:10px; padding-right:10px; border-radius: 4px; font-weight: bold`,
        info: `color: black; background: yellow; border: solid 1px gray; padding-left:10px; padding-right:10px; border-radius: 4px`,
        warn: `color: #b00; background: lightgray; border: solid 1px gray; padding-left:10px; padding-right:10px; border-radius: 4px`
    }

    static versionControl(schema) {
        const currentMininmum = 0.4;
        const currentExpected = 0.5;
        const schemaFloat = parseFloat(schema, 10);
        const asyncTest = (schema.match(/a$/i)) ? true : false;
        if (schemaFloat < currentMininmum) {
            console.log(`JSON is too outdated - please re-export from Roll20 with a newer version of R20Exporter.`);
            return false;
        }
        if (schemaFloat > currentExpected) console.log(`Newer version of JSON detected - Importer (${CONFIG.OOSHR20I.schemaVersion}) may be outdated.`) ;
        if (asyncTest) console.log(`WARNING! - JSON was exported with experimental build of Oosh's R20 Exporter.`);
        return schemaFloat;
    }

    static escapeRegex(string) {
        return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    static async timeout (ms) {
        await new Promise(res=>setTimeout(res,ms))
    }

     // default type is console.log, no UI report. uiType === true will trigger a UI notify with same type as console, if no uiMsg is set
     // then same message as console will be delivered. conStyle will match style to logging type unless set to FALSE (no style)
    static async eLog(message, conType, uiType, uiMsg, conStyle) {
        conType = /^i/.test(conType) ? 'info' :  /^w/.test(conType) ? 'warn' : /^e/.test(conType) ? 'error' : 'log';
        conStyle = (conStyle === false) ? '' : (!Object.keys(this.consoleStyles).includes(conStyle) || !conStyle) ? this.consoleStyles[conType] : conStyle;
        let styleMark = conStyle ? conStyle === 'info' ? '%cℹ️  ' : '%c' : '';
        console[conType](`${styleMark}${message}`, conStyle);
        if (uiType) {
            uiType = uiType === true ? conType === 'log' ? 'notify' : conType : uiType;
            uiMsg = uiMsg ? uiMsg : `${message}`;
            ui.notifications[uiType](uiMsg);
        }
    }

    static async getAverageFromArray (inputArr, second=false) {
        if (!Array.isArray(inputArr)) return null;
        let tally = await inputArr.reduce((acc, val) => {
            if (typeof acc[val] == 'undefined') {
                acc[val] = 1;
            } else acc[val] += 1;
            return acc;
        }, {});
        let max = Object.values(tally).sort((a,b)=>b-a)[0];
        let max2 = Object.values(tally).sort((a,b)=>b-a)[1];
        for (let i in tally) {
            if (!second && tally[i] === max) return i;
            else if (second && tally[i] === max2) return i;
        }
        return null;
    }

    static async grabLightSource(token, system, offsets, nocheck=false) {
        let offsetX = (offsets) ? offsets.offsetX : 0, offsetY = (offsets) ? offsets.offsetY : 0;
        //let mapScaling = (offsets) ? offsets.mapScaling : 1;
        let ta = token.attributes;
        if ((nocheck === true) ||
            ((ta.represents === "" && ta.controlledby === "") &&
            (!ta.light_hassight && !ta.has_bright_light_vision) &&
            ( (ta.light_otherplayers && ta.light_radius > 0)
            || (ta.emits_bright_light && ta.bright_light_distance > 0)))
            )
        {
            let brightRadius, dimRadius, lightAngle, brightVision, dimVision, visionAngle;
            if (system === 'updated') {
                brightRadius = parseInt(ta.bright_light_distance, 10);
                dimRadius = parseInt(ta.low_light_distance, 10);
                lightAngle = parseInt(ta.directional_bright_light_total, 10)||0;
                if (nocheck && (ta.has_bright_light_vision || ta.has_low_light_vision)) {
                    brightVision = parseInt(ta.bright_light_vision_distance, 10);
                    dimVision = parseInt(ta.low_light_vision_distance, 10);
                    visionAngle = lightAngle = parseInt(ta.limit_field_of_vision_total, 10)||0;
                }
            } else {
                brightRadius = (!(ta.light_dimradius) || isNaN(ta.light_dimradius)) ? parseInt(ta.light_radius, 10)||0 : Math.max(0, ( Math.min(parseInt(ta.light_dimradius, 10), parseInt(ta.light_radius, 10))));
                dimRadius = (parseInt(ta.light_radius, 10) <= brightRadius) ? 0 : parseInt(ta.light_radius, 10)||0;
                lightAngle = parseInt(ta.light_angle, 10)||0;
                if (nocheck || ta.light_hassight) {
                    brightVision = brightRadius;
                    dimVision = dimRadius;
                    visionAngle = lightAngle;
                }
            }
            let lightData = {
                flags: {},
                t: "l",
                x: (offsetX + parseInt(ta.left, 10) - parseInt(ta.width, 10)/2) || 70,
                y: (offsetY + parseInt(ta.top, 10) - parseInt(ta.height, 10)/2) || 70,
                hidden: false,
                rotation: parseInt(ta.rotation, 10) || 0,
                dimSight: dimVision || 0,
                brightSight: brightVision || 0,
                sightAngle: (visionAngle > 1 && visionAngle < 360) ? visionAngle : 360,
                dim: (ta.light_otherplayers) ? dimRadius : 0,
                bright: (ta.light_otherplayers) ? brightRadius : 0,
                angle: (lightAngle > 1 && lightAngle < 360) ? lightAngle : 360,
                darknessThreshold: 0,
                tintAlpha: 0.49,
                lightAnimation: {
                    speed: 5,
                    intensity: 5
                },
                locked: false,
                tintColor: "#000000"
            }
            return await lightData;
        } else return false;
    }

    static isValidHex(color) {
        let regex6 = /^#[a-fA-F0-9]{6}$/;
        let regex3 = /^#[a-fA-F0-9]{3}$/;
        if (color.match(regex6)) return color;
        else if (color.match(regex3)) {
            let x = color;
            let newColor = `#${x[1]}${x[1]}${x[2]}${x[2]}${x[3]}${x[3]}`
            return newColor;
        } else return false;
    }

    static rgbToHex(input) {
        if (!input) return null;
        const regex = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/;
        let c = input.match(regex);
        if (c) {
            let r = parseInt(c[1], 10), g = parseInt(c[2], 10), b = parseInt(c[3], 10);
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        } else return null;
    }

    static async getCampaignSettings(campaign) {
        if (campaign.pages && campaign.pages.length > 0) {
            let snappingValues = await Promise.all(campaign.pages.map(p=>p.attributes.snapping_increment));
            let pageLightingValues = await Promise.all(campaign.pages.map(p=>p.attributes.dynamic_lighting_enabled));
            let snapping = this.getAverageFromArray(snappingValues);
            let lighting = this.getAverageFromArray(pageLightingValues);
            let output = {
                snapping_increment: (snapping) ? snapping : 1,
                lighting: (/(updated|legacy)/i.test(lighting)) ? lighting : 'legacy'
            };
            console.log(`Get campaign defaults: `,output);
            return await output;
        }
    }

    static async checkScale(gridSize, snappingIncrement) {
        let r20gridSize = (!isNaN(snappingIncrement) && snappingIncrement > 0) ? gridSize*snappingIncrement : 70;
        let output;
        if (r20gridSize < 50) {
            output = {
                pixelsPerSquare: 70,
                scale: 70/r20gridSize
            }
        } else {
            output = {
                pixelsPerSquare: r20gridSize,
                scale: 1
            }
        }
        return output;
    }

    static findBackgroundImage(tokenArray, sceneAttributes, gridScale, imgtype) {
        let sc = sceneAttributes;
        let bgImgFinder = [];
        let pixelsPerSquare = gridScale.pixelsPerSquare;
        let mapScaling = gridScale.scale;
        let scWidth = Math.floor(sc.width*pixelsPerSquare), scHeight = Math.floor(sc.height*pixelsPerSquare);
        tokenArray.forEach((t, i) => {
            bgImgFinder[i] = parseInt(t.attributes.width, 10)*parseInt(t.attributes.height, 10) || 0;
        });
        let maxPixels = Math.max(...bgImgFinder); // find largest map image and apply it as a background
        let maxIndex = bgImgFinder.indexOf(maxPixels);
        let t = tokenArray[maxIndex];
        let ta = tokenArray[maxIndex].attributes;
        let imgpath = (imgtype === 'local') ? game.settings.get('r20-importer', 'importImagePath') + t.image : ta.imgsrc;

        if (ta.width && ta.height) {
            let w = Math.floor(ta.width), h = Math.floor(ta.height);
            console.log(`Canvas: ${scWidth}x${scHeight}, Image: ${w}x${h}`);
            if (scWidth > w || scHeight > h) {
                if ((w*h/(scWidth*scHeight)) < 0.85) return null;
                let padding = Math.max(scWidth/w, scHeight/h) - 1
                padding = (Math.ceil(padding*20))/20;
                let newPixelsX = Math.ceil((w/pixelsPerSquare)*padding)*pixelsPerSquare, newPixelsY = Math.ceil((h/pixelsPerSquare)*padding)*pixelsPerSquare;
                let offsetx = w/2 + newPixelsX - sc.width*pixelsPerSquare/2, offsety = h/2 + newPixelsY - sc.height*pixelsPerSquare/2;
                let obj = {
                    sceneWidth: w*mapScaling,
                    sceneHeight: h*mapScaling,
                    scenePadding: padding,
                    image: imgpath,
                    index: maxIndex,
                    offsetX: offsetx,
                    offsetY: offsety,
                    pps: pixelsPerSquare,
                }
                console.log(obj);
                return obj;
            } else if (scWidth === w && scHeight === h) {
                let obj = {
                    sceneWidth: w*mapScaling,
                    sceneHeight: h*mapScaling,
                    scenePadding: 0,
                    image: imgpath,
                    index: maxIndex,
                    offsetX: 0,
                    offsetY: 0,
                    pps: pixelsPerSquare,
                }
                console.log(obj);
                return obj;
            } else {
                console.log('Map image larger than canvas! Not applied to background.');
                return null;
            }
        } else return null;
    }

    static async makeFolder(data, parentIds, depth=0) {
        let folderData = {
            name: data.n || "",
            type: "JournalEntry",
            sort: null,
            flags: {},
            parent: parentIds[0] || null,
            sorting: "m",
            color: "",
            tier: depth,
            r20id: data.id || null,
        }
        let folderDataC = {
            name: data.n || "",
            type: "Actor",
            sort: null,
            flags: {},
            parent: parentIds[1] || null,
            sorting: "m",
            color: "",
            tier: depth,
            r20id: data.id || null,
        }
        let newFolder = await Folder.create(folderData).then((v) => {return v._id});
        let newFolderC = await Folder.create(folderDataC).then((v) => {return v._id});
        let newFolderIds = [newFolder, newFolderC]
        return newFolderIds;
    }

    static async cleanupFoldersAsync() {
        let totalCounter = 0;
        const deleteFolders = async () => {
            console.log(`=== FOLDER CLEANUP STARTED ===`);
            for (let j=3; j>0; j--) {
                let deleteCounter = 0;
                await Promise.all(game.folders.entries.map(async f => {
                    await this.timeout(200);
                    if (f && (f.data.type === 'Actor' || f.data.type === 'JournalEntry') && !f.content.length && !f.children.length && f.depth === j) {
                        try{f.delete()}catch(err){console.log('blat!')}
                        deleteCounter ++;
                    }
                }));
                console.log(`=== Deleted ${deleteCounter} Folders at depth ${j}. ===`);
                totalCounter += deleteCounter;
                await this.timeout(1000);
            }
            console.log(`=== FOLDER DELETE DONE ===`);
        }
        await deleteFolders().then(async () => {
            let ia = 0, ij = 0;
            await Promise.all(game.folders.entries.map(async (f) => {
                //console.log(`${f.data.type} ${ic} ${ij} ${f._id}`);
                if (f.data.type.match(/actor/i)) {
                    ia += 1;
                    //console.log(`charIndex: ${ic}`);
                    let folder = game.folders.get(f._id);
                    if (folder) try{await folder.update({sort: parseInt(`${ia}00000`)})}catch(err){this.eLog(err, 'error', true)}
                } else if (f.data.type.match(/journal/i)) {
                    ij += 1;
                    //console.log(`journalIndex: ${ic}`);
                    let folder = game.folders.get(f._id);
                    if (folder) try{await folder.update({sort: parseInt(`${ij}00000`)})}catch(err){this.eLog(err, 'error', true)}
                }
            })).catch((err) => this.eLog(err, 'error'));
        });
        await this.timeout(500);
        return totalCounter;
    }

    static getR20attr(target, attr, curMax='current', strictStart=true, strictEnd=true) {
        curMax = (/max/i.test(curMax)) ? 'max' : 'current';
        attr = this.escapeRegex(attr);
        let ss = (strictStart) ? '^' : '', se = (strictEnd) ? '$' : '';
        let attrRx = new RegExp(`${ss}\\s*${attr}\\s*${se}`,'i');
        let a = target.attribs.find(attr => attrRx.test(attr.name));
        if (typeof(a) !== 'undefined') {
            if (!isNaN(a[curMax])) return parseInt(a[curMax], 10);
            else if (a) return a[curMax];
        } //else console.warn(`Could not find r20 Attribute: ${attr} on ${target.name}`);
        return null;
    }

    static properise(input) {
        if (!input) return null;
        input = (Array.isArray(input)) ? input : input.split(/\s+/g);
        let output = input.map(word => `${word.trim()[0].toUpperCase()}${word.trim().slice(1).toLowerCase()}`);
        return output.join(' ');
    }

    static async getCompendiumEntry(pack, itemName, strict=true) {
        let result;
        if (!pack || typeof(pack.index) === 'undefined') {console.error(`Compendium Pack "${[pack]} is not correctly loaded or getIndex()ed.`);return null}
        itemName = this.escapeRegex(itemName);
        let rxName = (strict) ? new RegExp(`^\\s*${itemName}\\s*$`,'i') : new RegExp(`${itemName}`,'i');
        let itemRef = pack.index.find(item => rxName.test(item.name));
        if (itemRef) {
            result = await pack.getEntity(itemRef._id).then(i => i);
        } else result = null;
        return await result;
    }

    static async convertNpcActions(char) {
        let npcactions = [];
        npcactions.push(...char.attribs.filter(a=>a.name && a.name.match(/^repeating_npcaction_([A-Za-z0-9_-]{20})_name/i)).map(a=>a.name.match(/^repeating_npcaction_([A-Za-z0-9_-]{20})_name/i)[1]));
        npcactions.push(...char.attribs.filter(a=>a.name && a.name.match(/^repeating_npctrait_([A-Za-z0-9_-]{20})_name/i)).map(a=>a.name.match(/^repeating_npctrait_([A-Za-z0-9_-]{20})_name/i)[1]));
        npcactions.push(...char.attribs.filter(a=>a.name && a.name.match(/^repeating_npcreaction_([A-Za-z0-9_-]{20})_name/i)).map(a=>a.name.match(/^repeating_npcreaction_([A-Za-z0-9_-]{20})_name/i)[1]));
        let attacks = [];
        await Promise.all(npcactions.map(row => {
            let actionType = (!this.getR20attr(char, `repeating_npcaction_${row}_attack_flag`)) ? `feat` : `weapon`;
            let desc = this.getR20attr(char, `_${row}_description`, 'current', false) ? this.getR20attr(char, `_${row}_description`, 'current', false) : this.getR20attr(char, `_${row}_desc`, 'current', false) ? this.getR20attr(char, `_${row}_desc`, 'current', false) : ``;
            let newData;

            if (actionType === `feat`) {
                newData = {
                    name: this.getR20attr(char, `_${row}_name`, 'current', false)||'Unknown Ability',
                    type: actionType||'feat',
                    data: {
                        description: {
                            value: (desc) ? `<div><p>${desc}</p></div>` : ``,
                            chat: "",
                            unidentified: ""
                        },
                        activation: {
                            type: this.getR20attr(char, `repeating_npcreaction_${row}_name`) ? 'reaction' : /action/i.test(desc) ? /bonus/i.test(desc) ? 'bonus action' : 'action' : '',
                            cost: 1
                        }
                    },
                    img: /multi/i.test(this.getR20attr(char, `_${row}_name`, 'current', false)) ? `systems/dnd5e/icons/skills/weapon_24.jpg` : `systems/dnd5e/icons/skills/red_25.jpg`,
                }
            } else {
                let attackType = (/spell/i.test(this.getR20attr(char, `repeating_npcaction_${row}_attack_type`))) ? /range/i.test(this.getR20attr(char, `repeating_npcaction_${row}_attack_type`)) ? `Ranged Spell` : `Melee Spell` : /range/i.test(this.getR20attr(char, `repeating_npcaction_${row}_attack_type`)) ? `Ranged Weapon` : `Melee Weapon`;
                newData = {
                    name: this.getR20attr(char, `repeating_npcaction_${row}_name`)||'Unknown Weapon',
                    type: actionType||'feat',
                    data: {
                        description: {
                            value: (desc) ? `<div><p>${desc}</p></div>` : ``,
                            chat: "",
                            unidentified: ""
                        },
                        source: "Custom",
                        quantity: 1,
                        weight: 0,
                        price: null,
                        attuned: false,
                        attunement: 0,
                        equipped: true,
                        rarity: "",
                        identified: false,
                        activation: {
                            type: /bonus action/i.test(desc) ? 'bonus action' : 'action',
                            cost: 1,
                            condition: ""
                        },
                        range: {
                            value: (this.getR20attr(char, `repeating_npcaction_${row}_attack_range`)||``.match(/(\d+)/)) ? this.getR20attr(char, `repeating_npcaction_${row}_attack_range`)||``.match(/(\d+)/)[1] : 5,
                            long: (this.getR20attr(char, `repeating_npcaction_${row}_attack_range`)||``.match(/\/(\d+)/)) ? this.getR20attr(char, `repeating_npcaction_${row}_attack_range`)||``.match(/\/(\d+)/)[1] : 0,
                            units: "ft"
                        },
                        uses: {
                            value: 0,
                            max: 0,
                            per: null
                        },
                        consume: {
                            type: "",
                            target: null,
                            amount: null
                        },
                        ability: (/spell/i.test(attackType) && this.getR20attr(char, `_${row}spellcasting_ability`).match(/(wis|cha|int)/i)) ? this.getR20attr(char, `_${row}spellcasting_ability`).match(/(wis|cha|int)/i)[1] : (this.getR20attr(char, `_${row}dexterity_mod`) > this.getR20attr(char, `_${row}strength_mod`)) ? `dex` : `str`,
                        actionType: (/spell/i.test(attackType)) ? (/range/i.test(attackType)) ? `rsak` : `msak` : (/range/i.test(attackType)) ? `rwak` : `mwak`,
                        attackBonus: 0,
                        chatFlavor: "",
                        critical: null,
                        damage: {
                            parts: [
                            [
                                this.getR20attr(char, `repeating_npcaction_${row}_attack_damage`)||``,
                                this.getR20attr(char, `repeating_npcaction_${row}_attack_damagetype`)||``
                            ],
                            [
                                this.getR20attr(char, `repeating_npcaction_${row}_attack_damage2`)||``,
                                this.getR20attr(char, `repeating_npcaction_${row}_attack_damagetype2`)||``
                            ]
                            ],
                            versatile: ""
                        },
                        formula: "",
                        save: {
                            ability: (/saving throw/i.test(desc) && /(strength|dexterity|constitution|wisdom|intelligence|charisma)/i.test(desc)) ? desc.match(/(strength|dexterity|constitution|wisdom|intelligence|charisma)/i)[1] : ``,
                            dc: (/saving throw/i.test(desc) && /dc\s*(\d+)/i.test(desc)) ? desc.match(/dc\s*(\d+)/i)[1] : null,
                            scaling: /saving throw/i.test(desc) ? "flat" : ``,
                        },
                        /*armor: {
                            value: 10
                        },
                        hp: {
                            value: 0,
                            max: 0,
                            dt: null,
                            conditions: ""
                        },*/
                        weaponType: "natural",
                        properties: {},
                        proficient: true
                        },
                    flags: {},
                    img: /bite/i.test(this.getR20attr(char, `repeating_npcaction_${row}_name`)) ? `systems/dnd5e/icons/skills/red_29.jpg` : /claw/i.test(this.getR20attr(char, `repeating_npcaction_${row}_name`)) ? `systems/dnd5e/icons/skills/red_20.jpg` : (/spell/i.test(attackType)) ? (/range/i.test(attackType)) ? `systems/dnd5e/icons/spells/fireball-red-1.jpg` : `systems/dnd5e/icons/spells/enchant-jade-2.jpg` : (/range/i.test(attackType)) ? `systems/dnd5e/icons/items/weapons/crossbow-heavy.jpg` : `systems/dnd5e/icons/items/weapons/greatsword.png`,
                    effects: [],
                }
            }
            attacks.push(newData);
        }))//.then(() => console.log(`=== Processed NPC actions for ${char.name} ===`));

        return await attacks;
    }

    //  Shortcut Combo function for getting & setting game settings
    static async stg (key, setVal=undefined) {
        let module = (CONFIG.OOSHR20I.moduleName) ? CONFIG.OOSHR20I.moduleName : 'r20import';
		if (setVal !== undefined) {
			await game.settings.set(module, key, setVal);
		}
		return game.settings.get(module, key)
    }

    //  Is NPC? check for roll20 token=>char=>controlleby path
    static isNpc (token, directory) {
        let reps = token.attributes.represents;
        if (!reps || !/[A-Za-z0-9_-]{20}/.test(reps)) return true;
        if (!directory) {console.warn(`No character directory for Helpers.isNpc function`);return true}
        let char = directory.find(c => c.id === reps);
        if (!char || !char.controlledby) return true;
        else return false;
    }

    static decodeHE = (inputString) => {
        return inputString.replace(/&#(\d+);/g, function(match, dec) {
          return String.fromCharCode(dec);
        });
    }

    /* Feed function RegExp results of a r20 link where {p1} is the link and {p2} is the label, eg [Goblin](http:/r20.app/character/-89hf28h3f9hfwssf)
        returns a Foundry link => 
            if found in the import id directory, @EntityClass[Entity._id]
            if not found in ID directory, @EntityClass[Entity.name] via another regex search
            if not found in game.entities, @EntityClass[p2], just returns a reference using the input label */
    static async getFoundryLink(match, p1, p2) {
        //console.log(`starting link getter for ${p1}`);
        let eType = /character/i.test(p1) ? 'Actor' : /handout/i.test(p1) ? 'JournalEntry' : /^\d+$/.test(p1) ? 'RollTable' : 'href';
        let newLink;
        if (eType === 'href') return null;
        if (eType !== 'RollTable') {
            let linkDir = (eType === 'Actor') ? R20Importer?.directory?.characterLinks : R20Importer?.directory?.handoutLinks||null;
            let r20id = await p1.match(/-[A-Za-z0-9_-]{19}/);
            if (r20id && linkDir) {
                let rxID = new RegExp(`${r20id}`);
                let foundryId = linkDir.find(id => rxID.test(id))?.match(/\|(.+)/)?.[1];
                if (foundryId) newLink = `@${eType}[${foundryId}]`
            }
        }
        if (!newLink) {
            let escName = await p2.trim().replace(/s$/i, '')//.replace(/-/g, '\\.+')
            let rxName = new RegExp(`${escName}`,'i');
            let entity = (eType === 'Actor') ? 'actors' : (eType === 'JournalEntry') ? 'journal' : 'tables';
            
            let linkName = await game[entity]?.entities?.find(e=>rxName.test(e.name))?.name||null;
            //console.log(linkName);
            if (linkName) newLink = `@${eType}[${linkName}]`
        }
        newLink = newLink ? newLink : `@${eType}[${p2}]`
        return newLink;
    }

    /* parse R20 handout to replace <a href> links with Foundry internal links
        ***  TO DO: Helper functions to fix up formatting, <h3> <h4> etc. */
    static async parseHandout(input) {
        let res;
        let output = input.data.content;
        let replaceLink, diff;
        //console.log(`Starting parser for ${input.name}`);
        const rxLink = /<a href="(.*?)">(.*?)<\/a>/g
    
        while ((res = rxLink.exec(output)) !== null) {
            await this.getFoundryLink(res, res[1], res[2]).then(async (v) => {
                if (v) {
                    replaceLink = v;
                    output = await output.replace(res[0], replaceLink);
                    diff = replaceLink.length - res[0].length;
                    rxLink.lastIndex += diff;
                }
            });
        }
        output = await output
            .replace(/<h3>/ig, '<h3><b><i>').replace(/<\/h3>/ig, '</h3></b></i>')
            .replace(/<h4>/ig, '<h4><b>').replace(/<\/h4>/ig, '</h4></b>')
            .replace(/<h5>/ig, '<h5><u>').replace(/<\/h5>/ig, '</h5></u>');
        // fix up HTML styles here
        return output;
    }

	/* Importer for non-dnd5e OGL sheets. Very basic, entire Array of R20 attribs is dumped in {flags.r20attrs} */
    static async processGenericCharacter(char, sheetType) {

        let parentFolder = (this.directory.folderEntries[`c${char.r20id}`]) ? this.directory.folderEntries[`c${char.r20id}`] : this.directory.folderEntries.homelessFolderC;
        let html = (char.bio && char.bio !== 'undefined') ? char.bio : "";
        let html2 = (char.gmnotes && char.gmnotes !== 'undefined') ? char.gmnotes : "";
        let divider = (html && html2) ? `<br><br><br><h2>GM Notes</h2>` : (html2) ? '<h2>GM Notes</h2>' : '';
        let imgpath = (char.images === 'local' && /(jpg|png|gif|bmp|jpeg|svg)\s*$/i.test(char.image)) ? `${game.settings.get('r20import', 'importImagePath')}${char.image}` : char.avatar ;
        let avatar = (char.avatar.match(/(.jp|.gif|.png)/)) ? `<img src="${imgpath}"/>` : '';
        let defToken;
        let charName = char.name;
        let charData;

        charData = {
            name: charName || "",
            type: sheetType,
            img: imgpath || "icons/svg/mystery-man.svg",
            data: {},
            flags: {
                r20attrs: char.attribs,
                bio: avatar + html + divider + html2,
            },
            token: {
                img: imgpath || "icons/svg/mystery-man.svg",
            },
            items: [],
            effects: [],
            folder: parentFolder || null,
            r20id: char.r20id || null,
        }

        if (char.defaulttoken) {
            try {defToken = await JSON.parse(char.defaulttoken)}catch(err){defToken = null}
            if (defToken) {
                let token = {attributes: defToken};
                //console.log(`=== DefTok passing through to light calcs: `, token);
                await Helpers.grabLightSource(token, this.importConfig.defaultLighting, {offsetX: 0, offsetY: 0, mapScaling: this.importConfig.defaultMapScaling}, true)
                    .then(lightCalcs => {
                        //console.log(`=== LightCalcs received: `, lightCalcs);
                        charData.token = {
                            flags: {},
                            name: defToken.name,
                            displayName: (sheetType === 'npc') ? 20 : 30,
                            img: defToken.imgsrc,
                            tint: defToken.tint_color,
                            width: defToken.width/this.defaults.defaultPixelsPerSquare*this.defaults.defaultMapScaling || 1,
                            height: defToken.height/this.defaults.defaultPixelsPerSquare*this.defaults.defaultMapScaling || 1,
                            scale: this.defaults.defaultMapScaling || 1,
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

        await Actor.create(charData).then(async (fChar) => {  // now we create embedded entities for class, spells etc.
            this.directory.characterLinks.push(`${char.r20id}|${fChar._id}`);
            Helpers.eLog(`Created ${fChar.name}`);
            this.counter.set('actors', 1);
        });
        await Helpers.timeout(20);        
    }
                

    //  Extract images from ZIP file
    //  DISABLED - works, but need to find a way to disable "save as..." prompt. Too many files!

    /*static async extractImages(inputZip) {
        this.eLog(`Passed through file: ${inputZip?.name||'<no filename found>'}`);
        let extractPath = this.stg('importImagePath');
        this.eLog(extractPath);
        if (!extractPath) {this.eLog(`No image path found, cannot extract images to root DATA folder`, 'error', true); return}
        let reader = new FileReader();
        reader.readAsArrayBuffer(inputZip);
        reader.onload = (ev) => {
            console.log(ev);
            let zip = new JSZip();
            zip.loadAsync(ev.target.result)
                .then(async (contents) => {
                    let fileList = Object.keys(contents.files);
                    this.eLog(fileList, 'info');
                    await Promise.all(Object.keys(contents.files).map(async (filename) => {
                        this.eLog(`Processing ${filename}`)
                        let dest = /\/$/.test(extractPath) ? extractPath : `${extractPath}/`;
                        contents.file(filename).async('blob')
                            .then(async data => {
                                //saveAs(data, `${dest}${filename}`);
                                saveDataToFile(data, 'blob', filename)
                                this.eLog(`Extracted file "${filename}"`);
                            });
                    }));
                });
            }
    }*/

}