/*
Code primarely based on shvl repository: https://github.com/robinvdvleuten/shvl

MIT License

Copyright (c) Robin van der Vleuten <robin@webstronauts.co>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

type NestedRecord = Record<string, unknown>;

function isRecord(value: unknown): value is NestedRecord {
  return Boolean(value) && typeof value === "object";
}

export function get<T = unknown>(object: unknown, path: string, def?: T): T | unknown {
  // Split the path into keys and reduce the object to the target value
  const value = path.split(/[.[\]]+/).reduce<unknown>(function (obj, p) {
    // Check each nested object to see if the key exists
    return isRecord(obj) && obj[p] !== undefined ? obj[p] : undefined;
  }, object);

  return value === undefined
    ? // If the final value is undefined, return the default value
      def
    : value; // Otherwise, return the value found
}

export function set<T extends NestedRecord>(obj: T, path: string, val: unknown): T {
  // Split the path into keys and filter out any empty strings
  const keys = path.split(/[.[\]]+/).filter(Boolean);

  // Pop the last key to set the value later
  const lastKey = keys.pop();

  // Prevent setting dangerous keys like __proto__
  if (!lastKey || /^(__proto__|constructor|prototype)$/.test(lastKey)) return obj;

  // Reduce the object to the nested object where we want to set the value
  const target = keys.reduce<NestedRecord>((acc, key, i) => {
    // Again, block dangerous keys
    if (/^(__proto__|constructor|prototype)$/.test(key)) return {};

    // Check if next key is an array index
    const isIndex = /^\d+$/.test(keys[i + 1]);

    // If current key doesn't exist, initialise it as an array or object
    acc[key] = Array.isArray(acc[key]) ? acc[key] : isIndex ? [] : acc[key] || {};

    // Return nested object for next iteration
    return isRecord(acc[key]) ? acc[key] : {};
  }, obj);

  target[lastKey] = val; // Finally set the value

  return obj;
}
