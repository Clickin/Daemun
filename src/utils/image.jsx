/* oxlint-disable jsx-a11y/alt-text */
export default function Image({ layout, objectFit, style, width, height, ...props }) {
  const fill = layout === "fill";
  const imageStyle = {
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
