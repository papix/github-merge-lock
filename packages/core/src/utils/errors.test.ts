import { describe, expect, it } from 'vitest'
import { RepositoryNotFoundError } from './errors.js'

describe('RepositoryNotFoundError', () => {
  it('sets name and message', () => {
    const error = new RepositoryNotFoundError('owner', 'repo')

    expect(error.name).toBe('RepositoryNotFoundError')
    expect(error.message).toContain('owner/repo')
  })
})
