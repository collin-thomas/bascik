import { createHash, randomBytes } from "node:crypto";
import { BascikConfig } from "./config.js";

export const getAttributeNameHash = (attributeName) => {
  // Must start with a letter, so `b` for Bascik
  return `b${createHash("shake256", { outputLength: 6 })
    .update(attributeName)
    .digest("hex")}`;
};

export const obfuscateAttributeName = (attributeName) => {
  return BascikConfig.obfuscateAttributeNames
    ? getAttributeNameHash(attributeName)
    : attributeName;
};

export const getUniqueId = (length) => {
  if (length % 2 !== 0) {
    length++;
  }
  return randomBytes(length / 2).toString("hex");
}
