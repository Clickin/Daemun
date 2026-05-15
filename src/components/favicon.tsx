/* oxlint-disable jsx-a11y/alt-text */
import { useContext, useEffect, useRef } from "react";
import type { RefObject } from "react";
import DaemunIcon from "components/brand/daemun-icon";
import { ColorContext } from "utils/contexts/color";

import themes from "utils/styles/themes";

interface SvgProps {
  svgRef?: RefObject<SVGSVGElement | null> | null;
}

export function Svg({ svgRef = null }: SvgProps) {
  const { color } = useContext(ColorContext);

  const { iconStart, iconEnd } = themes[color];

  return (
    <DaemunIcon end={iconEnd} start={iconStart} svgRef={svgRef} title={null} />
  );
}

export default function Favicon() {
  const svgRef = useRef<SVGSVGElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    const img = imgRef.current;
    const canvas = canvasRef.current;

    if (!svg || !img || !canvas) {
      return;
    }

    const xml = new XMLSerializer().serializeToString(svg);

    const svg64 = Buffer.from(xml).toString("base64");
    const b64Start = "data:image/svg+xml;base64,";

    // prepend a "header"
    const image64 = b64Start + svg64;

    // set it as the source of the img element
    img.onload = () => {
      // draw the image onto the canvas
      canvas.getContext("2d")?.drawImage(img, 0, 0);
      // canvas.width = 256;
      // canvas.height = 256;

      const link = window.document.createElement("link");
      link.type = "image/x-icon";
      link.rel = "shortcut icon";
      link.href = canvas.toDataURL("image/x-icon");
      document.getElementsByTagName("head")[0]?.appendChild(link);
    };

    img.src = image64;
  }, []);

  return (
    <div className="hidden">
      <Svg svgRef={svgRef} />
      <img width={64} height={64} ref={imgRef} />
      <canvas width={64} height={64} ref={canvasRef} />
    </div>
  );
}
