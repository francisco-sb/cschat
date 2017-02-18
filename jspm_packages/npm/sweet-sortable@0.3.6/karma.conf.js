/* */ 
var path = require('path');
module.exports = function(config) {
  config.set({
    basePath: '',
    frameworks: ['mocha'],
    files: ['test/test.js'],
    exclude: [],
    preprocessors: {'test/test.js': ['webpack']},
    reporters: ['progress', 'coverage'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    browsers: ['Firefox'],
    webpack: {module: {preLoaders: [{
          test: /\.js$/,
          include: path.resolve('lib/'),
          loader: 'istanbul-instrumenter'
        }]}},
    webpackMiddleware: {noInfo: true},
    singleRun: false,
    coverageReporter: {
      dir: 'coverage/',
      reporters: [{type: 'text'}, {
        type: 'html',
        subdir: 'html'
      }, {
        type: 'lcovonly',
        subdir: 'lcov'
      }, {
        type: 'cobertura',
        subdir: 'cobertura'
      }]
    }
  });
};
