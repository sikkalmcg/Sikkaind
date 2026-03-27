
import { EventEmitter } from 'events';
import { FirestorePermissionError } from './errors';

type Events = {
  'permission-error': (error: FirestorePermissionError) => void;
};

class ErrorEmitter extends EventEmitter {
  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof Events>(event: K, listener: Events[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof Events>(event: K, listener: Events[K]): this {
    return super.off(event, listener);
  }
}

export const errorEmitter = new ErrorEmitter();
