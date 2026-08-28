import assert from "node:assert/strict";
import { hashPassword, readSession, readStudent, SESSION_COOKIE, signSession, signStudent, STAFF_COOKIE, STUDENT_COOKIE, verifyPassword } from "./auth";

assert.equal(SESSION_COOKIE, "bookme_coach");
assert.equal(STAFF_COOKIE, "bookme_staff");
assert.equal(STUDENT_COOKIE, "bookme_student");
assert.notEqual(STAFF_COOKIE, SESSION_COOKIE);

const stored = hashPassword("coach123");
assert.equal(verifyPassword("coach123", stored), true);
assert.equal(verifyPassword("wrong", stored), false);
assert.equal(verifyPassword("coach123", null), false);
assert.equal(verifyPassword("secret", ""), false);

const token = signSession("abc123");
assert.equal(readSession(token), "abc123");
assert.equal(readSession("abc123.deadbeef"), null);
assert.equal(readSession(""), null);

const staffToken = signSession("staff-id-1");
assert.equal(readSession(staffToken), "staff-id-1");

const student = signStudent("Emma@Test.com");
assert.equal(readStudent(student), "emma@test.com");
assert.equal(readStudent("nope.deadbeef"), null);

console.log("auth tests ok");
