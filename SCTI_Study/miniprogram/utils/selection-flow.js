function createSelectionFlow({ setTimer, clearTimer, delay = 280 }) {
  let timerId = null;
  let generation = 0;
  return {
    cancel() {
      generation += 1;
      if (timerId !== null) clearTimer(timerId);
      timerId = null;
    },
    schedule({ token, action, run }) {
      this.cancel();
      const scheduledGeneration = generation;
      timerId = setTimer(() => {
        timerId = null;
        if (scheduledGeneration !== generation) return;
        run(action, token);
      }, delay);
    }
  };
}

module.exports = { createSelectionFlow };
