export class PublisherClosedError extends Error {
  constructor() {
    super('Publisher is closed')
  }
}