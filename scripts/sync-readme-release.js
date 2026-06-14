const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const readmePath = path.join(rootDir, "README.md");
const packagePath = path.join(rootDir, "package.json");
const repoUrl = "https://github.com/Leopere/youtube-up-next-app";

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const readme = fs.readFileSync(readmePath, "utf8");
const shippedAt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

const releaseBlock = [
  "## Release",
  "",
  `- Current version: \`${pkg.version}\``,
  `- Last shipped: \`${shippedAt}\``,
  `- Latest release: ${repoUrl}/releases/latest`,
  `- macOS app zip: ${repoUrl}/releases/latest/download/TubeTV-macOS-Electron-arm64.zip`,
  `- Browser extension zip: ${repoUrl}/releases/latest/download/TubeTV-extension.zip`,
  "- Ship command: `./ship.sh \"<commit message>\"`",
  "- Ship contract: sync this README, run checks, build the extension zip, rebuild the macOS release, commit/push source changes, publish/update the GitHub release, install to `/Applications`, and relaunch locally.",
  ""
].join("\n");

let nextReadme;
const releaseSectionPattern = /(^|\n)## Release\n[\s\S]*?(?=\n## |$)/;

if (releaseSectionPattern.test(readme)) {
  nextReadme = readme.replace(releaseSectionPattern, `$1${releaseBlock}`);
} else {
  nextReadme = readme.replace(/\n## Where to Add Videos\n/, `\n${releaseBlock}\n## Where to Add Videos\n`);
}

if (nextReadme !== readme) {
  fs.writeFileSync(readmePath, nextReadme);
}
