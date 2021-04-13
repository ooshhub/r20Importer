/* globals Scene, */

import R20Importer from './importer.js';


/* Splash page and progress bar for import process. Very silly. */
export default class Intro {

    static flags = {
        //imgPath: './modules/r20import/assets/',
        scene: '',
        tile: '',
        text: '',
        currentIndex: 0,
        charnames: [],
        mapnames: [],
        handoutnames: [],
        //images: ['slide1.webm', 'slide2.webm', 'slide3.webm', 'slide4.webm', 'slide5.webm'],
        texts: [`Inserting %random% %char%s into %map%...`, `Covering up %char%'s war crimes...`, `Trying to find %char%...`, `Tasking %char% with scrubbing the wall in %map%...`, `Teaching %char% all about %handout%...`, `Shredding documents on %handout%`, `Deleting %random% clones of %char%. How did this happen?`],
        getToast: function () {
            let text = this.texts[Math.floor(Math.random()*this.texts.length)];
            text = text
                .replace(/%random%/g, Math.ceil(Math.random()*20000))
                .replace(/%char%/g, this.charnames[Math.floor(Math.random()*this.charnames.length)])
                .replace(/%map%/g, this.mapnames[Math.floor(Math.random()*this.mapnames.length)])
                .replace(/%handout%/g, this.handoutnames[Math.floor(Math.random()*this.handoutnames.length)]);
            return text;
        }
    }

    static async timeout (ms) {
        await new Promise(res=>setTimeout(res,ms))
    }

    static async nextToast () {
        let newToast = Intro.flags.getToast();
        document.getElementById('toast-text').innerText = newToast;
    }
    /*static async nextSlide(final) {
        if (!Intro.flags.tile) return;
        if (final) Intro.flags.currentIndex = Intro.flags.images.length-1;
        canvas.tiles.get(Intro.flags.tile).update({img: `${Intro.flags.imgPath}${Intro.flags.images[Intro.flags.currentIndex]}`});
        if (Intro.flags.text) canvas.drawings.get(Intro.flags.text).update({text: `${Intro.flags.texts[Intro.flags.currentIndex]}`});
        Intro.flags.currentIndex ++;
    }*/

    static async drawLoadingPage (campaignObject) {

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

        this.flags.charnames = (campaignObject.characters.map(c=>{if (c.name.length > 4) return c.name}));
        this.flags.mapnames = (campaignObject.pages.map(p=>{if (p.name.length > 4) return p.name}));
        this.flags.handoutnames = (campaignObject.handouts.map(h=>{if (h.name.length > 4) return h.name}));
        if (this.flags.charnames < 10) this.flags.charnames.push(`Misplaced Dragon`, `Invasive Goblin`, `404 Not Found - Invisible Stalker`, `Flying Monkey`);
        if (this.flags.mapnames < 3) this.flags.mapnames.push(`Start Page`, `Token Page`, `Second Map`, `Secret Cow Level`);
        if (this.flags.handoutnames < 3) this.flags.handoutnames.push(`Combat Basics`, `Syphilis Treatments`, `Hacking Foundry`);

        const renderBar = async () => {

            let progressDialog = new Dialog({
                title: "Importer Progress",
                content: `<div class="import progress" id="myProgress"><div class="import progress" id="myBar"></div></div><hr><div id="toast" class="import progress" style="text-align:center; font-size:16px">
					<span id="toast-text"></span></div>`,
                buttons: {},
                default: "",
                render: () => startBar(),
                close: () => closeSplash(),
            }, {jQuery: false, top: 0});
            await progressDialog.render(true);


			const startBar = () => {

                Intro.nextToast();

                if (progressDialog) progressDialog.setPosition({top: screenH*0.1, left: screenW/2 - screenW*0.2, width: screenW/4})
                let i = 0;
                let next = 0;
                let elem = document.getElementById("myBar");
                let id;
                const move = () => {
                    if (i == 0) {
                        i = 1;
                        id = setInterval(frame, 33);
                    }
                }
                const frame = () => {
                    next ++;
                    CONFIG.OOSHR20I.progress = parseInt(R20Importer.counter.get('total')/R20Importer.importConfig.totalEntityPoints*100, 10);
                    if (CONFIG.OOSHR20I.progress >= 100 || CONFIG.OOSHR20I.forceComplete) { // add exit conditional for errors
                        elem.style.width = '100%';
                        clearInterval(id);
                        progressDialog.close()
                        i = 0;
                    } else {
                        elem.style.width = `${CONFIG.OOSHR20I.progress}%`;
                        if (next >= 90) {
                            Intro.nextToast();
                            next = 0;
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
            await this.timeout(1500);
			renderBar();

        });
        return true;
    }
}