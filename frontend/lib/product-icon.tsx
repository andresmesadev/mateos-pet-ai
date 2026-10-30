/* eslint-disable @next/next/no-img-element -- ImageResponse uses standard img elements. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

export async function productIcon(pixels: number) {
  const source = await readFile(path.join(process.cwd(), "public/brand/huella-nex-symbol.png"));
  const padding = Math.max(1, Math.round(pixels * .08));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
      <img src={`data:image/png;base64,${source.toString("base64")}`} alt="" width={pixels-padding*2} height={pixels-padding*2} />
    </div>,
    { width: pixels, height: pixels },
  );
}
