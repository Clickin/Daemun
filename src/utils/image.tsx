/* oxlint-disable jsx-a11y/alt-text */
import type { CSSProperties, ImgHTMLAttributes } from "react";

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  layout?: "fill" | string;
  objectFit?: CSSProperties["objectFit"];
}

export default function Image({ layout, objectFit, style, width, height, ...props }: ImageProps) {
  const fill = layout === "fill";
  const imageStyle: CSSProperties = {
    ...(fill
      ? {
          bottom: 0,
          height: "100%",
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
          width: "100%",
        }
      : {}),
    ...(objectFit ? { objectFit } : {}),
    ...style,
  };

  return <img width={fill ? undefined : width} height={fill ? undefined : height} style={imageStyle} {...props} />;
}
