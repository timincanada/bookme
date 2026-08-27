import { parseAssistant } from "./assistant";

/** Swappable assistant engine. Default is the local parser. Do not put a model name in the UI. */
export const assistantProvider = {
  parse: parseAssistant,
};
