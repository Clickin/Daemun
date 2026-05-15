import { useTranslation } from "react-i18next";
import { BiError } from "react-icons/bi";

import Container from "./container";
import type { WidgetContainerOptions } from "./container";
import PrimaryText from "./primary_text";
import WidgetIcon from "./widget_icon";

interface ErrorProps {
  options?: WidgetContainerOptions;
}

export default function Error({ options }: ErrorProps) {
  const { t } = useTranslation();

  return (
    <Container options={options} additionalClassNames="information-widget-error">
      <PrimaryText>{t("widget.api_error")}</PrimaryText>
      <WidgetIcon icon={BiError} size="l" />
    </Container>
  );
}
