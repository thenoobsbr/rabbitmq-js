import { ITimeSpan, TimeSpan } from '../types'

export class Task {
  public static delay(timeSpan: ITimeSpan): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, TimeSpan.getTotalMilliseconds(timeSpan)))
  }
}