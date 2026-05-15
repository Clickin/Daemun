// @vitest-environment jsdom

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn<VitestMockProcedure>() }));
vi.mock("utils/query/api-query", () => ({ useApiQuery: useApiQueryMock }));

vi.mock("react-icons/md", () => ({
  MdLocationDisabled: (props) => <svg data-testid="location-disabled" {...props} />,
  MdLocationSearching: (props) => <svg data-testid="location-searching" {...props} />,
}));

import OpenWeatherMap from "./weather";

describe("components/widgets/openweathermap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders an error state when query errors or the API reports an auth error", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: new Error("nope") });
    renderWithProviders(<OpenWeatherMap options={{ latitude: 1, longitude: 2 }} />, { settings: { target: "_self" } });
    expect(screen.getByText("widget.api_error")).toBeInTheDocument();

    useApiQueryMock.mockReturnValue({ data: { cod: 401 }, error: undefined });
    renderWithProviders(<OpenWeatherMap options={{ latitude: 1, longitude: 2 }} />, { settings: { target: "_self" } });
    expect(screen.getAllByText("widget.api_error").length).toBeGreaterThan(0);
  });

  it("renders a location prompt when no coordinates are available", () => {
    renderWithProviders(<OpenWeatherMap options={{}} />, { settings: { target: "_self" } });

    expect(screen.getByText("weather.current")).toBeInTheDocument();
    expect(screen.getByText("weather.allow")).toBeInTheDocument();
  });

  it("auto-requests geolocation when permissions are granted", async () => {
    const getCurrentPosition = vi.fn<VitestMockProcedure>((success) =>
      success({ coords: { latitude: 30, longitude: 40 } }),
    );
    const query = vi.fn<VitestMockProcedure>().mockResolvedValue({ state: "granted" });
    vi.stubGlobal("navigator", {
      permissions: { query },
      geolocation: { getCurrentPosition },
    });

    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<OpenWeatherMap options={{}} />, { settings: { target: "_self" } });

    await waitFor(() => {
      expect(query).toHaveBeenCalled();
      expect(getCurrentPosition).toHaveBeenCalled();
    });
  });

  it("requests browser geolocation on click and then renders the updating state", async () => {
    const getCurrentPosition = vi.fn<VitestMockProcedure>((success) =>
      success({ coords: { latitude: 10, longitude: 20 } }),
    );
    vi.stubGlobal("navigator", {
      permissions: { query: vi.fn<VitestMockProcedure>().mockResolvedValue({ state: "prompt" }) },
      geolocation: { getCurrentPosition },
    });

    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<OpenWeatherMap options={{}} />, { settings: { target: "_self" } });

    screen.getByRole("button").click();

    await waitFor(() => {
      expect(getCurrentPosition).toHaveBeenCalled();
    });
    expect(screen.getByText("weather.updating")).toBeInTheDocument();
  });

  it("clears the requesting state when the browser denies geolocation", async () => {
    const getCurrentPosition = vi.fn<VitestMockProcedure>((_success, failure) => setTimeout(() => failure(), 10));
    vi.stubGlobal("navigator", {
      permissions: { query: vi.fn<VitestMockProcedure>().mockResolvedValue({ state: "prompt" }) },
      geolocation: { getCurrentPosition },
    });

    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<OpenWeatherMap options={{}} />, { settings: { target: "_self" } });

    expect(screen.getByTestId("location-disabled")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByTestId("location-searching")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("location-disabled")).toBeInTheDocument();
    });
  });

  it("renders temperature and description when coordinates are provided", async () => {
    useApiQueryMock.mockReturnValue({
      data: {
        main: { temp: 71 },
        weather: [{ id: 800, description: "clear sky" }],
        dt: 10,
        sys: { sunrise: 0, sunset: 100 },
      },
      error: undefined,
    });

    renderWithProviders(<OpenWeatherMap options={{ latitude: 1, longitude: 2, label: "Home", format: {} }} />, {
      settings: { target: "_self" },
    });

    await waitFor(() => {
      expect(screen.getByText("Home, 71")).toBeInTheDocument();
    });
    expect(screen.getByText("clear sky")).toBeInTheDocument();
  });

  it("uses night conditions and celsius units when configured", async () => {
    useApiQueryMock.mockReturnValue({
      data: {
        main: { temp: 10 },
        weather: [{ id: 800, description: "clear sky" }],
        dt: 200,
        sys: { sunrise: 0, sunset: 100 },
      },
      error: undefined,
    });

    renderWithProviders(<OpenWeatherMap options={{ latitude: 1, longitude: 2, units: "metric", format: {} }} />, {
      settings: { target: "_self" },
    });

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });
});
