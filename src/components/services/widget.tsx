import dynamic from "utils/dynamic";

const ResolvedServiceWidget = dynamic(() => import("./widget-resolved"));

export default function Widget(props) {
  return <ResolvedServiceWidget {...props} />;
}
