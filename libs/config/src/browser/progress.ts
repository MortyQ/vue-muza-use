import NProgress from "nprogress";
import "nprogress/nprogress.css";

NProgress.configure({ showSpinner: false, speed: 500 });

class ProgressBarService {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private readonly DELAY = 250;

  start() {
    if (this.timeout) return;

    this.timeout = setTimeout(() => {
      NProgress.start();
    }, this.DELAY);
  }

  done() {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (NProgress.isStarted()) {
      NProgress.done();
    }
  }
}

export const progress = new ProgressBarService();
