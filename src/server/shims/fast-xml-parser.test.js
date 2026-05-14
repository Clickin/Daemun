import { describe, expect, it } from "vitest";

import { XMLParser, XMLValidator } from "./fast-xml-parser";

describe("fast-xml-parser txml shim", () => {
  it("returns the shape gamedig expects for Farming Simulator XML", () => {
    const xml = `<Server name="Farm" mapName="River" version="1">
      <Slots numUsed="1" capacity="2">
        <Player isUsed="true" isAdmin="false" uptime="3" x="1.1" y="2.2" z="3.3">Alice</Player>
        <Player isUsed="false">Bob</Player>
      </Slots>
      <Mods>
        <Mod name="mod-id" author="Author" version="1.0" hash="abc">Mod Name</Mod>
      </Mods>
    </Server>`;

    const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml);

    expect(XMLValidator.validate(xml)).toBe(true);
    expect(parsed.Server["@_name"]).toBe("Farm");
    expect(parsed.Server.Slots["@_numUsed"]).toBe("1");
    expect(parsed.Server.Slots.Player).toEqual([
      expect.objectContaining({ "#text": "Alice", "@_isUsed": "true" }),
      expect.objectContaining({ "#text": "Bob", "@_isUsed": "false" }),
    ]);
    expect(parsed.Server.Mods.Mod).toEqual(
      expect.objectContaining({ "#text": "Mod Name", "@_name": "mod-id", "@_author": "Author" }),
    );
  });
});
