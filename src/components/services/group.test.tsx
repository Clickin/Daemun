// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import type { ElementType, ForwardedRef, HTMLAttributes, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@headlessui/react", async () => {
  const React = await import("react");
  const { Fragment } = React;

  function Transition({ as: As = Fragment, children }: { as?: ElementType; children?: ReactNode }) {
    if (As === Fragment) return <>{children}</>;
    return <As>{children}</As>;
  }

  function Disclosure({
    defaultOpen = true,
    children,
  }: {
    defaultOpen?: boolean;
    children?: ReactNode | ((state: { open: boolean }) => ReactNode);
  }) {
    const content = typeof children === "function" ? children({ open: defaultOpen }) : children;
    return <div>{content}</div>;
  }

  function DisclosureButton(props: HTMLAttributes<HTMLButtonElement>) {
    return <button type="button" {...props} />;
  }

  const DisclosurePanel = React.forwardRef(function DisclosurePanel(
    props: HTMLAttributes<HTMLDivElement> & { static?: boolean },
    ref: ForwardedRef<HTMLDivElement>,
  ) {
    const { static: _static, ...rest } = props;
    return <div ref={ref} data-testid="disclosure-panel" {...rest} />;
  });

  Disclosure.Button = DisclosureButton;
  Disclosure.Panel = DisclosurePanel;

  return { Disclosure, Transition };
});

vi.mock("components/resolvedicon", () => ({
  default: function ResolvedIconMock() {
    return <div data-testid="resolved-icon" />;
  },
}));

vi.mock("components/services/list", () => ({
  default: function ServicesListMock({ groupName, services }: { groupName?: string; services?: unknown[] }) {
    return (
      <div data-testid="services-list-mock">
        {groupName}:{services?.length ?? 0}
      </div>
    );
  },
}));

import ServicesGroup from "./group";

describe("components/services/group", () => {
  it("renders group and subgroup headers", () => {
    render(
      <ServicesGroup
        group={{
          name: "Main",
          services: [{ name: "svc" }],
          groups: [{ name: "Sub", services: [], groups: [] }],
        }}
        layout={{ icon: "mdi:test" }}
        groupsInitiallyCollapsed={false}
      />,
    );

    expect(screen.getByText("Main")).toBeInTheDocument();
    expect(screen.getByTestId("resolved-icon")).toBeInTheDocument();
    const lists = screen.getAllByTestId("services-list-mock");
    expect(lists[0]).toHaveTextContent("Main:1");
    expect(screen.getByText("Sub")).toBeInTheDocument();
  });

  it("sets the panel height to 0 when initially collapsed", async () => {
    render(
      <ServicesGroup
        group={{ name: "Main", services: [], groups: [] }}
        layout={{ initiallyCollapsed: true }}
        groupsInitiallyCollapsed={false}
      />,
    );

    const panel = screen.getAllByTestId("disclosure-panel")[0];
    await waitFor(() => {
      expect(panel.style.height).toBe("0px");
    });
  });
});
