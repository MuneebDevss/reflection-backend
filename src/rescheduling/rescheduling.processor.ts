import { ReschedulingService } from "./rescheduling.service";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bullmq";
@Injectable()
@Processor('rescheduling', { concurrency: 5 })
export class ReschedulingProcessor extends WorkerHost  {
private readonly logger = new Logger(ReschedulingProcessor.name);
  constructor(private svc: ReschedulingService) {
    super();
  }
  /**
   * This core method intercepts ALL jobs flowing into the 'rescheduling' queue.
   */
  async process(job: Job<{ userId: string }>) {
    switch (job.name) {
      case 'reschedule': {
        try {
          const result = await this.svc.rescheduleTasks(job.data.userId)
          this.logger.log(`Rescheduling completed for user ${job.data.userId}
              with jobs rescheduled: ${result.success ? result.seatedCount : 'N/A'}, 
              moved to graveyard: ${result.success ? result.graveyardCount : 'N/A'}`);
        } 
        catch(error :unknown) {
          if (error instanceof Error) {
          this.logger.error(`Rescheduling failed for user ${job.data.userId}: ${error.message}`, error.stack);
        }
      };
      break;
    }
    default:
        this.logger.warn(`Unknown job type: ${job.name}`);
  }
}
}