"""
TTS wrapper: convert markdown script to speech audio using edge-tts.
Usage: python scripts/tts.py --input <script.md> --output <voiceover.mp3>
"""
import argparse
import asyncio
import edge_tts

VOICE = "en-US-GuyNeural"  # Mature male English voice, good for narration

async def generate(input_path: str, output_path: str, voice: str):
    with open(input_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Strip markdown formatting that TTS shouldn't read aloud
    # (simple cleanup — can be refined later)
    import re
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*{1,2}(.*?)\*{1,2}", r"\1", text)

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)
    print(f"Saved voiceover to {output_path}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to script markdown file")
    parser.add_argument("--output", required=True, help="Path to output mp3 file")
    parser.add_argument("--voice", default=VOICE, help="edge-tts voice name")
    args = parser.parse_args()
    asyncio.run(generate(args.input, args.output, args.voice))

if __name__ == "__main__":
    main()
