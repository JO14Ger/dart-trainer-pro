#!/bin/bash
# Generate icons from SVG. Run: bash scripts/generate-icons.sh
# Easiest: npx tauri icon src-tauri/icons/icon.svg
ICON_SVG="src-tauri/icons/icon.svg"
DIR="src-tauri/icons"
if command -v rsvg-convert &> /dev/null; then
  rsvg-convert -w 32 -h 32 "$ICON_SVG" > "$DIR/32x32.png"
  rsvg-convert -w 128 -h 128 "$ICON_SVG" > "$DIR/128x128.png"
  rsvg-convert -w 256 -h 256 "$ICON_SVG" > "$DIR/128x128@2x.png"
  echo "PNG icons generated"
elif command -v convert &> /dev/null; then
  convert -background none -resize 32x32 "$ICON_SVG" "$DIR/32x32.png"
  convert -background none -resize 128x128 "$ICON_SVG" "$DIR/128x128.png"
  convert -background none -resize 256x256 "$ICON_SVG" "$DIR/128x128@2x.png"
  echo "PNG icons generated (ImageMagick)"
else
  echo "Easiest: npx tauri icon src-tauri/icons/icon.svg"
fi
