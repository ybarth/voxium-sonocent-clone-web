#!/usr/bin/env bash
# Generate small test audio files for format testing.
# Requires: ffmpeg (brew install ffmpeg)

set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)/audio test assets/format-tests"

# Ensure ffmpeg is available
if ! command -v ffmpeg &> /dev/null; then
  echo "ERROR: ffmpeg not found. Install with: brew install ffmpeg"
  exit 1
fi

# Create directory structure
FORMATS=(mp3 wav m4a ogg webm flac)
for fmt in "${FORMATS[@]}"; do
  mkdir -p "$BASE_DIR/${fmt}-files"
done
mkdir -p "$BASE_DIR/mixed"

# Determine sample rate — webm/opus requires 48000, others use 44100
get_sample_rate() {
  local ext="${1##*.}"
  if [ "$ext" = "webm" ]; then
    echo 48000
  else
    echo 44100
  fi
}

generate_tone() {
  local freq="$1"
  local duration="$2"
  local output="$3"
  local sr
  sr=$(get_sample_rate "$output")
  ffmpeg -y -f lavfi -i "sine=frequency=${freq}:duration=${duration}" \
    -ar "$sr" -ac 1 "$output" -loglevel error
}

# speech-sim: tone with silence gaps (2s tone, 0.5s silence, 1.5s tone)
generate_speech_sim() {
  local output="$1"
  local sr
  sr=$(get_sample_rate "$output")
  ffmpeg -y -f lavfi -i "sine=frequency=300:duration=2:sample_rate=${sr}" \
    -f lavfi -i "anullsrc=r=${sr}:cl=mono" \
    -f lavfi -i "sine=frequency=400:duration=1.5:sample_rate=${sr}" \
    -filter_complex "[0]apad=pad_dur=0[a];[1]atrim=0:0.5[b];[2]apad=pad_dur=0[c];[a][b][c]concat=n=3:v=0:a=1[out]" \
    -map "[out]" -ar "$sr" -ac 1 "$output" -loglevel error
}

echo "Generating test audio files..."

for fmt in "${FORMATS[@]}"; do
  dir="$BASE_DIR/${fmt}-files"
  echo "  ${fmt}..."
  generate_tone 440 3 "$dir/tone-440hz.${fmt}"
  generate_tone 880 2 "$dir/tone-880hz.${fmt}"
  generate_speech_sim "$dir/speech-sim.${fmt}"
done

# Mixed folder: one of each format
echo "  mixed..."
generate_tone 440 3 "$BASE_DIR/mixed/tone-440hz.mp3"
generate_tone 880 2 "$BASE_DIR/mixed/tone-880hz.wav"
generate_speech_sim "$BASE_DIR/mixed/speech-sim.ogg"
generate_tone 440 3 "$BASE_DIR/mixed/tone-440hz.flac"
generate_tone 880 2 "$BASE_DIR/mixed/tone-880hz.m4a"
generate_speech_sim "$BASE_DIR/mixed/speech-sim.webm"

echo "Done! Files generated in: $BASE_DIR"
