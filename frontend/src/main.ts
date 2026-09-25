import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// sockjs-client still expects Node's `global`. It is only imported by lazy
// routes, so defining it here (before bootstrap) is early enough.
(window as unknown as { global: Window }).global = window;

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
