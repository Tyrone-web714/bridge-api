from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
INPUT = Path(r"C:\Users\19tlj\Downloads\ChatGPT Image May 10, 2026, 09_45_20 PM.png")
OUTPUT = ROOT / "assets" / "pilot-tractor-trailer-marker.png"


def main():
    source = Image.open(INPUT).convert("RGBA")

    # Coordinates are tailored to the uploaded top-down tractor-trailer photo.
    # They intentionally exclude the road, snow, trees, and lane markings.
    truck_bbox = (235, 315, 1470, 650)
    truck = source.crop(truck_bbox)

    mask = Image.new("L", truck.size, 0)
    draw = ImageDraw.Draw(mask)

    # Coordinates below are relative to truck_bbox.
    # Long trailer.
    draw.rounded_rectangle((250, 28, 1220, 315), radius=12, fill=255)

    # Trailer rear hardware and front frame lip.
    draw.rectangle((242, 35, 258, 306), fill=255)
    draw.rectangle((1212, 30, 1230, 313), fill=255)
    draw.rectangle((220, 44, 270, 296), fill=255)

    # Fifth-wheel / connector area.
    draw.rounded_rectangle((205, 55, 275, 292), radius=8, fill=255)

    # Tractor cab and hood.
    draw.rounded_rectangle((25, 28, 230, 315), radius=36, fill=255)
    draw.rounded_rectangle((0, 62, 62, 282), radius=20, fill=255)

    # Mirrors and chrome side details.
    draw.ellipse((18, 0, 70, 58), fill=255)
    draw.ellipse((18, 285, 70, 338), fill=255)
    draw.rounded_rectangle((55, 0, 96, 42), radius=12, fill=255)
    draw.rounded_rectangle((55, 294, 96, 335), radius=12, fill=255)

    # Wheel/side-shadow areas near tractor and trailer.
    draw.rounded_rectangle((60, 18, 232, 52), radius=10, fill=255)
    draw.rounded_rectangle((60, 292, 232, 326), radius=10, fill=255)
    draw.rounded_rectangle((275, 18, 1210, 48), radius=8, fill=255)
    draw.rounded_rectangle((275, 296, 1210, 326), radius=8, fill=255)

    # Soft edge for scaling on a map marker.
    mask = mask.filter(ImageFilter.GaussianBlur(0.9))

    cutout = Image.new("RGBA", truck.size, (0, 0, 0, 0))
    cutout.paste(truck, (0, 0), mask)
    bbox = cutout.getbbox()
    cutout = cutout.crop(bbox)

    # Rotate so the tractor faces upward on the map, like navigation vehicle avatars.
    cutout = cutout.rotate(-90, expand=True, resample=Image.Resampling.BICUBIC)
    cutout = ImageOps.expand(cutout, border=24, fill=(0, 0, 0, 0))
    cutout.save(OUTPUT)
    print(f"Generated {OUTPUT}")


if __name__ == "__main__":
    main()
