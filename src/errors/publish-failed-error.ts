export class PublishFailedError extends Error {
  constructor(message: string) {
    super(message)
  }
}