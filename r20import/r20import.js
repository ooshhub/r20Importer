/* globals Hooks, CONFIG, FormApplication*/
// import scripts here
import R20Importer from "./scripts/importer.js";
import H from './scripts/helpers.js';
//import Splash from './scripts/silly.js';

CONFIG.OOSHR20I = {
    version: 0.82,
    schemaVersion: 0.7,
    moduleName: 'r20import',
    progress: 0,
	forceComplete: false,
}

let settings = {}; // settings object for building menu HTML from getData() function
let ogl5eSupport; // variable for 5e OGL sheet detection

export default class R20ImporterSettings extends FormApplication {

    /**@override*/
    static get defaultOptions() {
        return {
            ...super.defaultOptions,
            id: "r20importer",
            classes: ["r20import", "importer"],
            title: "Oosh's Roll20 Importer",
            template: "./modules/r20import/templates/r20import.html",
            width: 'auto',
            height: 'auto',
            popOut: true,
            submitOnClose: false,
			closeOnSubmit: false,
        };
    }

    /** @override */
    async getData() {
        let select = {
            type: {
                choices: {'remote': "Remote", 'local': 'Local'},
                value: await H.stg('imageType'),
            },
            ogl5e: {
                choices: {'auto': "Auto (Default)", 'on': "5e OGL", 'off': "Other sheet"},
                value: await H.stg('ogl5e')||'auto',
            }
        }
        settings.imageType = await  H.stg('imageType')||'';
        settings.imagePath = await H.stg('importImagePath')||'';
        settings.typeDisplay = (settings?.imageType === 'local') ? '' : 'none';
        settings.zipDisplay = (settings?.importZip === 'yes') ? '' : 'none';
        return {
            settings,
            select
        }
    }

    /**@override */
    activateListeners(html) {
        super.activateListeners(html);
        html.find('#import-start-button').on("click", R20Importer.startImport.bind(R20Importer));
        html.find('#import-image-type').change((ev)=> { // User select Local or Remote images
            let newVal = ev.target?.value;
            document.getElementById('import-type-div').style.display = (newVal === 'local') ? '' : 'none';
            H.stg('imageType', newVal);
        });
        html.find('#import-json').change(async (ev) => { // User select Import File (JSON)
            await R20ImporterSettings.get5eOglCompatibility(ev);
            document.getElementById('ogl5eSupport').innerText = (ogl5eSupport === 1) ? `Roll20 5e OGL sheet support confirmed!` : (ogl5eSupport === 0) ? `Could not determine 5e OGL sheet support, select manual option.` : (ogl5eSupport === -1) ? `Campaign does not appear to support 5e OGL sheet functions, may have poor results.` : ``;
            R20Importer.importConfig.ogl5e = (await H.stg('ogl5e') === 'on' || (await H.stg('ogl5e') === 'auto' && ogl5eSupport === 1)) ? true : false;
            if (ev?.target?.files.length && ogl5eSupport === 1) {
                document.getElementById('import-start-button').disabled = false;
                document.getElementById('import-start-button').innerText = 'Start Import!';
            } else if (ev?.target?.files.length) document.getElementById('import-start-button').innerText = 'Select 5e OGL option...';
        });
        html.find('#import-5eogl').change(async (ev) => { // User select Roll20 dnd5e OGL sheet functions enabled/disabled/auto-detect
            let setting = (ev?.target?.value), newVal;
            if (document.getElementById('import-json')?.files?.length && (!ogl5eSupport || setting === 'auto')) await R20ImporterSettings.get5eOglCompatibility(ev);
            await H.stg('ogl5e', setting).then(v => newVal = v);
            R20Importer.importConfig.ogl5e = (newVal === 'on' || (newVal === 'auto' && ogl5eSupport === 1)) ? true : false;
            if (document.getElementById('import-json')?.files?.length && (setting !== 'auto' || ogl5eSupport !== 0)) {
                document.getElementById('import-start-button').disabled = false;
                document.getElementById('import-start-button').innerText = 'Start Import!';
            } else if (setting !== 'auto' || ogl5eSupport !== 0) document.getElementById('import-start-button').innerText = 'No Campaign selected...';
            
        })
    }

    /**override */
    /*_updateObject (event, formData) {
        console.log(`update Object, object then formData follow`,event,formData, 'end of update object');
        //super._updateObject();
        return;
    }*/

    static async get5eOglCompatibility(ev) { // Scan Campaign file for dnd5e sheet attributes
        let getFile = R20Importer.startImport.bind(R20Importer, ev, true);
        let campaign = await getFile();
        H.eLog(`Determining OGL compatibility for ${campaign.name}`);   // eslint-disable-next-line no-prototype-builtins
        if (campaign.hasOwnProperty('ogl5e')) ogl5eSupport = (campaign.ogl5e) ? 1 : -1;
        else {
            let charAttrs = campaign.characters?.[0]?.attribs || null;
            if (charAttrs && charAttrs.find(a=>a.name === 'l1mancer_status')) ogl5eSupport = 1; // extra search? probs not
            else ogl5eSupport = 0;
        }
        H.eLog(`OGL: ${ogl5eSupport > 0 ? true : false}`);
        return ogl5eSupport;
    }

    static init() {
        
        // set up menu
        game.settings.registerMenu("r20import", "importer", {
            name: "Open Oosh's Roll 20 Importer",
            label: "Open Importer Menu",
            hint: "",
            icon: "fas fa-file-import",
            restricted: false,
            type: R20ImporterSettings,
        });

        game.settings.register("r20import", "importImagePath", { 
            name: "Imported Images Destination (./data/)",
            hint: "Where the zipped Campaign images will be copied to. Default is <current world>/impimg/",
            scope: "world",
            config: false,
            default: `worlds/${game?.data?.world?.name||'WORLDNAME'}/images/imported/`,
            type: String,
        });

        game.settings.register("r20import", "imageType", {
            name: "Image Type",
            hint: "Link images as local or remote",
            scope: "world",
            config: false,
            default: 'remote',
            type: String
        });

        game.settings.register("r20import", "importJSON", {
            name: "Campaign file to import",
            hint: "",
            scope: "world",
            config: false,
            default: "no",
            type: String,
        });

        game.settings.register("r20import", "ogl5e", {
            name: "5e OGL",
            hint: "Enable character and macro import from Roll20 dnd5e OGL campaign",
            scope: "world",
            config: false,
            default: "auto",
            type: String
        });

    }
}



Hooks.once('ready', () => {
    // register a tooltip Handlebar Helper here
    R20ImporterSettings.init()});