export function getGitHubToken(): string {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  if (!token) {
    throw new Error(
      'GitHub トークンが見つかりません。GITHUB_TOKEN/GH_TOKEN、または GH_APP_ID と GH_APP_PRIVATE_KEY(_PATH) を設定してください。',
    )
  }
  return token
}
