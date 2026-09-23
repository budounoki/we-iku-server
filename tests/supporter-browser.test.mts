// Playwright's default discovery requires the .test. infix; the suite itself
// stays in supporter-browser.mts so it can also be invoked directly by tools.
import "./safety/require-managed.mjs";
import "./supporter-browser.mts";