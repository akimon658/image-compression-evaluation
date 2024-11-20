import { basename, join } from "@std/path"

const inputFileName = Deno.args[0]
const destination = Deno.args[1] || "images"

const base = basename(inputFileName, ".yuv")

const { stdout, stderr } = new Deno.Command(
  "ffmpeg",
  {
    args: [
      "-pixel_format",
      "yuv420p",
      "-video_size",
      "1920x1080",
      "-framerate",
      "60",
      "-i",
      inputFileName,
      join(destination, `${base}_%03d.png`),
    ],
  },
).outputSync()

if (stderr) {
  console.error(new TextDecoder().decode(stderr))
}

console.log(new TextDecoder().decode(stdout))
