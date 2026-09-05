import { test } from "node:test";
import assert from "node:assert/strict";
import { hardenSpec } from "../src/hardening";

test("hardening never weakens exact URLs or silently selects an ambiguous match", () => {
  const code = "await expect(page).toHaveURL('https://example.com/account/success'); await page.getByRole('button', {name:'Save'}).click();";
  assert.equal(hardenSpec(code), code);
});

test("hardenSpec repairs a hallucinated label to the captured placeholder", () => {
  const context = [
    "Inputs: placeholder=\"you@company.com\" (email) | placeholder=\"Password\" (password)",
    "Labels: Remember me",
  ].join("\n");
  const code = "await expect(page.getByLabel('Password')).toBeVisible();";
  assert.equal(
    hardenSpec(code, context),
    'await expect(page.getByPlaceholder("Password")).toBeVisible();',
  );
});

test("hardenSpec preserves real labels and aria-labels", () => {
  const context = [
    "Inputs: aria-label=\"Search\" (text)",
    "Labels: Email address",
  ].join("\n");
  const code = "page.getByLabel('Search'); page.getByLabel('Email address');";
  assert.equal(hardenSpec(code, context), code);
});

test("hardenSpec supports legacy input context without inventing a label", () => {
  const context = "Inputs: you@company.com (email) | Password (password)";
  const code = "await page.getByLabel('Password').fill('x');";
  assert.equal(hardenSpec(code, context), 'await page.getByPlaceholder("Password").fill(\'x\');');
});

test("hardenSpec repairs a hallucinated button role to a captured link role", () => {
  const context = [
    "Buttons: Submit",
    "Links (name -> href; an href starting with \"#\" is an IN-PAGE anchor, NOT a route — do not assert a URL change for it): Log out -> /practice-test-login/",
  ].join("\n");
  const code = "await expect(page.getByRole('button', { name: 'Log out' }).first()).toBeVisible();";
  assert.equal(
    hardenSpec(code, context),
    'await expect(page.getByRole("link", { name: \'Log out\' }).first()).toBeVisible();',
  );
});

test("hardenSpec repairs a hallucinated link role to a captured button role", () => {
  const context = [
    "Buttons: Submit",
    "Links (name -> href): Documentation -> /docs",
  ].join("\n");
  const code = "await page.getByRole('link', { name: 'Submit' }).click();";
  assert.equal(
    hardenSpec(code, context),
    'await page.getByRole("button", { name: \'Submit\' }).click();',
  );
});

test("hardenSpec preserves an ambiguous role name present as both a button and link", () => {
  const context = [
    "Buttons: Continue",
    "Links (name -> href): Continue -> /next",
  ].join("\n");
  const code = "await page.getByRole('button', { name: 'Continue' }).click();";
  assert.equal(hardenSpec(code, context), code);
});

test("hardenSpec uses the heading role when live text is split across child spans", () => {
  const context = "Headings: Ship with proof. Not hope.\nButtons: Generate test →";
  const code = "await expect(page.getByText('Ship with proof. Not hope.')).toBeVisible();";
  assert.equal(
    hardenSpec(code, context),
    'await expect(page.getByRole("heading", { name: "Ship with proof. Not hope." })).toBeVisible();',
  );
});
