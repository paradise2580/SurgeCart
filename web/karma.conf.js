// Karma configuration.
//
// Angular's default config is fine on a developer laptop, but CI runs the
// browser inside a container. Two things have to be said explicitly there:
// a Chrome launcher that does not rely on the setuid sandbox (it is
// unavailable in most container images, and Chrome refuses to start as root
// without --no-sandbox), and a longer capture timeout, because a cold CI
// runner can take a while to get the browser up.

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma'),
    ],
    client: {
      jasmine: {
        // Deterministic order. A suite that only passes in one random order
        // is hiding shared state between specs.
        random: false,
      },
      clearContext: false,
    },
    jasmineHtmlReporter: { suppressAll: true },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/web'),
      subdir: '.',
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadlessNoSandbox'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: [
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage', // /dev/shm is tiny in most containers
        ],
      },
    },
    captureTimeout: 120000,
    browserDisconnectTimeout: 30000,
    browserNoActivityTimeout: 120000,
    restartOnFileChange: true,
  });
};
