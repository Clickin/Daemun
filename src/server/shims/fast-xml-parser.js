import { parse as parseXml } from "txml";

function appendChild(parent, tagName, value) {
  const current = parent[tagName];
  if (current === undefined) {
    parent[tagName] = value;
    return;
  }

  if (Array.isArray(current)) {
    current.push(value);
    return;
  }

  parent[tagName] = [current, value];
}

function isElement(node) {
  return node && typeof node === "object" && typeof node.tagName === "string" && !node.tagName.startsWith("?");
}

function toFastXmlValue(node, options) {
  const result = {};

  if (!options.ignoreAttributes) {
    for (const [name, value] of Object.entries(node.attributes ?? {})) {
      result[`${options.attributeNamePrefix}${name}`] = value ?? "";
    }
  }

  const textParts = [];
  for (const child of node.children ?? []) {
    if (typeof child === "string") {
      const text = options.trimValues ? child.trim() : child;
      if (text) textParts.push(text);
      continue;
    }

    if (isElement(child)) {
      appendChild(result, child.tagName, toFastXmlValue(child, options));
    }
  }

  if (textParts.length > 0) {
    const text = textParts.join("");
    if (Object.keys(result).length === 0) {
      return text;
    }
    result[options.textNodeName] = text;
  }

  return result;
}

export class XMLParser {
  constructor(options = {}) {
    this.options = {
      attributeNamePrefix: options.attributeNamePrefix ?? "@_",
      ignoreAttributes: options.ignoreAttributes ?? true,
      textNodeName: options.textNodeName ?? "#text",
      trimValues: options.trimValues ?? true,
    };
  }

  parse(xml) {
    const parsed = parseXml(xml, { decodeEntities: true });
    const result = {};

    for (const node of parsed) {
      if (isElement(node)) {
        appendChild(result, node.tagName, toFastXmlValue(node, this.options));
      }
    }

    return result;
  }
}

export const XMLValidator = {
  validate(xml) {
    try {
      parseXml(xml);
      return true;
    } catch {
      return false;
    }
  },
};
