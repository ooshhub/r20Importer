const wallArray = [
    {
     "id": "-LzBm-oLKgxzSq5k7SpR",
     "attributes": {
      "path": "[[\"M\",0,1995],[\"C\",0,893.191824,893.191824,0,1995,0],[\"C\",3096.808176,0,3990,893.191824,3990,1995],[\"C\",3990,3096.808176,3096.808176,3990,1995,3990],[\"C\",893.191824,3990,0,3096.808176,0,1995]]",
      "z_index": 0,
      "fill": "transparent",
      "stroke": "#000000",
      "page_id": "-LzA_iyloin9G9dyLM4y",
      "type": "path",
      "rotation": 0,
      "layer": "map",
      "stroke_width": 14,
      "controlledby": "-Lz7ZupXmab9veL6W_TG",
      "groupwith": "",
      "width": 3990,
      "height": 3990,
      "top": 2685.5,
      "left": 2612,
      "scaleX": 1.0024975024975022,
      "scaleY": 1.0067432567432568,
      "id": "-LzBm-oLKgxzSq5k7SpR"
     }
    },
    {
     "id": "-LzBn3CiQ8GqbqSoJtwI",
     "attributes": {
      "path": "[[\"M\",618,1],[\"L\",0,0]]",
      "z_index": 0,
      "fill": "transparent",
      "stroke": "#000000",
      "page_id": "-LzA_iyloin9G9dyLM4y",
      "type": "path",
      "rotation": 0,
      "layer": "map",
      "stroke_width": 14,
      "controlledby": "-Lz7ZupXmab9veL6W_TG",
      "groupwith": "",
      "width": 618,
      "height": 1,
      "top": 2520.5,
      "left": 309,
      "scaleX": 1,
      "scaleY": 1,
      "id": "-LzBn3CiQ8GqbqSoJtwI"
     }
    },
    {
     "id": "-LzBn546IgA2a8D71Crw",
     "attributes": {
      "path": "[[\"M\",615,0],[\"L\",0,0]]",
      "z_index": 0,
      "fill": "transparent",
      "stroke": "#000000",
      "page_id": "-LzA_iyloin9G9dyLM4y",
      "type": "path",
      "rotation": 0,
      "layer": "map",
      "stroke_width": 14,
      "controlledby": "-Lz7ZupXmab9veL6W_TG",
      "groupwith": "",
      "width": 615,
      "height": 0,
      "top": 2800,
      "left": 307.5,
      "scaleX": 1,
      "scaleY": 1,
      "id": "-LzBn546IgA2a8D71Crw"
     }
    },
    {
     "id": "-LzBn9ZnSMvhC2Dv7zz8",
     "attributes": {
      "path": "[[\"M\",0,0],[\"L\",640,2]]",
      "z_index": 0,
      "fill": "transparent",
      "stroke": "#000000",
      "page_id": "-LzA_iyloin9G9dyLM4y",
      "type": "path",
      "rotation": 0,
      "layer": "map",
      "stroke_width": 14,
      "controlledby": "-Lz7ZupXmab9veL6W_TG",
      "groupwith": "",
      "width": 640,
      "height": 2,
      "top": 2519,
      "left": 4930,
      "scaleX": 1,
      "scaleY": 1,
      "id": "-LzBn9ZnSMvhC2Dv7zz8"
     }
    },
    {
     "id": "-LzBnAp2YrJyVsnB2MNu",
     "attributes": {
      "path": "[[\"M\",0,0],[\"L\",635,0]]",
      "z_index": 0,
      "fill": "transparent",
      "stroke": "#000000",
      "page_id": "-LzA_iyloin9G9dyLM4y",
      "type": "path",
      "rotation": 0,
      "layer": "map",
      "stroke_width": 14,
      "controlledby": "-Lz7ZupXmab9veL6W_TG",
      "groupwith": "",
      "width": 635,
      "height": 0,
      "top": 2800,
      "left": 4932.5,
      "scaleX": 1,
      "scaleY": 1,
      "id": "-LzBnAp2YrJyVsnB2MNu"
     }
    },
    {
        "id": "-LzRGcFT9epBR0lARiN7",
        "attributes": {
         "path": "[[\"M\",0,0],[\"L\",141.0788381742739,0],[\"L\",141.0788381742739,136.0995850622407],[\"L\",0,136.0995850622407],[\"L\",0,0]]",
         "z_index": 0,
         "fill": "transparent",
         "stroke": "#000000",
         "page_id": "-LzA_iyloin9G9dyLM4y",
         "type": "path",
         "rotation": 0,
         "layer": "gmlayer",
         "stroke_width": 5,
         "controlledby": "-Lz7ZupXmab9veL6W_TG",
         "groupwith": "",
         "width": 141,
         "height": 136,
         "top": 1119,
         "left": 1821,
         "scaleX": 1,
         "scaleY": 1,
         "id": "-LzRGcFT9epBR0lARiN7"
        }
       }]
const outputArray = [];

wallArray.forEach(wall => {
    if (!wall.attributes.path.match(/[QC]/g)) {
        let p = JSON.parse(wall.attributes.path) || null;
        let t = wall.attributes.top;
        let l = wall.attributes.left;
        let ux = l + p[0][1];
        let uy = t + p[0][2];
        for (let i=1; i<p.length; i++) {
            let c = [ux, uy, l + p[i][1], t + p[i][2]];
            outputArray.push(c);
            ux = c[2];
            uy = c[3];
        }
    } 
});
console.log(outputArray);
console.log('break')
