// Generates the "Secret Key (for OAuth)" JWT that Supabase's Apple provider uses
// to exchange an Apple authorization code for tokens.
//
// Why this exists: the iOS app signs in with signInWithIdToken(provider:.apple),
// the NATIVE path, which needs only the bundle id and no secret. The web flow
// (signInWithOAuth) is the only consumer of this secret, so it can sit expired or
// unset for a long time without anyone noticing — the symptom is Supabase's
// "Unable to exchange external code: <code>" AFTER Apple has already accepted the
// sign-in, because every earlier step works without the secret.
//
// Apple caps these at 6 months (15777000s), so this WILL need re-running. Paste
// the output into Supabase → Authentication → Providers → Apple → Secret Key.
//
// Usage:
//   node scripts/apple-client-secret.mjs \
//     --key ~/Downloads/AuthKey_ABC123XYZ.p8 \
//     --key-id ABC123XYZ \
//     --team-id DEF456UVW \
//     --services-id com.wagerproof.mobile.auth
//
// The .p8 never leaves your machine; nothing is uploaded.
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith("--")) acc.push([cur.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

const required = ["key", "key-id", "team-id", "services-id"];
const missing = required.filter((k) => !args[k]);
if (missing.length) {
  console.error(`Missing required flag(s): ${missing.map((m) => "--" + m).join(", ")}`);
  console.error("See the usage block at the top of this file.");
  process.exit(1);
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const pem = readFileSync(args.key, "utf8").trim();
if (!pem.includes("BEGIN PRIVATE KEY")) {
  console.error(`${args.key} is not a PKCS#8 .p8 key (expected a "BEGIN PRIVATE KEY" header).`);
  process.exit(1);
}
const der = Buffer.from(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""), "base64");

const key = await webcrypto.subtle.importKey(
  "pkcs8",
  der,
  { name: "ECDSA", namedCurve: "P-256" },
  false,
  ["sign"],
);

const now = Math.floor(Date.now() / 1000);
const SIX_MONTHS = 15777000; // Apple's hard maximum for this claim
const exp = now + SIX_MONTHS;

const header = { alg: "ES256", kid: args["key-id"] };
const claims = {
  iss: args["team-id"],
  iat: now,
  exp,
  aud: "https://appleid.apple.com",
  sub: args["services-id"], // the Services ID, NOT the app bundle id
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
const sig = await webcrypto.subtle.sign(
  { name: "ECDSA", hash: "SHA-256" },
  key,
  Buffer.from(signingInput),
);

console.log(`${signingInput}.${b64url(sig)}`);
console.error(`\n  sub (Services ID): ${claims.sub}`);
console.error(`  iss (Team ID):     ${claims.iss}`);
console.error(`  expires:           ${new Date(exp * 1000).toISOString().slice(0, 10)}`);
console.error(`\nPaste the token above into Supabase → Auth → Providers → Apple → Secret Key.`);
