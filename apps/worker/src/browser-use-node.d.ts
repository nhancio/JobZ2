declare module 'browser-use-node' {
  export class Browser {
    constructor(opts?: { headless?: boolean });
    close?(): Promise<void>;
  }
  export class Agent {
    constructor(opts: {
      task: string;
      browser: InstanceType<typeof Browser>;
      useVision?: boolean;
      maxFailures?: number;
      retryDelay?: number;
    });
    run(): Promise<void>;
  }
}
