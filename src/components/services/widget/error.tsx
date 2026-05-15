import { useTranslation } from "react-i18next";
import { IoAlertCircle } from "react-icons/io5";

interface WidgetErrorData {
  data?: number[];
  error?: WidgetErrorValue;
  type?: string;
}

interface WidgetErrorValue {
  data?: WidgetErrorData;
  message?: string;
  rawError?: unknown;
  url?: string;
}

function displayError(error: unknown) {
  const displayedError = Array.isArray(error) && error[1] ? error[1] : error;
  return JSON.stringify(displayedError, null, 4);
}

function displayData(data: WidgetErrorData) {
  return data.type === "Buffer" && Array.isArray(data.data)
    ? Buffer.from(data.data).toString()
    : JSON.stringify(data, null, 4);
}

export default function Error({ error }: { error: unknown }) {
  const { t } = useTranslation();
  let displayableError = error;

  if (typeof displayableError === "string") {
    displayableError = { message: displayableError };
  } else if (typeof displayableError === "number") {
    displayableError = { message: `Error ${displayableError}` };
  }

  if (displayableError && typeof displayableError === "object" && "data" in displayableError) {
    const data = displayableError.data as WidgetErrorData | undefined;
    if (data?.error) displayableError = data.error;
  }

  const normalizedError = (displayableError ?? {}) as WidgetErrorValue;

  return (
    <details className="px-1 pb-1">
      <summary className="block text-center mt-1 mb-0 mx-auto p-3 rounded-sm bg-rose-900/80 hover:bg-rose-900/95 text-theme-900 cursor-pointer">
        <div className="flex items-center justify-center text-xs font-bold">
          <IoAlertCircle className="mr-1 w-5 h-5" />
          {t("widget.api_error")} {normalizedError.message && t("widget.information")}
        </div>
      </summary>
      <div className="bg-white dark:bg-theme-200/50 mt-2 rounded-sm text-rose-900 text-xs font-mono whitespace-pre-wrap break-all">
        <ul className="p-4">
          {normalizedError.message && (
            <li>
              <span className="text-black">{t("widget.api_error")}:</span> {normalizedError.message}
            </li>
          )}
          {normalizedError.url && (
            <li className="mt-2">
              <span className="text-black">{t("widget.url")}:</span> {normalizedError.url}
            </li>
          )}
          {normalizedError.rawError && (
            <li className="mt-2">
              <span className="text-black">{t("widget.raw_error")}:</span>
              <div className="ml-2">{displayError(normalizedError.rawError)}</div>
            </li>
          )}
          {normalizedError.data && (
            <li className="mt-2">
              <span className="text-black">{t("widget.response_data")}:</span>
              <div className="ml-2">{displayData(normalizedError.data)}</div>
            </li>
          )}
        </ul>
      </div>
    </details>
  );
}
