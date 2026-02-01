export class RepositoryNotFoundError extends Error {
  constructor(owner: string, repo: string) {
    super(`Repository "${owner}/${repo}" not found. Check the owner and repo names, and ensure you have access.`)
    this.name = 'RepositoryNotFoundError'
  }
}
