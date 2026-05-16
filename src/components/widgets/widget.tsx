import dynamic from "utils/dynamic";

const ResolvedInfoWidget = dynamic(() => import("./widget-resolved"));

export default function Widget(props) {
  return <ResolvedInfoWidget {...props} />;
}
