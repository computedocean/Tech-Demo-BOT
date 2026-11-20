#!/usr/bin/env bash
# Synthetic 9:16 placeholders. ffmpeg lavfi color sources + overlay only.
# No recorded footage, no game assets, no third-party video.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/clips

encode() {
  local out="$1"
  shift
  ffmpeg -y -hide_banner -loglevel error \
    "$@" \
    -c:v libx264 -pix_fmt yuv420p -crf 30 -preset veryfast -an -movflags +faststart \
    "$out"
}

encode public/clips/harbor-cruise.mp4 \
  -f lavfi -i color=c=0x0e1620:s=270x480:r=12:d=6 \
  -f lavfi -i color=c=0x163646:s=270x120:r=12:d=6 \
  -f lavfi -i color=c=0x2a241c:s=270x14:r=12:d=6 \
  -f lavfi -i color=c=0x243246:s=28x88:r=12:d=6 \
  -f lavfi -i color=c=0x314258:s=22x130:r=12:d=6 \
  -f lavfi -i color=c=0x1c2c3e:s=40x100:r=12:d=6 \
  -f lavfi -i color=c=0x3a4e66:s=18x160:r=12:d=6 \
  -f lavfi -i color=c=0x243446:s=34x110:r=12:d=6 \
  -f lavfi -i color=c=0x2c3e54:s=26x140:r=12:d=6 \
  -f lavfi -i color=c=0xd8c7a4:s=64x18:r=12:d=6 \
  -f lavfi -i color=c=0x8aa0b4:s=18x10:r=12:d=6 \
  -filter_complex "\
[0][1]overlay=x=0:y=360[a];\
[a][2]overlay=x=0:y=328[b];\
[b][3]overlay=x=18:y=248[c];\
[c][4]overlay=x=56:y=206[d];\
[d][5]overlay=x=90:y=236[e];\
[e][6]overlay=x=142:y=176[f];\
[f][7]overlay=x=170:y=226[g];\
[g][8]overlay=x=214:y=196[h];\
[h][9]overlay=x='-50+mod(t*48\,340)':y=334[i];\
[i][10]overlay=x='-36+mod(t*48\,340)':y=328" 

encode public/clips/rooftop-hop.mp4 \
  -f lavfi -i color=c=0x16141c:s=270x480:r=12:d=6 \
  -f lavfi -i color=c=0x2c2834:s=90x80:r=12:d=6 \
  -f lavfi -i color=c=0x353042:s=78x128:r=12:d=6 \
  -f lavfi -i color=c=0x2a2632:s=82x96:r=12:d=6 \
  -f lavfi -i color=c=0xe0b08a:s=30x22:r=12:d=6 \
  -filter_complex "\
[0][1]overlay=x=0:y=400[a];\
[a][2]overlay=x=100:y=352[b];\
[b][3]overlay=x=188:y=384[c];\
[c][4]overlay=x='16+t*34':y='300-78*abs(sin(t*3.1))'"

encode public/clips/lane-chase.mp4 \
  -f lavfi -i color=c=0x1c2218:s=270x480:r=12:d=6 \
  -f lavfi -i color=c=0x2a2e28:s=114x480:r=12:d=6 \
  -f lavfi -i color=c=0x3d4436:s=6x480:r=12:d=6 \
  -f lavfi -i color=c=0xcbb86a:s=22x16:r=12:d=6 \
  -f lavfi -i color=c=0xcbb86a:s=22x16:r=12:d=6 \
  -f lavfi -i color=c=0xcbb86a:s=22x16:r=12:d=6 \
  -f lavfi -i color=c=0xf2f2f2:s=54x22:r=12:d=6 \
  -f lavfi -i color=c=0xc45c4a:s=54x22:r=12:d=6 \
  -filter_complex "\
[0][1]overlay=x=78:y=0[a];\
[a][2]overlay=x=132:y=0[b];\
[b][3]overlay=x=124:y='mod(t*140\,200)-20'[c];\
[c][4]overlay=x=124:y='mod(t*140+90\,200)-20'[d];\
[d][5]overlay=x=124:y='mod(t*140+150\,200)-20'[e];\
[e][6]overlay=x=108:y=78[f];\
[f][7]overlay=x=108:y='360-t*42'"

encode public/clips/grid-pass.mp4 \
  -f lavfi -i color=c=0x101014:s=270x480:r=12:d=6 \
  -f lavfi -i color=c=0x2a3140:s=26x230:r=12:d=6 \
  -f lavfi -i color=c=0x3a4558:s=18x190:r=12:d=6 \
  -f lavfi -i color=c=0x243044:s=22x214:r=12:d=6 \
  -f lavfi -i color=c=0x181a16:s=270x150:r=12:d=6 \
  -f lavfi -i color=c=0xb7c4b0:s=72x26:r=12:d=6 \
  -filter_complex "\
[0][1]overlay=x='mod(10-t*36\,180)-30':y=70[a];\
[a][2]overlay=x='mod(70-t*36\,180)-30':y=110[b];\
[b][3]overlay=x='mod(120-t*36\,180)-30':y=86[c];\
[c][4]overlay=x=0:y=330[d];\
[d][5]overlay=x='mod(t*55\,340)-60':y=392"

echo "rendered:"
ls -la public/clips/*.mp4
