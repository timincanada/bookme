import assert from "node:assert/strict";
import { hashPassword, readSession, readStudent, signSession, signStudent, verifyPassword } from "./auth";

const stored = hashPassword("coach123");
assert.equal(verifyPassword("coach123", stored), true);
assert.equal(verifyPassword("wrong", stored), false);
assert.equal(verifyPassword("coach123", null), false);

const token = signSession("abc123");
assert.equal(readSession(token), "abc123");
assert.equal(readSession("abc123.deadbeef"), null);
assert.equal(readSession(""), null);


const student = signStudent("Emma@Test.com");
assert.equal(readStudent(student), "emma@test.com");
assert.equal(readStudent("nope.deadbeef"), null);

console.log("auth tests ok");
