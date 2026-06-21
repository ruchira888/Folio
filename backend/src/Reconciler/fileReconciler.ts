import { StorageProvider } from "../storage/StorageProvider";
import {logger} from '../logger'

export class FileReconciler{
  private provider:StorageProvider
  private intervalMs:number
  private time:NodeJS.Timeout | null=null

  constructor(provider:StorageProvider,intervalMs=5*60*1000){
  this.provider=provider
  this.intervalMs=intervalMs
}
start(){
  logger.info('Reconciler started — running every 5 minutes')
  this.time=setInterval(()=>this.reconcile(),this.intervalMs)
}

  stop() {
    if (this.time) clearInterval(this.time)
  }

  private async reconcile(){
    logger.info('Reconciler tick')
    try{
      const expired=await this.provider.listExpired(new Date())
      if(!expired.length){
        logger.info('Reconciler:nothin to clean up')
        return
      }
      for(const file of expired){
        try{
          await this.provider.delete(file.id)
        } catch(err){
          // one failed del should not stop the rest
          logger.error(`Reconciler failed to delete ${file.id}`, err)
        }
      }
        logger.info(`Reconciler cleaned ${expired.length} expired files`)
    }
    catch (err) {
      logger.error('Reconciler error', err)
    }
  }

}
