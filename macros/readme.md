# Helper macros for imported content


## Token-To-Tile (Grid Size)
Converts a token to a background tile, converting by (current tile size * pixels-per-square)

## Token-To-Tile (Image Size)
Converts a token to a background tile, converting by original image dimensions. This may
be a better look for some bitmap text/arrows on maps.

## Wall Converter
Bulk convert walls to different types by their imported Roll 20 stroke color.

## Dispel Tiny Doors
Remove door sections below a certain pixel size. Useful for "handles" on Roll20 doors which
are no longer necessary, but were converted to doors due to stroke colour.
