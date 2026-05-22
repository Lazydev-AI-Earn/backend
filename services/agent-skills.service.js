import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HttpError } from "../middlewares/errors.js";

const skillRoot = fileURLToPath(new URL("../agents/skills/", import.meta.url));
const cache = new Map();

function assertSafeSlug(slug) {
  if (!/^[a-z0-9-]+$/.test(String(slug || ""))) {
    throw new HttpError(400, "Invalid agent skill slug", "Bad Request");
  }
}

function skillPathForSlug(slug) {
  assertSafeSlug(slug);
  const resolvedPath = path.resolve(skillRoot, slug, "SKILL.md");
  const normalizedRoot = path.resolve(skillRoot);
  if (!resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new HttpError(400, "Invalid agent skill path", "Bad Request");
  }
  return resolvedPath;
}

async function readSkillFile(slug) {
  const filePath = skillPathForSlug(slug);
  const cached = cache.get(slug);
  if (cached) return cached;

  try {
    await access(filePath, constants.R_OK);
    const content = await readFile(filePath, "utf8");
    const result = { hasSkill: true, source: "skill", content };
    cache.set(slug, result);
    return result;
  } catch {
    const result = { hasSkill: false, source: "fallback", content: null };
    cache.set(slug, result);
    return result;
  }
}

export async function hasAgentSkill(slug) {
  const result = await readSkillFile(slug);
  return result.hasSkill;
}

export async function loadAgentSkill(slug, fallbackPrompt = "") {
  const result = await readSkillFile(slug);
  if (result.hasSkill) return result;
  return {
    hasSkill: false,
    source: "systemPrompt",
    content: fallbackPrompt || "",
  };
}

function skillContentFromBuffer(fileBuffer) {
  const content = Buffer.from(fileBuffer).toString("utf8");
  if (!content.trim()) {
    throw new HttpError(400, "SKILL.md cannot be empty", "Bad Request");
  }
  if (content.includes("\u0000")) {
    throw new HttpError(400, "SKILL.md must be a text file", "Bad Request");
  }
  return content;
}

export function validateAgentSkillBuffer(fileBuffer) {
  skillContentFromBuffer(fileBuffer);
}

export async function saveAgentSkill(slug, fileBuffer) {
  const filePath = skillPathForSlug(slug);
  const content = skillContentFromBuffer(fileBuffer);

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
  cache.delete(slug);
  return loadAgentSkill(slug);
}

export function clearAgentSkillCache() {
  cache.clear();
}
