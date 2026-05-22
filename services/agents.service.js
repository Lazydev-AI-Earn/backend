import { prisma } from "./prisma.js";
import { HttpError } from "../middlewares/errors.js";
import { isAdmin, isSameWallet } from "../middlewares/auth.js";
import { normalizeWallet } from "../utils/wallet.js";
import { hasAgentSkill, saveAgentSkill, validateAgentSkillBuffer } from "./agent-skills.service.js";

export async function publicAgent(agent) {
  if (!agent) return null;
  const { systemPrompt, ...safeAgent } = agent;
  return {
    ...safeAgent,
    hasSkill: await hasAgentSkill(agent.slug),
  };
}

export async function privateAgent(agent) {
  if (!agent) return null;
  return {
    ...agent,
    hasSkill: await hasAgentSkill(agent.slug),
  };
}

export async function listActiveAgents(query = {}) {
  const where = { isActive: true };
  if (query.officialOnly === true) where.isOfficial = true;
  if (query.category) where.category = query.category;
  if (query.agentType) where.agentType = query.agentType;
  if (query.creatorWallet) where.creatorWallet = normalizeWallet(query.creatorWallet);
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { slug: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const agents = await prisma.agent.findMany({
    where,
    orderBy: [{ isOfficial: "desc" }, { category: "asc" }, { name: "asc" }],
  });
  return Promise.all(agents.map(publicAgent));
}

export async function getAgent(id) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent || !agent.isActive) {
    throw new HttpError(404, "Agent not found", "Not Found");
  }
  return publicAgent(agent);
}

export async function createAgent(data) {
  try {
    return await prisma.agent.create({
      data: {
        ...data,
        creatorWallet: null,
        price: data.price || "0",
        isOfficial: data.isOfficial ?? true,
        isActive: data.isActive ?? true,
      },
    });
  } catch (error) {
    handleAgentWriteError(error);
  }
}

export async function updateAgent(id, data) {
  await ensureAgentExists(id);
  try {
    return await prisma.agent.update({ where: { id }, data });
  } catch (error) {
    handleAgentWriteError(error);
  }
}

export async function disableAgent(id) {
  await ensureAgentExists(id);
  return prisma.agent.update({ where: { id }, data: { isActive: false } });
}

export async function createUserAgent(user, data, skillFile) {
  if (skillFile) validateAgentSkillBuffer(skillFile.buffer);

  let agent;
  try {
    agent = await prisma.agent.create({
      data: {
        ...data,
        creatorWallet: normalizeWallet(user.walletAddress),
        price: data.price || "0",
        isOfficial: false,
        isActive: true,
      },
    });

    if (skillFile) {
      await saveAgentSkill(agent.slug, skillFile.buffer);
    }

    return privateAgent(agent);
  } catch (error) {
    if (agent?.id && skillFile) {
      await prisma.agent.delete({ where: { id: agent.id } }).catch(() => {});
    }
    handleAgentWriteError(error);
  }
}

export async function updateUserAgent(user, id, data) {
  const agent = await ensureAgentExists(id);
  ensureAgentOwnerOrAdmin(user, agent);

  const updated = await prisma.agent.update({
    where: { id },
    data,
  });

  return privateAgent(updated);
}

export async function replaceUserAgentSkill(user, id, skillFile) {
  if (!skillFile) {
    throw new HttpError(400, "SKILL.md file is required", "Bad Request");
  }

  const agent = await ensureAgentExists(id);
  ensureAgentOwnerOrAdmin(user, agent);
  await saveAgentSkill(agent.slug, skillFile.buffer);
  return privateAgent(await prisma.agent.findUnique({ where: { id } }));
}

export async function disableUserAgent(user, id) {
  const agent = await ensureAgentExists(id);
  ensureAgentOwnerOrAdmin(user, agent);
  const updated = await prisma.agent.update({ where: { id }, data: { isActive: false } });
  return privateAgent(updated);
}

export async function listAgentsByWallet(user, walletAddress) {
  if (!isAdmin(user) && !isSameWallet(user, walletAddress)) {
    throw new HttpError(403, "Agent access denied", "Forbidden");
  }

  const agents = await prisma.agent.findMany({
    where: { creatorWallet: normalizeWallet(walletAddress) },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(agents.map(privateAgent));
}

async function ensureAgentExists(id) {
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) {
    throw new HttpError(404, "Agent not found", "Not Found");
  }
  return agent;
}

function ensureAgentOwnerOrAdmin(user, agent) {
  if (isAdmin(user) || isSameWallet(user, agent.creatorWallet)) return;
  throw new HttpError(403, "Agent access denied", "Forbidden");
}

function handleAgentWriteError(error) {
  if (error?.code === "P2002") {
    throw new HttpError(409, "Agent slug already exists", "Conflict");
  }
  throw error;
}
