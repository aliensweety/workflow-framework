"""
Transcription wrapper: convert audio to timestamped SRT using faster-whisper.
Usage: python scripts/transcribe.py --input <voiceover.mp3> --output <subtitles.srt>
"""
import argparse
import datetime
from faster_whisper import WhisperModel


def format_timestamp(seconds: float) -> str:
    """Convert seconds to SRT timestamp format HH:MM:SS,mmm"""
    td = datetime.timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, secs = divmod(remainder, 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def transcribe(input_path: str, output_path: str, model_size: str):
    print(f"Loading Whisper model ({model_size})...")
    model = WhisperModel(model_size, device="cpu", compute_type="int8")

    print(f"Transcribing {input_path}...")
    segments, info = model.transcribe(input_path, beam_size=5)

    srt_lines = []
    for i, segment in enumerate(segments, start=1):
        start = format_timestamp(segment.start)
        end = format_timestamp(segment.end)
        text = segment.text.strip()
        srt_lines.append(f"{i}\n{start} --> {end}\n{text}\n")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(srt_lines))

    print(f"Saved subtitles to {output_path} ({len(srt_lines)} segments)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to audio file")
    parser.add_argument("--output", required=True, help="Path to output SRT file")
    parser.add_argument("--model", default="small", help="Whisper model size (tiny/base/small/medium/large)")
    args = parser.parse_args()
    transcribe(args.input, args.output, args.model)


if __name__ == "__main__":
    main()
