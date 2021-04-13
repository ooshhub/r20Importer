/* globals ui, Scene, Dialog, CONFIG, canvas */

import R20Importer from './importer.js';


/* Splash page and progress bar for import process. Very silly. */
export default class Intro {

    static flags = {
        imgPath: './modules/r20import/assets/',
        scene: '',
        tile: '',
        text: '',
        currentIndex: 0,
        images: ['slide1.webm', 'slide2.webm', 'slide3.webm', 'slide4.webm', 'slide5.webm'],
        texts: ["Forcibly extracting Roll20 data. Slurp!", "There must be more data here somewhere!", "Stay strong Roll20, just checking a bit deeper!", "I think this might be the last of it.", "That's all the data! Are you OK, Roll20?"],
    }

    static async timeout (ms) {
        await new Promise(res=>setTimeout(res,ms))
    }

    static async nextSlide(final) {
        if (!Intro.flags.tile) return;
        if (final) Intro.flags.currentIndex = Intro.flags.images.length-1;
        canvas.tiles.get(Intro.flags.tile).update({img: `${Intro.flags.imgPath}${Intro.flags.images[Intro.flags.currentIndex]}`});
        if (Intro.flags.text) canvas.drawings.get(Intro.flags.text).update({text: `${Intro.flags.texts[Intro.flags.currentIndex]}`});
        Intro.flags.currentIndex ++;
    }

    static async drawLoadingPage () {

        console.log(`Starting Splash screen...`)
        let screenW = screen.width||1920;
        let screenH = screen.height||1080;
        
        let openWindows = ui.windows || null;
        if (openWindows) {
            for (let w in openWindows) ui.windows[w].close()
        }
        let oldSplash = game.scenes.entities.filter(sc => /importer\ssplash/i.test(sc.name));
        if (oldSplash.length) oldSplash.forEach(sc=>sc.delete());
        if (game.paused) game.togglePause();

        let slideW = 900, slideH = 500;

        const renderBar = async () => {

            let progressDialog = new Dialog({
                title: "Importer Progress",
                content: `<div class="import progress" id="myProgress"><div class="import progress" id="myBar"></div></div><hr><div id="toast" class="import progress">
					<span>Tickling Dragons...</span></div>`,
                buttons: {},
                default: "",
                render: () => startBar(),
                close: () => closeSplash(),
            }, {jQuery: false, top: 0});
            await progressDialog.render(true);


			const startBar = () => {

                if (progressDialog) progressDialog.setPosition({top: screenH*0.1, left: screenW/2 - screenW*0.2, width: screenW/4})
                let i = 0;
                let next = 20;
                let elem = document.getElementById("myBar");
                let id;
                const move = () => {
                    if (i == 0) {
                        i = 1;
                        id = setInterval(frame, 33);
                    }
                }
                const frame = () => {
                    CONFIG.OOSHR20I.progress = parseInt(R20Importer.counter.get('total')/R20Importer.importConfig.totalEntityPoints*100, 10);
                    if (CONFIG.OOSHR20I.progress >= 100 || CONFIG.OOSHR20I.forceComplete) { // add exit conditional for errors
                        elem.style.width = '100%';
                        clearInterval(id);
                        Intro.nextSlide(true);
                        progressDialog.close()
                        i = 0;
                        //if (this.flags.scene) game.scenes.get(this.flags.scene).delete();
                        //canvas.drawings.get(Intro.flags.text).update({text: `Import completed!`});
						// launch completion thingo
                    } else {
                        elem.style.width = `${CONFIG.OOSHR20I.progress}%`;
                        if (CONFIG.OOSHR20I.progress >= next) {
                            Intro.nextSlide();
                            next += 20;
                        }
                    }
                }
                move();
            }

            const closeSplash = async () => {

                const deleteScene = () => {
                    try{game.scenes.get(this.flags.scene).delete()}catch(err){console.log()}
                }

                await this.timeout(500);
                let closeDialog = new Dialog({
                    title: "Import completed",
                    content: `<div class="import closer" id="closer"><span>The show's over!</span></div>`,
                    buttons: {
                        one: {
                            icon: '<i class="fas fa-window-close"></i>',
                            label: "Click to close importer",
                            callback: () => deleteScene()
                        }
                    },
                    default: "",
                    render: () => moveCloseDialog(),
                    close: () => deleteScene(),
                }, {jQuery: false});
                await closeDialog.render(true);

                const moveCloseDialog = () => {closeDialog.setPosition({top:300})};
            }
        }

        let sceneData = {
            active: true,
            name: 'Temp importer splash',
            navName: 'Importer Splash',
            navigation: false,
            img: '',
            navOrder: 0,
            initial: {x: screenW/2+150, y: screenH/2-200, scale: 1.0},
            flags: {},
            width: screenW,
            height: screenH,
            backgroundColor: "#000000",
            gridType: 0,
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

        await Scene.create(sceneData).then(async (sc) => {
            this.flags.scene = sc._id;
            await this.timeout(2500);
			renderBar();
			await this.timeout(500);

            await sc.createEmbeddedEntity('Drawing', {
                type: "t",
                author: game.userId,
                x: (screenW - slideW)/2,
                y: (screenH - slideH)/2 - 90,
                width: 900,
                height: 90,
                hidden: false,
                locked: false,
                fillType: 0,
                fillColor: "",
                fillAlpha: 0,
                strokeWidth: 0,
                strokeColor: "",
                strokeAlpha: 1,
                text: "Preparing to enter Roll20 object....",
                fontFamily: "Signika",
                fontSize: 48,
                textColor: "#FFFFFF",
                textAlpha: 1,
              }).then(t => {
                Intro.flags.text = t._id;
            });

            await sc.createEmbeddedEntity("Tile", {
                name: 'bob',
                img: './import/splash/slide0.webm',
                width: slideW,
                height: slideH,
                x: (screenW - slideW)/2,
                y: (screenH - slideH)/2,
                hidden: false,
                locked: false,}).then(t => {
                    Intro.flags.tile = t._id;
                });
            
            
        });
        return true;
    }
}