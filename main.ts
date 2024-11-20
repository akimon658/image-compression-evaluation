import SharpIQA from "sharp-iqa"
import sharp, { FormatEnum } from "sharp"
import type { Buffer } from "node:buffer"
import { basename, join } from "@std/path"
import { ssim } from "ssim.js"
import { stringify } from "@std/csv"

interface ImageData {
  data: Uint8ClampedArray
  width: number
  height: number
}

async function toImageData(img: sharp.Sharp): Promise<ImageData> {
  const { data, info } = await img.clone().raw().toBuffer({
    resolveWithObject: true,
  })

  return {
    data: new Uint8ClampedArray(data),
    width: info.width,
    height: info.height,
  }
}

const formats = [
  "avif", // Does not use chroma subsampling by default
  "avif420",
  "jpeg", // Uses chroma subsampling by default
  "jpeg444",
  "webp", // Supports only 4:2:0 chroma subsampling
]

const dirName = Deno.args[0]
const prob = Number(Deno.args[1]) || 1

for (const dirEntry of Deno.readDirSync(dirName)) {
  if (Math.random() > prob) {
    continue
  }
  if (!dirEntry.name.endsWith(".png")) {
    continue
  }

  const inputBuffer = Deno.readFileSync(join(dirName, dirEntry.name))
  const inputImage = sharp(inputBuffer)
  const inputImageData = await toImageData(inputImage)

  console.table({
    Image: dirEntry.name,
    Width: inputImageData.width,
    Height: inputImageData.height,
  })

  for (const format of formats) {
    let convertedImage: sharp.Sharp,
      encodeTime: number | undefined,
      convertedBuffer: Buffer

    switch (format) {
      case "avif420": {
        const start = performance.now()
        convertedImage = inputImage.clone().avif({
          chromaSubsampling: "4:2:0",
        })
        convertedBuffer = await convertedImage.clone().toBuffer()
        encodeTime = performance.now() - start
        break
      }

      case "jpeg444": {
        const start = performance.now()
        convertedImage = inputImage.clone().jpeg({
          chromaSubsampling: "4:4:4",
        })
        convertedBuffer = await convertedImage.clone().toBuffer()
        encodeTime = performance.now() - start
        break
      }

      default: {
        const start = performance.now()
        convertedImage = inputImage.clone().toFormat(
          format as keyof FormatEnum,
        )
        convertedBuffer = await convertedImage.clone().toBuffer()
        encodeTime = performance.now() - start
      }
    }

    convertedImage = sharp(convertedBuffer)

    const { mssim } = ssim(inputImageData, await toImageData(convertedImage))
    const psnr = await SharpIQA.psnr(inputImage.clone(), convertedImage)

    const compressionRatio = inputBuffer.byteLength /
      convertedBuffer.byteLength

    const result = {
      name: dirEntry.name,
      cr: compressionRatio,
      psnr: psnr,
      ssim: mssim,
      encodeTime: encodeTime,
    }

    console.table(result)

    Deno.writeTextFileSync(
      join(dirName, `results_${format}.csv`),
      stringify(
        [result],
        {
          columns: [
            "name",
            "cr",
            "psnr",
            "ssim",
            "encodeTime",
          ],
          headers: false,
        },
      ),
      {
        append: true,
      },
    )
    let ext: string
    switch (format) {
      case "avif420":
        ext = "avif"
        break
      case "jpeg444":
        ext = "jpeg"
        break
      default:
        ext = format
    }
    Deno.writeFileSync(
      join(dirName, `${basename(dirEntry.name, ".png")}.${ext}`),
      convertedBuffer,
    )
  }
}
