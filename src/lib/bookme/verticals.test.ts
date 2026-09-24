import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VerticalPicker } from "../../components/bookme/vertical-picker.tsx";
import { labelForSport } from "../coaches.ts";
import { asSport } from "./sport.ts";
import {
  CUSTOM_DISCIPLINE_MAX,
  VERTICAL_GROUPS,
  VERTICALS,
  coachBasicsFromSelection,
  groupForVertical,
  privateLessonName,
  resolveStoredVertical,
  selectionFromCoach,
  specialtyLabel,
  sportFromTitle,
  tilesForGroup,
  validateCustomDiscipline,
  walletRoleLine,
} from "./verticals.ts";

assert.equal(VERTICALS.includes("Tennis"), true);
assert.equal((VERTICALS as readonly string[]).includes("Other"), false, "Other is a tile, not a preset label");

for (const group of VERTICAL_GROUPS) {
  const tiles = tilesForGroup(group.id);
  const last = tiles[tiles.length - 1]!;
  assert.equal(last.label, "Other");
  assert.equal(last.blurb, "Name your own");
  assert.equal(last.custom, true);
  assert.equal(last.id, `${group.id}-other`);
  assert.equal(tiles.filter((tile) => tile.custom).length, 1);
  assert.ok(tiles.slice(0, -1).every((tile) => !tile.custom));
  assert.equal(groupForVertical(last.id)?.id, group.id);
}

const fencing = validateCustomDiscipline("  Fencing  ");
assert.equal(fencing.ok, true);
if (fencing.ok) assert.equal(fencing.value, "Fencing");
assert.deepEqual(validateCustomDiscipline("   "), { ok: false, error: "Name your discipline" });
assert.deepEqual(validateCustomDiscipline("\n\t"), { ok: false, error: "Name your discipline" });
assert.deepEqual(validateCustomDiscipline("Coach"), { ok: false, error: "Name your discipline" });
assert.equal(validateCustomDiscipline("a".repeat(CUSTOM_DISCIPLINE_MAX)).ok, true);
const tooLong = validateCustomDiscipline("a".repeat(CUSTOM_DISCIPLINE_MAX + 1));
assert.equal(tooLong.ok, false);
if (!tooLong.ok) assert.match(tooLong.error, new RegExp(String(CUSTOM_DISCIPLINE_MAX)));

assert.equal(sportFromTitle("Tennis Coach"), "tennis");
assert.equal(sportFromTitle("Personal training Coach"), "fitness");
assert.equal(sportFromTitle("Martial arts Coach"), "martial-arts");
assert.equal(sportFromTitle("Fencing Coach"), "sport-other");
assert.notEqual(sportFromTitle("Fencing Coach"), "tennis");
assert.notEqual(sportFromTitle("Curling Coach"), "tennis");
assert.equal(sportFromTitle(""), "sport-other");
assert.equal(sportFromTitle("   "), "sport-other");

assert.equal(asSport("tennis"), "tennis");
assert.equal(asSport("music-other"), "music-other");
assert.equal(asSport("fitness-other"), "fitness-other");
assert.notEqual(asSport("music-other"), "music");
assert.equal(asSport("Fencing"), "sport-other");
assert.notEqual(asSport("Fencing"), "tennis");

const fresh = selectionFromCoach(undefined, undefined);
assert.equal(fresh.id, "tennis");
assert.equal(fresh.custom, false);

const newCoach = selectionFromCoach("", "tennis");
assert.equal(newCoach.id, "tennis");
assert.equal(newCoach.label, "Tennis");
assert.equal(newCoach.custom, false);

for (const group of VERTICAL_GROUPS) {
  const id = `${group.id}-other`;
  const saved = coachBasicsFromSelection(id, "  Curling  ");
  assert.equal(saved.ok, true);
  if (!saved.ok) continue;
  assert.equal(saved.sport, id);
  assert.equal(saved.discipline, "Curling");
  assert.equal(saved.title, "Curling Coach");
  assert.notEqual(saved.sport, "tennis");
  const again = selectionFromCoach(saved.title, saved.sport);
  assert.equal(again.custom, true);
  assert.equal(again.id, id);
  assert.equal(again.label, "Curling");
  assert.equal(specialtyLabel(saved.sport, saved.title), "Curling");
  assert.notEqual(specialtyLabel(saved.sport, saved.title), "Other");
  assert.notEqual(specialtyLabel(saved.sport, saved.title), "Tennis");
  assert.equal(walletRoleLine(saved.title, saved.sport), "Curling Coach");
  assert.equal(walletRoleLine(saved.title, saved.sport).includes("sport-other"), false);
  assert.equal(labelForSport(saved.sport, saved.title), "Curling");
  assert.equal(privateLessonName(saved.title, saved.sport), "Private curling");
  assert.equal(privateLessonName(saved.title, saved.sport).includes("tennis"), false);

  const html = renderToStaticMarkup(
    createElement(VerticalPicker, { value: id, customLabel: "Curling", onChange() {} }),
  );
  assert.match(html, /value="Curling"/);
  assert.match(html, /What do you coach\?/);
  assert.match(html, />Other</);
  assert.match(html, /Name your own/);
  assert.match(html, new RegExp(group.items[0]!.label));
}

const typedCoach = coachBasicsFromSelection("sport-other", "Curling Coach");
assert.equal(typedCoach.ok, true);
if (typedCoach.ok) {
  assert.equal(typedCoach.title, "Curling Coach");
  assert.equal(typedCoach.discipline, "Curling");
}

const empty = coachBasicsFromSelection("arts-other", "   ");
assert.equal(empty.ok, false);
if (!empty.ok) assert.equal(empty.error, "Name your discipline");
const long = coachBasicsFromSelection("arts-other", "b".repeat(CUSTOM_DISCIPLINE_MAX + 1));
assert.equal(long.ok, false);

const tennis = coachBasicsFromSelection("tennis", "ignored");
assert.equal(tennis.ok, true);
if (tennis.ok) {
  assert.equal(tennis.sport, "tennis");
  assert.equal(tennis.title, "Tennis Coach");
}
const tennisAgain = selectionFromCoach("Tennis Coach", "tennis");
assert.equal(tennisAgain.custom, false);
assert.equal(tennisAgain.id, "tennis");
assert.equal(tennisAgain.label, "Tennis");
assert.equal(specialtyLabel("tennis", "Tennis Coach"), "Tennis");
assert.equal(specialtyLabel("tennis", "Coach"), "Tennis");
assert.equal(specialtyLabel("fitness", "Personal training Coach"), "Personal training");
assert.equal(labelForSport("tennis"), "Tennis");
assert.equal(walletRoleLine("Tennis Coach", "tennis"), "Tennis Coach");
assert.equal(walletRoleLine("Personal training Coach", "fitness"), "Personal training Coach");
assert.equal(walletRoleLine("Martial arts Coach", "martial-arts"), "Martial arts Coach");
assert.equal(privateLessonName("Tennis Coach", "tennis"), "Private tennis");
assert.equal(privateLessonName("Personal training Coach", "fitness"), "Private personal training");

const tableTennis = resolveStoredVertical("Table tennis Coach", "music-other");
assert.equal(tableTennis.ok, true);
if (tableTennis.ok) {
  assert.equal(tableTennis.sport, "music-other");
  assert.equal(tableTennis.title, "Table tennis Coach");
}
assert.equal(specialtyLabel("music-other", "Table tennis Coach"), "Table tennis");

const inferred = resolveStoredVertical("Curling Coach");
assert.equal(inferred.ok, true);
if (inferred.ok) {
  assert.equal(inferred.sport, "sport-other");
  assert.notEqual(inferred.sport, "tennis");
  assert.equal(inferred.title, "Curling Coach");
}

const preset = resolveStoredVertical("Tennis Coach");
assert.equal(preset.ok, true);
if (preset.ok) {
  assert.equal(preset.sport, "tennis");
  assert.equal(preset.title, "Tennis Coach");
}
const presetExplicit = resolveStoredVertical("Tennis Coach", "tennis");
assert.equal(presetExplicit.ok, true);
if (presetExplicit.ok) assert.equal(presetExplicit.sport, "tennis");

const blankCustom = resolveStoredVertical("   ", "fitness-other");
assert.equal(blankCustom.ok, false);
if (!blankCustom.ok) assert.equal(blankCustom.error, "Name your discipline");
const blankPreset = resolveStoredVertical("  ");
assert.equal(blankPreset.ok, false);
if (!blankPreset.ok) assert.equal(blankPreset.error, "Pick a vertical");

const sportHtml = renderToStaticMarkup(
  createElement(VerticalPicker, { value: "tennis", customLabel: "", onChange() {} }),
);
assert.ok(sportHtml.indexOf(">Tennis<") < sportHtml.indexOf(">Other<"));
assert.equal(sportHtml.includes("What do you coach?"), false);
assert.match(sportHtml, /Sport/);
assert.match(sportHtml, /Fitness/);
assert.match(sportHtml, /Music/);
assert.match(sportHtml, /Arts/);
assert.match(sportHtml, /Academic/);

console.log("verticals tests ok");
