export function extractGitHubPRInfo(url) {
  const parsedUrl = new URL(String(url));
  if (parsedUrl.hostname !== "github.com") {
    throw new Error("Invalid GitHub pull request URL");
  }

  const parts = parsedUrl.pathname.split("/").filter(Boolean);
  if (parts.length < 4 || parts[2] !== "pull" || !/^\d+$/.test(parts[3])) {
    throw new Error("Invalid GitHub pull request URL");
  }

  return {
    owner: parts[0],
    repo: parts[1],
    pull_number: parts[3],
  };
}
