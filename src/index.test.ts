import {
  CacheCandidatePlugin,
  Hooks
} from '@jointly/cache-candidate-plugin-base';
import { cacheCandidate } from './lib';
import { MockClass } from './test/MockClass';
import { MockClass as MockClass2 } from './test/MockClass2';

import {
  step,
  eventHits,
  sleep,
  ENOUGH_TIME,
  TTL,
  EXECUTION_MARGIN,
  flushMaps
} from './test/options';

const stepper = step();

beforeEach(async () => {
  await sleep(ENOUGH_TIME);
  flushMaps();
});

describe('Basic + Expiration', () => {
  it('should verify cache is empty', async () => {
    expect(eventHits.get('onCacheSet')).toBe(0);
    expect(eventHits.get('onCacheHit')).toBe(0);
    expect(eventHits.get('onCacheDelete')).toBe(0);
  });

  it('should separate the cache entries for MockClass and MockClass2 even if original names are equal', async () => {
    const step = stepper();
    const mock = new MockClass(step, step, step, step);
    const mock2 = new MockClass2(step, step, step, step);
    mock.mockFunction(step);
    await sleep(TTL + EXECUTION_MARGIN);
    mock2.mockFunction(step);
    await sleep(TTL + EXECUTION_MARGIN);
    expect(eventHits.get('onCacheSet')).toBe(2);
    expect(eventHits.get('onCacheHit')).toBe(0);
  });

  it('should call onCacheDelete for sync method', async () => {
    const step = stepper();
    const mock = new MockClass(step, step, step, step);
    mock.mockFunction(step);
    await sleep(TTL + EXECUTION_MARGIN);
    expect(eventHits.get('onCacheDelete')).toBe(1);
  });

  it('should call onCacheDelete for async method', async () => {
    const step = stepper();
    const mock = new MockClass(step, step, step, step);
    await mock.mockAsyncFunction(step);
    await sleep(TTL + EXECUTION_MARGIN);
    expect(eventHits.get('onCacheDelete')).toBe(1);
  });

  it('should call onCacheSet for sync method', async () => {
    const step = stepper();
    const mock = new MockClass(step, step, step, step);
    mock.mockFunction(step);
    await sleep(EXECUTION_MARGIN);
    expect(eventHits.get('onCacheSet')).toBe(1);
  });

  it('should call onCacheHit for sync method', async () => {
    const step = stepper();
    const mock = new MockClass(step, step, step, step);
    mock.mockFunction(step);
    await sleep(EXECUTION_MARGIN);
    mock.mockFunction(step);
    await sleep(EXECUTION_MARGIN);
    expect(eventHits.get('onCacheHit')).toBe(1);
  });

  it('should call onCacheSet for async method', async () => {
    const step = stepper();
    const mock = new MockClass(step, step, step, step);
    await mock.mockAsyncFunction(step);
    await sleep(EXECUTION_MARGIN);
    expect(eventHits.get('onCacheSet')).toBe(1);
  });

  it('should call onCacheHit for async method', async () => {
    const step = stepper();
    const mock = new MockClass(step, step, step, step);
    await mock.mockAsyncFunction(step);
    await sleep(EXECUTION_MARGIN);
    await mock.mockAsyncFunction(step);
    await sleep(EXECUTION_MARGIN);
    expect(eventHits.get('onCacheHit')).toBe(1);
  });

  it('should empty the timeframe cache after timeframe has passed', async () => {
    let counter = 0;
    const mockFn = (step: number) =>
      new Promise((resolve) => {
        setTimeout(() => {
          counter += step;
          resolve(counter);
        }, EXECUTION_MARGIN);
      });
    const wrappedMockFn = cacheCandidate(mockFn, {
      requestsThreshold: 1,
      timeFrame: EXECUTION_MARGIN * 2,
      ttl: EXECUTION_MARGIN * 2
    });

    await wrappedMockFn(1);
    expect(counter).toBe(1);
    await sleep(EXECUTION_MARGIN);
    await wrappedMockFn(1);
    expect(counter).toBe(1);
    await sleep(EXECUTION_MARGIN);
    await wrappedMockFn(1);
    expect(counter).toBe(2);
  });

  it('should delete the data cache after ttl has passed even if timeframe is not', async () => {
    let counter = 0;
    const mockFn = (step: number) =>
      new Promise((resolve) => {
        setTimeout(() => {
          counter += step;
          resolve(counter);
        }, EXECUTION_MARGIN);
      });
    const wrappedMockFn = cacheCandidate(mockFn, {
      requestsThreshold: 1,
      timeFrame: EXECUTION_MARGIN * 2,
      ttl: EXECUTION_MARGIN
    });

    await wrappedMockFn(1);
    expect(counter).toBe(1);
    await sleep(EXECUTION_MARGIN);
    await wrappedMockFn(1);
    expect(counter).toBe(2);
    await sleep(EXECUTION_MARGIN);
    await wrappedMockFn(1);
    expect(counter).toBe(3);
  });

  it('should make an item expire after TTL', async () => {
    const step = stepper();
    const mock = new MockClass(step, step, step, step);
    mock.mockFunction(step);
    await sleep(EXECUTION_MARGIN);
    mock.mockFunction(step);
    await sleep(EXECUTION_MARGIN);
    expect(eventHits.get('onCacheSet')).toBe(1);
    expect(eventHits.get('onCacheHit')).toBe(1);
    await sleep(TTL + EXECUTION_MARGIN);
    expect(eventHits.get('onCacheDelete')).toBe(1);
    mock.mockFunction(step);
    await sleep(EXECUTION_MARGIN);
    expect(eventHits.get('onCacheSet')).toBe(2);
    expect(eventHits.get('onCacheHit')).toBe(1);
  });

  it('should keep alive an item after TTL if it is used', async () => {
    let counter = 0;
    const mockFn = (step: number) =>
      new Promise((resolve) => {
        counter += step;
        resolve(counter);
      });
    const wrappedMockFn = cacheCandidate(mockFn, {
      requestsThreshold: 1,
      ttl: EXECUTION_MARGIN * 2,
      keepAlive: true
    });

    await wrappedMockFn(1);
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
    await wrappedMockFn(1);
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
    await sleep(EXECUTION_MARGIN * 2);
    await wrappedMockFn(1);
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(2);
  });

  it('should return the running query if it is called again before the first one is resolved', async () => {
    let counter = 0;
    const mockFn = (step: number) =>
      new Promise((resolve) => {
        setTimeout(() => {
          counter += step;
          resolve(counter);
        }, EXECUTION_MARGIN);
      });
    const wrappedMockFn = cacheCandidate(mockFn, {
      requestsThreshold: 1
    });

    wrappedMockFn(1);
    await sleep(EXECUTION_MARGIN / 2);
    wrappedMockFn(1);
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
  });
});

describe('Conditions', () => {
  it('should behave in the same way as a decorator if the higher-order function is used', async () => {
    let counter = 0;
    const mockFn = (step: number) =>
      new Promise((resolve) => {
        counter += step;
        resolve(counter);
      });
    const wrappedMockFn = cacheCandidate(mockFn, {
      requestsThreshold: 1,
      ttl: 800
    });
    await wrappedMockFn(1);
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
    await wrappedMockFn(1);
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
  });

  it('should behave correctly when a millisecondThreshold is passed', async () => {
    let counter = 0;
    const mockFn = (step: number) =>
      new Promise((resolve) => {
        setTimeout(() => {
          counter += step;
          resolve(counter);
        }, EXECUTION_MARGIN);
      });

    const wrappedMockFn = cacheCandidate(mockFn, {
      millisecondThreshold: EXECUTION_MARGIN / 2,
      requestsThreshold: 1
    });

    await wrappedMockFn(1); // should be cached
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
    await wrappedMockFn(1); // should be cached
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
    await wrappedMockFn(2); // should not be cached
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(3);
    await wrappedMockFn(2); // should be cached
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(3);
  });

  it('should behave correctly when a candidateFunction is passed', async () => {
    let counter = 0;
    const mockFn = (step: number) =>
      new Promise((resolve) => {
        counter += step;
        resolve(counter);
      });

    const wrappedMockFn = cacheCandidate(mockFn, {
      candidateFunction: ({ args }) => {
        return args[0] === 1;
      }
    });

    await wrappedMockFn(1); // should be cached
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
    await wrappedMockFn(1); // should be cached
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
    await wrappedMockFn(2); // should not be cached
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(3);
    await wrappedMockFn(2); // should not be cached
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(5);
  });
});

describe('Plugins', () => {
  it('should throw if hook is doubled', async () => {
    const myPlugin: CacheCandidatePlugin = {
      name: 'myPlugin',
      hooks: [
        {
          hook: Hooks.INIT,
          action: async ({ key }) => {
            // do nothing
          }
        },
        {
          hook: Hooks.INIT,
          action: async ({ key }) => {
            // do nothing
          }
        }
      ]
    };

    const mockFn = (step: number) =>
      new Promise((resolve) => {
        resolve(step);
      });

    const wrappedMockFn = cacheCandidate(mockFn, {
      plugins: [myPlugin]
    });

    await expect(wrappedMockFn(1)).rejects.toThrow();
  });

  it('should throw if hook action is not valid', async () => {
    const myPlugin: CacheCandidatePlugin = {
      name: 'myPlugin',
      hooks: [
        {
          hook: Hooks.INIT,
          action: 'invalidAction' as any
        }
      ]
    };

    const mockFn = (step: number) =>
      new Promise((resolve) => {
        resolve(step);
      });

    const wrappedMockFn = cacheCandidate(mockFn, {
      plugins: [myPlugin]
    });

    await expect(wrappedMockFn(1)).rejects.toThrow();
  });

  it('should throw if hook name is not valid', async () => {
    const myPlugin: CacheCandidatePlugin = {
      name: 'myPlugin',
      hooks: [
        {
          hook: 'invalidHook' as any,
          action: async ({ key }) => {
            // do nothing
          }
        }
      ]
    };

    const mockFn = (step: number) =>
      new Promise((resolve) => {
        resolve(step);
      });

    try {
      cacheCandidate(mockFn, {
        plugins: [myPlugin]
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(true).toBe(true);
    }
  });

  it('should throw if plugin has no hooks', async () => {
    const myPlugin: CacheCandidatePlugin = {
      name: 'myPlugin',
      hooks: []
    };

    const mockFn = (step: number) =>
      new Promise((resolve) => {
        resolve(step);
      });

    try {
      cacheCandidate(mockFn, {
        plugins: [myPlugin]
      });
      expect(true).toBe(false);
    } catch (e) {
      expect(true).toBe(true);
    }
  });

  it('should create a stub plugin and use it', async () => {
    let counter = 0;
    const myPlugin: CacheCandidatePlugin = {
      name: 'myPlugin',
      hooks: [
        {
          hook: Hooks.INIT,
          action: async ({ key }) => {
            counter = 1;
          }
        }
      ]
    };

    const mockFn = (step: number) =>
      new Promise((resolve) => {
        resolve(counter);
      });

    const wrappedMockFn = cacheCandidate(mockFn, {
      plugins: [myPlugin]
    });

    await wrappedMockFn(1);
    await sleep(EXECUTION_MARGIN);
    expect(counter).toBe(1);
  });

  it('should throw if internal functions getDataCacheRecord is overridden', async () => {

    const myPlugin = {
      name: 'myPlugin',
      hooks: [
        {
          hook: Hooks.INIT,
          action: async (payload) => {
            payload.internals.getDataCacheRecord = function () {
              console.log("should not be possible");
            };
          }
        }
      ]
    };

    const mockFn = (step: number) =>
      new Promise((resolve) => {
        resolve(step);
      });

    const wrappedMockFn = cacheCandidate(mockFn, {
      plugins: [myPlugin]
    });

    await expect(wrappedMockFn(1)).rejects.toThrow();

  });

  it('should not throw if internal functions getDataCacheKey is overridden', async () => {

    const myPlugin = {
      name: 'myPlugin',
      hooks: [
        {
          hook: Hooks.INIT,
          action: async (payload) => {
            payload.internals.getDataCacheKey = function () {
              console.log("should be possible");
            };
          }
        }
      ]
    };

    const mockFn = (step: number) =>
      new Promise((resolve) => {
        resolve(step);
      });

    const wrappedMockFn = cacheCandidate(mockFn, {
      plugins: [myPlugin]
    });

    await expect(wrappedMockFn(1)).resolves.not.toThrowError();

  });
});
