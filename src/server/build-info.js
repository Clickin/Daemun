export function getAssetVersion() {
  return (
    process.env.HOMEPAGE_ASSET_VERSION ||
    process.env.NEXT_PUBLIC_VERSION ||
    process.env.VERSION ||
    process.env.NEXT_PUBLIC_REVISION ||
    process.env.REVISION ||
    "dev"
  );
}
