export function getAssetVersion() {
  return (
    process.env.HOMEPAGE_ASSET_VERSION ||
    process.env.VITE_VERSION ||
    process.env.VERSION ||
    process.env.VITE_REVISION ||
    process.env.REVISION ||
    "dev"
  );
}
