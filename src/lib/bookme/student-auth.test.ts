import assert from "node:assert/strict";
import { devShowsCode } from "./student-auth.ts";

assert.equal(devShowsCode({ VERCEL_ENV: "preview" }), true);
assert.equal(devShowsCode({ VERCEL_ENV: "Preview" }), true);
assert.equal(devShowsCode({ VERCEL_ENV: "preview", BOOKME_DEV_SHOW_CODE: "0" }), true);
assert.equal(devShowsCode({ BOOKME_DEV_SHOW_CODE: "1" }), true);
assert.equal(devShowsCode({}), false);
assert.equal(devShowsCode({ BOOKME_DEV_SHOW_CODE: "0" }), false);
assert.equal(devShowsCode({ VERCEL_ENV: "production" }), false);
assert.equal(devShowsCode({ VERCEL_ENV: "production", BOOKME_DEV_SHOW_CODE: "1" }), false);
assert.equal(devShowsCode({ VERCEL_ENV: "Production", BOOKME_DEV_SHOW_CODE: "1" }), false);

console.log("student-auth tests ok");
