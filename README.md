# r20Importer

# Current v0.82 D/L: https://downgit.github.io/#/home?url=https://github.com/ooshhub/r20Importer/tree/main/r20import

Foundry VTT Importer for Roll20 campaigns

Use https://github.com/ooshhub/r20Exporter to export


## Notes

- I highly recommend that, before importing, you set up a Foundry Campaign with Compendiums set up for your content - Items, Spells, NPCs. Plutonium can assist with this for 5e.
- Importer has a very basic character converter for non-5e Campaigns. Dumps the entire Roll20 attribute array into the <b>flags</b> section of the Actor. You will need some kind of converter for whatever system you're using in this case.
- Will attempt to find 5e NPCs in specified Compendium packs. Currently not in the menu - edit lines 15-19 in <b>importer.js</b> with the exact names of Compendium packs in your Foundry Campaign, and the importer will attempt to find spells, items and NPCs from the supplied data.
- Class Features will not import (though class levels will). This needs to be done manually, or with Plutonium, for now.
- Each Actor will have their Journal section filled out with anything the Importer is unsure about - inconsitencies in Ability scores, missing spells etc. If you don't have a spells Compendium set up that could be all of the spells.
- Attempts to auto-assign doors and secret doors from the 2nd & 3rd most common wall stroke colours. If this is inaccurate, use <b>Wall Converter</b> in /Macros/ to bulk change them. This only works for R20 imported walls, as there is no stroke colour in Foundry.
- If your R20 doors have "handles" (extra segments) on them to make selection easier, these may have been converted to tiny doors. As they are no longer necessary, you can try the <b>Dispel Tiny Doors</b> script from /Macros/ to remove any doors below a threshold number of pixels. This will get rid of extra "door" icons on the token layer.
- There is no DM layer in Foundry (you can make anything on the Tokens/Tiles layers invisible to players instead). Some content that ends up on the Tokens layer probably belongs on the Tiles layer. There are a couple of Token-To-Tile converters in /Macros/ to help with this, they move the current selection to the Tiles layer.
