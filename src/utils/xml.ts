import { parse } from "txml/txml";
import type { TNode } from "txml/txml";

interface CompactXmlNode extends Record<string, unknown> {
  _attributes?: Record<string, string | null>;
  _cdata?: string;
  _text?: string;
}

function isElementNode(node: unknown): node is TNode {
  return Boolean(node) && typeof node === "object" && typeof (node as { tagName?: unknown }).tagName === "string";
}

function localName(tagName = "") {
  return tagName.split(":").pop();
}

function appendChild(target: Record<string, unknown>, key: string, value: unknown) {
  if (target[key] === undefined) {
    target[key] = value;
  } else if (Array.isArray(target[key])) {
    target[key].push(value);
  } else {
    target[key] = [target[key], value];
  }
}

function textContent(node: TNode | string) {
  if (typeof node === "string") return node.trim();
  if (!isElementNode(node)) return "";

  return node.children.map(textContent).join("").trim();
}

function toCompactNode(node: TNode) {
  const compact: CompactXmlNode = {};

  if (node.attributes && Object.keys(node.attributes).length > 0) {
    compact._attributes = node.attributes;
  }

  for (const child of node.children) {
    if (typeof child === "string") {
      const text = child.trim();
      if (text) {
        compact._text = compact._text ? `${compact._text}${text}` : text;
        compact._cdata = compact._cdata ? `${compact._cdata}${text}` : text;
      }
      continue;
    }

    if (isElementNode(child)) {
      appendChild(compact, localName(child.tagName), toCompactNode(child));
    }
  }

  return compact;
}

export function parseXml(xml: Buffer | string): ReturnType<typeof JSON.parse> {
  const source = Buffer.isBuffer(xml) ? xml.toString() : xml;
  return parse(source).reduce((result, node) => {
    if (!isElementNode(node)) return result;

    appendChild(result, localName(node.tagName), toCompactNode(node));
    return result;
  }, {});
}

export function xmlNodeText(node: unknown) {
  if (node == null) return "";
  if (typeof node !== "object") return `${node}`;
  const compact = node as CompactXmlNode;
  return compact._cdata ?? compact._text ?? "";
}

export function parseSoapBody(xml: Buffer | string): Record<string, string> {
  const source = Buffer.isBuffer(xml) ? xml.toString() : xml;
  const nodes = parse(source).filter(isElementNode);
  const envelope = nodes.find((node) =>
    node.children.some((child) => isElementNode(child) && localName(child.tagName) === "Body"),
  );
  const body = envelope?.children.find((child): child is TNode => isElementNode(child) && localName(child.tagName) === "Body");
  const responseNode = body?.children.find(isElementNode);

  if (!responseNode) {
    return {};
  }

  return Object.fromEntries(
    responseNode.children
      .filter(isElementNode)
      .map((child) => [localName(child.tagName), textContent(child)]),
  );
}
