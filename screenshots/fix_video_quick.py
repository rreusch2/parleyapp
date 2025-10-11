"""Quick video fixer for App Store"""
from moviepy import VideoFileClip

input_file = "Untitled design (8).mp4"
output_file = "Untitled design (8)_fixed.mp4"

print(f"Loading: {input_file}")
clip = VideoFileClip(input_file)
print(f"Original FPS: {clip.fps}")
print(f"Converting to 30 FPS...")

clip.write_videofile(
    output_file,
    fps=30,
    codec='libx264',
    audio_codec='aac',
    bitrate='5000k'
)

print(f"\nDone! Fixed video: {output_file}")

