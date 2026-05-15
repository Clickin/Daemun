// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Stub Menu/Transition to always render children (keeps tests deterministic).
vi.mock("@headlessui/react", async () => {
  const React = await import("react");
  const { Fragment } = React;
  type ElementType = React.ElementType;
  type Node = React.ReactNode;
  type Props = React.HTMLAttributes<HTMLElement> & {
    as?: ElementType;
    children?: Node | ((state: { open: boolean }) => Node);
  };

  function Transition({ as: As = Fragment, children }: Props) {
    if (As === Fragment) return <>{children}</>;
    return <As>{children}</As>;
  }

  function Menu({ as: As = "div", children, ...props }: Props) {
    const content = typeof children === "function" ? children({ open: true }) : children;
    return <As {...props}>{content}</As>;
  }

  function MenuButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return <button type="button" {...props} />;
  }
  function MenuItems(props: React.HTMLAttributes<HTMLDivElement>) {
    return <div {...props} />;
  }
  function MenuItem({ children }: { children?: Node }) {
    return <>{children}</>;
  }

  Menu.Button = MenuButton;
  Menu.Items = MenuItems;
  Menu.Item = MenuItem;

  return { Menu, Transition };
});

import Dropdown from "./dropdown";

describe("components/services/dropdown", () => {
  it("renders the selected label and updates value when an option is clicked", () => {
    const setValue = vi.fn();
    const options = [
      { value: "a", label: "Alpha" },
      { value: "b", label: "Beta" },
    ];

    render(<Dropdown options={options} value="a" setValue={setValue} />);

    // "Alpha" appears both in the menu button and in the list of options.
    expect(screen.getAllByRole("button", { name: "Alpha" })[0]).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));
    expect(setValue).toHaveBeenCalledWith("b");
  });
});
