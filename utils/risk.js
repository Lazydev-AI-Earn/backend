export function requiresExternalPosting(text = "") {
  return riskyPhrase(text, ["external account", "post to", "tweet", "publish"]);
}

export function requiresWalletAction(text = "") {
  return riskyPhrase(text, ["wallet", "signature", "transaction", "send funds"]);
}

function riskyPhrase(text, phrases) {
  const normalized = String(text).toLowerCase();
  return phrases.some((phrase) => {
    const index = normalized.indexOf(phrase);
    if (index === -1) return false;
    const before = normalized.slice(Math.max(0, index - 60), index);
    return !/(does not require|do not require|without|no need for|no)\b/i.test(before);
  });
}
