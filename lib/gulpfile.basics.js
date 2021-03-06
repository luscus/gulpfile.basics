/* jshint node:true */
/* jshint expr:true*/
/* global require */
/* global module */
'use strict';


var gulp          = require('gulp-param')(require('gulp'), process.argv);
var mocha         = require('gulp-mocha');
var jshint        = require('gulp-jshint');
var stylish       = require('jshint-stylish');
var shrinkwrap    = require('gulp-shrinkwrap');
var istanbul      = require('gulp-istanbul');
var path          = require('path');
var npm           = require('npm');
var Q             = require('q');

var REPORT_PATH   = 'reports';
var COVERAGE_PATH = 'coverage';
var LIB_FILES     = './lib/**/*.js';
var TEST_FILES    = './test/**/*.spec.js';
var LINT_FILES    = ['./**/*.js', './**/*.json', '!./node_modules/**/*', '!./coverage/**/*'];
var COMMIT_FILES  = ['./package.json', './gulpfile.js', './npm-shrinkwrap.json', './reports/**/*'];

var COVERAGE_THRESHOLDS = {
  global: 0
};


// The default task (called when you run `gulp` from cli)
gulp.task('default', ['watch']);

// Rerun the task when a file changes
gulp.task('watch', function() {
  gulp.watch(LINT_FILES, ['coverage']);
});



gulp.task('lint', function() {

  return gulp.src(LINT_FILES)
    .pipe(jshint())
    .pipe(jshint.reporter(stylish))
    .pipe(jshint.reporter('fail'));
});

gulp.task('test', ['lint'], function () {

  return gulp.src(TEST_FILES, {read: false})
    .pipe(mocha({
      reporter: 'spec',
      bail: true
    }));
});

var coberturaBadger = require('istanbul-cobertura-badger');
var coberturaFile = "coverage/cobertura-coverage.xml";

gulp.task('coverage', ['lint'], function () {
  var deferred = Q.defer();

  gulp.src([LIB_FILES])
    .pipe(istanbul()) // Covering files
    .pipe(istanbul.hookRequire()) // Force `require` to return covered files
    .on('finish', function () {
      gulp.src(TEST_FILES)
        .pipe(mocha({
          reporter: 'dot',
          bail:     true
        }))
        .pipe(istanbul.writeReports({
          dir: COVERAGE_PATH,
          reporters: [ 'lcov', 'cobertura', 'json', 'text-summary' ],
          reportOpts: {
            lcov:      {dir: COVERAGE_PATH},
            cobertura: {dir: COVERAGE_PATH},
            json:      {dir: REPORT_PATH, file: 'converage.json'}
          }
        }))
        .pipe(istanbul.enforceThresholds({
          thresholds: COVERAGE_THRESHOLDS
        }))
        .on('error', function coverageErrorHandler (error) {
          if (error.message !== 'Coverage failed') {
            throw error;
          }

          throw new Error('Coverage Thresholds failure - bellow: ' + COVERAGE_THRESHOLDS.global + '%');
        })
        .on('end', function () {
          var options = {
            destinationDir: REPORT_PATH,
            istanbulReportFile: COVERAGE_PATH + path.sep + 'cobertura-coverage.xml'
          };

          // create coverage badge for README file
          coberturaBadger(options, function(error, results) {
            if (error) {
              console.error(error.stack);
            }
            console.log("Badge created at " + REPORT_PATH + "/cobertura.svg");
            deferred.resolve();
          });
        });
    });

  return deferred.promise;
});

gulp.task('shrinkwrap', function () {

  return gulp.src('./package.json')
    .pipe(shrinkwrap())
    .pipe(gulp.dest('./'));
});


var git  = require('gulp-git');
var bump = require('gulp-bump');

// Update bower, component, npm at once:
gulp.task('bumpVersion', ['coverage', 'shrinkwrap'], function (patch, minor, major) {
  var type = 'patch';

  if (!minor && !major || minor && major) {
    // if no type has been specified,
    // or all types have been used
    // enforce patch
    patch = true;
  }

  if (minor && !patch) {
    type = 'minor';
  }

  if (major && !patch) {
    type = 'major';
  }

  return gulp.src(['./bower.json', './component.json', './package.json'])
    .pipe(bump({type:type}))
    .pipe(gulp.dest('./'));
});

var PACKAGE_VERSION;


gulp.task('commit', ['bumpVersion'], function gitCommit () {


  // reload package.json file
  delete require.cache[require.resolve('./package.json')];
  var packageInfo = require('./package.json');

  // build new version string
  PACKAGE_VERSION     = 'v' + packageInfo.version;

  return gulp.src(COMMIT_FILES)
    .pipe(git.commit(PACKAGE_VERSION, function gitCommitHandler (err) {
      if (err) throw err;
    }));
});

gulp.task('release', ['commit'], function gitCommit () {
  var deferred = Q.defer();

  // reload package.json file
  delete require.cache[require.resolve('./package.json')];
  var packageInfo = require('./package.json');

  // build new version string
  PACKAGE_VERSION     = 'v' + packageInfo.version;

  git.tag(PACKAGE_VERSION, PACKAGE_VERSION, function gitTagHandler(err) {
    if (err) {
      deferred.reject(err);
      return;
    }

    git.push('origin', 'master', {args: '--tags'}, function gitPushHandler(err) {
      if (err) {
        deferred.reject(err);
        return;
      }

      deferred.resolve();
    });
  });

  return deferred.promise;
});

gulp.task('publish', ['release'], function gitCommit () {
  var deferred = Q.defer();

  npm.load({}, function () {
    npm.commands.publish(function publishHandler (err) {
      if (err) {
        deferred.reject(err);
        return;
      }

      deferred.resolve();
    });
  });

  return deferred.promise;
});

module.exports = gulp;
