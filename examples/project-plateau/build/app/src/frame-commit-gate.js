export function createFrameCommitGate() {
  let waiters = [];

  return Object.freeze({
    wait() {
      return new Promise((resolve) => {
        waiters.push(resolve);
      });
    },
    commit() {
      if (waiters.length === 0) return false;
      const committed = waiters;
      waiters = [];
      committed.forEach((resolve) => resolve());
      return true;
    },
    pending() {
      return waiters.length > 0;
    },
  });
}
