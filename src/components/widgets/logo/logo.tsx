import DaemunIcon from "components/brand/daemun-icon";
import ResolvedIcon from "components/resolvedicon";

import Container from "../widget/container";
import Raw from "../widget/raw";

export default function Logo({ options }) {
  return (
    <Container
      options={options}
      additionalClassNames={`information-widget-logo ${options.icon ? "resolved" : "fallback"}`}
    >
      <Raw>
        {options.icon ? (
          <div className="resolved mr-3">
            <ResolvedIcon icon={options.icon} width={48} height={48} />
          </div>
        ) : (
          // fallback to Daemun logo
          <div className="fallback w-12 h-12">
            <DaemunIcon end="rgba(var(--color-logo-stop))" start="rgba(var(--color-logo-start))" title={null} />
          </div>
        )}
      </Raw>
    </Container>
  );
}
