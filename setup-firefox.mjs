import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";

const FIREFOX_DIR = String.raw`C:\Program Files\Mozilla Firefox`;
const PREF_DIR = path.join(FIREFOX_DIR, "defaults", "pref");

const FIREFOX_CFG = path.join(FIREFOX_DIR, "firefox.cfg");
const AUTOCONFIG_JS = path.join(PREF_DIR, "autoconfig.js");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function normalizeUrl(value) {
  value = value.trim();

  if (!value) {
    throw new Error("L'URL ne peut pas être vide.");
  }

  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value}`;
  }

  const url = new URL(value);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Seules les URL HTTP/HTTPS sont acceptées.");
  }

  return url.href;
}

try {
  console.log("Configuration de la page Nouvel onglet de Firefox\n");

  const answer = await rl.question(
    "Quelle page veux-tu utiliser ? (ex: home.nodori.ch) : "
  );

  const homepage = normalizeUrl(answer);

  const firefoxCfg = `//

ChromeUtils.importESModule(
  "resource:///modules/AboutNewTab.sys.mjs"
).AboutNewTab.newTabURL = ${JSON.stringify(homepage)};
`;

  const autoconfigJs = `//
pref("general.config.filename", "firefox.cfg");
pref("general.config.obscure_value", 0);
pref("general.config.sandbox_enabled", false);
`;

  await fs.mkdir(PREF_DIR, { recursive: true });

  await fs.writeFile(FIREFOX_CFG, firefoxCfg, "utf8");
  await fs.writeFile(AUTOCONFIG_JS, autoconfigJs, "utf8");

  console.log("\nConfiguration terminée.");
  console.log(`Nouvelle page : ${homepage}`);
  console.log(`Créé : ${FIREFOX_CFG}`);
  console.log(`Créé : ${AUTOCONFIG_JS}`);
  console.log("\nFerme complètement Firefox puis relance-le.");
} catch (error) {
  console.error("\nErreur :", error.message);

  if (error.code === "EACCES" || error.code === "EPERM") {
    console.error(
      "\nLance PowerShell ou le Terminal Windows en tant qu'administrateur puis réessaie."
    );
  }

  process.exitCode = 1;
} finally {
  rl.close();
}